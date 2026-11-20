import { describe, it, expect, vi } from 'vitest';
import { cachedAccessToken } from './accessToken';

describe('cachedAccessToken', () => {
  it('reuses one token until a minute before it expires', async () => {
    let time = 0;
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'first', expires_in: 3600 })
      .mockResolvedValueOnce({ access_token: 'second', expires_in: 3600 });
    const getToken = cachedAccessToken(fetchToken, { now: () => time });

    expect(await getToken()).toEqual({ token: 'first', cached: false });
    time = 3_539_000;
    expect(await getToken()).toEqual({ token: 'first', cached: true });
    time = 3_540_000;
    expect(await getToken()).toEqual({ token: 'second', cached: false });
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch between calls that come at the same time', async () => {
    const fetchToken = vi.fn().mockResolvedValue({ access_token: 'only', expires_in: 3600 });
    const getToken = cachedAccessToken(fetchToken, { now: () => 0 });

    const [a, b] = await Promise.all([getToken(), getToken()]);

    expect(a.token).toBe('only');
    expect(b.token).toBe('only');
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('fetches again after a fetch that fails', async () => {
    const fetchToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('metadata server'))
      .mockResolvedValueOnce({ access_token: 'retry', expires_in: 3600 });
    const getToken = cachedAccessToken(fetchToken, { now: () => 0 });

    await expect(getToken()).rejects.toThrow('metadata server');
    expect(await getToken()).toEqual({ token: 'retry', cached: false });
  });
});
