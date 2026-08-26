import * as Sentry from '@sentry/react';

/**
 * Error reporting for the web client.
 *
 * See docs/adr/0001-error-reporting-for-the-cloud-functions.md. Every event
 * from the client carries `layer: client`, set once in sentry.ts, so that it
 * can be told apart from the `layer: functions` event that the Cloud Function
 * raises for the same failure.
 *
 * Use this for a catch block that recovers. A catch block that already has a
 * Sentry call and needs no feature tag can keep it.
 */

interface ReportOptions {
  /** The part of the application that failed, e.g. 'tts' or 'sentence-score'. */
  feature: string;
  /** Extra values that help explain the failure. Never put user text here. */
  context?: Record<string, unknown>;
  /** Defaults to 'error'. Use 'warning' where the fallback is good enough. */
  level?: Sentry.SeverityLevel;
}

export function reportError(error: unknown, options: ReportOptions): void {
  const { feature, context, level } = options;

  Sentry.withScope((scope) => {
    scope.setTag('feature', feature);
    if (level) scope.setLevel(level);
    if (context) scope.setContext('detail', context);
    Sentry.captureException(error);
  });
}
