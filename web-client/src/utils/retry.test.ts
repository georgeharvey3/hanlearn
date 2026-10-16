import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { isTransientError, retryTransient } from './retry';

const callableError = (code: string) => Object.assign(new Error(code), { code });
// What the Firebase AI SDK threw in Sentry issue JAVASCRIPT-REACT-7
const aiLoadFailed = callableError('AI/error');
aiLoadFailed.message =
  'AI: Error fetching from https://firebasevertexai.googleapis.com/...: Load failed (firebasevertexai.googleapis.com)';

describe('isTransientError', () => {
  it.each([
    ['a callable with no response', callableError('functions/internal')],
    ['an unavailable callable', callableError('functions/unavailable')],
    ['a timed-out callable', callableError('functions/deadline-exceeded')],
    ['a Safari fetch failure', new TypeError('Load failed')],
    ['a Chrome fetch failure', new TypeError('Failed to fetch')],
    ['an AI request that failed to load', aiLoadFailed],
  ])('is true for %s', (_, error) => {
    expect(isTransientError(error)).toBe(true);
  });

  it.each([
    ['a bad argument', callableError('functions/invalid-argument')],
    ['a rate limit', callableError('functions/resource-exhausted')],
    ['a plain bug', new Error('Cannot read properties of undefined')],
    ['a string', 'Load failed'],
    ['null', null],
  ])('is false for %s', (_, error) => {
    expect(isTransientError(error)).toBe(false);
  });
});

describe('retryTransient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result of a request that succeeds', async () => {
    const request = vi.fn().mockResolvedValue('ok');
    await expect(retryTransient(request)).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asks once more after a dropped request', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(callableError('functions/internal'))
      .mockResolvedValue('ok');

    const result = retryTransient(request);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('Load failed'));

    const result = retryTransient(request);
    const assertion = expect(result).rejects.toThrow('Load failed');
    await vi.runAllTimersAsync();

    await assertion;
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error that is not about the network', async () => {
    const request = vi.fn().mockRejectedValue(callableError('functions/invalid-argument'));

    await expect(retryTransient(request)).rejects.toThrow('functions/invalid-argument');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
