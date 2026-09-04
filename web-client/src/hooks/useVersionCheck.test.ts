import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { useVersionCheck } from './useVersionCheck';
import { BUILD_ID, VERSION_RELOAD_KEY } from '../utils/appVersion';

/** A `version.json` naming the given build, as the deployed one would. */
const serving = (buildId: string) =>
  vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ buildId }) }));

describe('useVersionCheck', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    // jsdom's location has no settable reload, so the object is replaced.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reloads the page when a newer build is deployed', async () => {
    vi.stubGlobal('fetch', serving('a-later-build'));

    renderHook(() => useVersionCheck());

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sessionStorage.getItem(VERSION_RELOAD_KEY)).toBe('a-later-build');
  });

  it('leaves the page alone when it is running the deployed build', async () => {
    const fetchMock = serving(BUILD_ID);
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(reload).not.toHaveBeenCalled();
  });

  it('checks again when the app comes back to the foreground', async () => {
    const fetchMock = serving(BUILD_ID);
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('does not check while the app is in the background', async () => {
    const fetchMock = serving(BUILD_ID);
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockRestore();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops checking once the app is unmounted', async () => {
    const fetchMock = serving(BUILD_ID);
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    unmount();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reloads once only, when the reload leaves the page on the old bundle', async () => {
    sessionStorage.setItem(VERSION_RELOAD_KEY, 'a-later-build');
    vi.stubGlobal('fetch', serving('a-later-build'));

    renderHook(() => useVersionCheck());

    await waitFor(() => expect(sessionStorage.getItem(VERSION_RELOAD_KEY)).toBe('a-later-build'));
    expect(reload).not.toHaveBeenCalled();
  });
});
