import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/errorReporting', () => ({ reportError: vi.fn() }));

import { reportError } from '../services/errorReporting';
import { loadCharData, onCharDataError } from './charDataLoader';

const strokeData = { strokes: ['M 0 0'], medians: [[[0, 0]]] };
const ok = () => ({ ok: true, status: 200, json: () => Promise.resolve(strokeData) });

describe('loadCharData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads the stroke data from the URL HanziWriter reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    const onLoad = vi.fn();

    loadCharData('主', onLoad, vi.fn());
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/主.json',
    );
    expect(onLoad).toHaveBeenCalledWith(strokeData);
  });

  // Sentry JAVASCRIPT-REACT-8: one dropped request left the writer with no character
  it('asks once more after Safari drops the request', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);
    const onLoad = vi.fn();
    const onError = vi.fn();

    loadCharData('主', onLoad, onError);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onLoad).toHaveBeenCalledWith(strokeData);
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError when the CDN has no data for the character', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    const onLoad = vi.fn();
    const onError = vi.fn();

    loadCharData('𠀀', onLoad, onError);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('onCharDataError', () => {
  it('reports the failure under the hanzi-writer feature', () => {
    const error = new TypeError('Load failed');
    onCharDataError(error);
    expect(reportError).toHaveBeenCalledWith(error, { feature: 'hanzi-writer' });
  });
});
