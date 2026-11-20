import { describe, it, expect } from 'vitest';
import { LatencyLine, withLatencyLog } from './latency';

/** A clock that moves on by the given steps, one per read. */
function clock(...times: number[]) {
  return () => times.shift() ?? 0;
}

describe('withLatencyLog', () => {
  it('logs the time of each call, and marks the first call of the instance', async () => {
    const lines: LatencyLine[] = [];
    const handler = withLatencyLog('dictionarySearch', async () => 'result', {
      log: (line) => lines.push(line),
      now: clock(1000, 1250, 2000, 2040),
      uptimeMs: () => 3100,
    });

    expect(await handler({}, {} as never)).toBe('result');
    await handler({}, {} as never);

    expect(lines).toEqual([
      { function: 'dictionarySearch', ms: 250, outcome: 'ok', firstCall: true, instanceAgeMs: 3100 },
      { function: 'dictionarySearch', ms: 40, outcome: 'ok', firstCall: false },
    ]);
  });

  it('logs a call that fails, and gives the caller the same error', async () => {
    const lines: LatencyLine[] = [];
    const failure = new Error('rate limit');
    const handler = withLatencyLog(
      'dictionaryAlternatives',
      async () => {
        throw failure;
      },
      { log: (line) => lines.push(line), now: clock(0, 75), uptimeMs: () => 900 }
    );

    await expect(handler({}, {} as never)).rejects.toBe(failure);
    expect(lines).toEqual([
      { function: 'dictionaryAlternatives', ms: 75, outcome: 'error', firstCall: true, instanceAgeMs: 900 },
    ]);
  });
});
