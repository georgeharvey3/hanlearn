import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  BUILD_ID,
  VERSION_RELOAD_KEY,
  fetchDeployedBuildId,
  readReloadAttempt,
  shouldReload,
  writeReloadAttempt,
} from './appVersion';

describe('BUILD_ID', () => {
  it('is defined by the build', () => {
    expect(typeof BUILD_ID).toBe('string');
    expect(BUILD_ID.length).toBeGreaterThan(0);
  });
});

describe('shouldReload', () => {
  it('reloads when the deployed build is a different one', () => {
    expect(shouldReload('abc', 'def', null)).toBe(true);
  });

  it('does not reload when the running build is the deployed one', () => {
    expect(shouldReload('abc', 'abc', null)).toBe(false);
  });

  it('does not reload when the deployed build cannot be read', () => {
    expect(shouldReload('abc', null, null)).toBe(false);
  });

  it('does not reload twice for one deployed build', () => {
    // The reload left the page on the old bundle, so the cached page did not
    // budge and a second reload would spin.
    expect(shouldReload('abc', 'def', 'def')).toBe(false);
  });

  it('reloads again once a further build is deployed', () => {
    expect(shouldReload('abc', 'ghi', 'def')).toBe(true);
  });
});

describe('fetchDeployedBuildId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (impl: () => Promise<unknown>) => {
    vi.stubGlobal('fetch', vi.fn(impl));
  };

  it('reads the id the build wrote', async () => {
    stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ buildId: 'abc' }) }));

    await expect(fetchDeployedBuildId()).resolves.toBe('abc');
  });

  it('bypasses the cache, which is the whole point of the fetch', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ buildId: 'abc' }) }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchDeployedBuildId();

    expect(fetchMock).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
  });

  it('reads nothing from a 404, which is what the dev server serves', async () => {
    stubFetch(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));

    await expect(fetchDeployedBuildId()).resolves.toBeNull();
  });

  it('reads nothing when the request fails, as it does offline', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));

    await expect(fetchDeployedBuildId()).resolves.toBeNull();
  });

  it('reads nothing from a body without a build id', async () => {
    stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ other: 1 }) }));

    await expect(fetchDeployedBuildId()).resolves.toBeNull();
  });
});

describe('the reload attempt', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('remembers the build it was made for', () => {
    writeReloadAttempt('def');

    expect(sessionStorage.getItem(VERSION_RELOAD_KEY)).toBe('def');
    expect(readReloadAttempt()).toBe('def');
  });

  it('is none until one is made', () => {
    expect(readReloadAttempt()).toBeNull();
  });
});
