import { performance } from 'perf_hooks';

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

/**
 * Write one line as structured JSON. Cloud Logging reads a JSON line on stdout
 * as jsonPayload, as `firebase-functions/logger` does. This module imports no
 * Firebase package, so the test run needs no install of `functions/`.
 */
export function logStructured(message: string, fields: object): void {
  console.log(JSON.stringify({ severity: 'INFO', message, ...fields }));
}

const defaults: Required<LatencyOptions> = {
  log: (line) => logStructured('callable latency', line),
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

export interface StepTimer {
  /** Run one step of a handler and keep its time, also when it fails. */
  time<T>(name: string, step: () => Promise<T>): Promise<T>;
  /** The time of each step that ran, in milliseconds. */
  steps(): Record<string, number>;
}

/**
 * Time the steps of one call. The latency line gives only the handler time,
 * so a handler with several network steps in sequence logs this as well, to
 * show which step is slow (#576).
 */
export function stepTimer(now: () => number = () => performance.now()): StepTimer {
  const steps: Record<string, number> = {};
  return {
    async time(name, step) {
      const started = now();
      try {
        return await step();
      } finally {
        steps[name] = Math.round(now() - started);
      }
    },
    steps: () => ({ ...steps }),
  };
}
