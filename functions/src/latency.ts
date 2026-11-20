import { performance } from 'perf_hooks';
import * as logger from 'firebase-functions/logger';

/**
 * The latency log of the callables (#498).
 *
 * Each call writes one structured line. Cloud Logging keeps it as jsonPayload,
 * so a query can split the cold calls from the warm ones. The 1st gen line
 * "Function execution took N ms" has no such split, and it leaves out the
 * module load before the first call.
 */
export interface LatencyLine {
  function: string;
  /** The time in the handler, in milliseconds. */
  ms: number;
  outcome: 'ok' | 'error';
  /** True on the first call that this instance serves for the function. */
  firstCall: boolean;
  /**
   * The age of the process at the first call, in milliseconds. It holds the
   * module load (the requires, Sentry.init and admin.initializeApp), which the
   * handler time does not.
   */
  instanceAgeMs?: number;
}

export interface LatencyOptions {
  log?: (line: LatencyLine) => void;
  now?: () => number;
  uptimeMs?: () => number;
}

const defaults: Required<LatencyOptions> = {
  log: (line) => logger.info('callable latency', line),
  now: () => performance.now(),
  uptimeMs: () => process.uptime() * 1000,
};

/** Wrap the handler of a callable so that each call writes a latency line. */
export function withLatencyLog<TData, TContext, TResult>(
  functionName: string,
  handler: (data: TData, context: TContext) => TResult | Promise<TResult>,
  options: LatencyOptions = {}
): (data: TData, context: TContext) => Promise<TResult> {
  const { log, now, uptimeMs } = { ...defaults, ...options };
  let firstCall = true;

  return async (data, context) => {
    const isFirst = firstCall;
    firstCall = false;
    const instanceAgeMs = isFirst ? Math.round(uptimeMs()) : undefined;
    const started = now();
    let outcome: LatencyLine['outcome'] = 'error';
    try {
      const result = await handler(data, context);
      outcome = 'ok';
      return result;
    } finally {
      const line: LatencyLine = {
        function: functionName,
        ms: Math.round(now() - started),
        outcome,
        firstCall: isFirst,
      };
      if (instanceAgeMs !== undefined) line.instanceAgeMs = instanceAgeMs;
      log(line);
    }
  };
}
