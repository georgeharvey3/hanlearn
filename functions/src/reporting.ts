import * as Sentry from '@sentry/google-cloud-serverless';
import * as functions from 'firebase-functions';

/**
 * Error reporting for the Cloud Functions.
 *
 * See docs/adr/0001-error-reporting-for-the-cloud-functions.md. This module is
 * layer 1 of that decision: it reports every failure that the handler itself
 * can see. An out-of-memory error, a timeout and a container crash are layer 2,
 * because the platform kills the process before any reporter in it runs.
 */

const dsn = process.env.SENTRY_DSN;

let initialised = false;

/**
 * Start Sentry once per function instance.
 *
 * Called from index.ts at cold start, before any request handler runs. Without
 * a DSN this is a no-op, so the emulator and a local run report nothing.
 */
export function initSentry(): void {
  if (initialised || !dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.SENTRY_RELEASE,
    // The functions carry no user-facing tracing, and the web client already
    // samples traces for the calls that reach here.
    tracesSampleRate: 0,
  });

  initialised = true;
}

export function isInitialised(): boolean {
  return initialised;
}

/**
 * HttpsError codes that say the caller is at fault.
 *
 * These are a normal outcome of a callable, so they send no event. A rate
 * limit from checkRateLimit is the common one.
 */
const CALLER_FAULT_CODES: ReadonlySet<string> = new Set([
  'unauthenticated',
  'invalid-argument',
  'resource-exhausted',
  'not-found',
]);

/**
 * Decide whether an error is the service's fault and so worth an event.
 */
export function shouldReport(err: unknown): boolean {
  if (err instanceof functions.https.HttpsError) {
    return !CALLER_FAULT_CODES.has(err.code);
  }
  // Anything that is not an HttpsError escaped the handler unhandled.
  return true;
}

/**
 * Send one error to Sentry, tagged with the function that raised it.
 *
 * The flush is necessary. Cloud Functions freezes the CPU of the instance
 * after the response, so a queued event never leaves the process.
 */
export async function reportError(
  functionName: string,
  err: unknown,
  context?: functions.https.CallableContext
): Promise<void> {
  if (!initialised) return;

  if (!shouldReport(err)) {
    // Keep the rejection as context for a later error on the same instance,
    // but do not raise an event for it.
    Sentry.addBreadcrumb({
      category: 'callable',
      level: 'info',
      message: `${functionName} rejected the caller`,
      data: {
        code: err instanceof functions.https.HttpsError ? err.code : 'unknown',
      },
    });
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('layer', 'functions');
    scope.setTag('function', functionName);
    if (context?.auth?.uid) {
      scope.setUser({ id: context.auth.uid });
    }
    Sentry.captureException(err);
  });

  try {
    await Sentry.flush(2000);
  } catch {
    // A failed flush must never change the error that the caller receives.
  }
}

/**
 * Report an error from a handler that recovers and returns a result anyway.
 *
 * Use this where the fallback is correct but the failure still needs an alert,
 * for example a missing bundled data file.
 */
export function reportHandledError(
  functionName: string,
  err: unknown,
  message: string
): void {
  console.error(`${functionName}: ${message}`, err);
  if (!initialised) return;

  Sentry.withScope((scope) => {
    scope.setTag('layer', 'functions');
    scope.setTag('function', functionName);
    scope.setTag('handled', 'true');
    scope.setContext('recovery', { message });
    Sentry.captureException(err);
  });
}

/**
 * Build an `internal` HttpsError that keeps the original error as its cause.
 *
 * The Sentry linked-errors integration follows the `cause` chain, so the event
 * holds the stack of the real failure and not only the stack of the conversion.
 */
export function internalError(
  message: string,
  cause: unknown
): functions.https.HttpsError {
  const err = new functions.https.HttpsError('internal', message);
  (err as Error & { cause?: unknown }).cause = cause;
  return err;
}

type CallableHandler<TData, TResult> = (
  data: TData,
  context: functions.https.CallableContext
) => TResult | Promise<TResult>;

/**
 * Wrap the handler of a callable so that a failure reaches Sentry.
 *
 * Wrap the handler, and not the exported function. `functions.https.onCall`
 * returns a Firebase function object with deploy metadata, and the Sentry
 * wrappers such as `Sentry.wrapHttpFunction` expect a plain HTTP handler, so
 * they remove that metadata.
 */
export function withErrorReporting<TData, TResult>(
  functionName: string,
  handler: CallableHandler<TData, TResult>
): (
  data: TData,
  context: functions.https.CallableContext
) => Promise<TResult> {
  return async (data, context) => {
    try {
      return await handler(data, context);
    } catch (err) {
      await reportError(functionName, err, context);
      throw err;
    }
  };
}
