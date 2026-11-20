/**
 * Keep one access token for the life of the instance (#576).
 *
 * `admin.credential.applicationDefault()` builds a new credential on each
 * call, and that credential asks the metadata server for a new token. A token
 * lasts about an hour, so a warm instance needs one fetch an hour, not one on
 * each call. The token is renewed a minute before it expires, so that a call
 * never sends a token that expires on the way.
 *
 * This module imports no Firebase package, so the test run needs no install
 * of `functions/`.
 */
export interface FetchedToken {
  access_token: string;
  /** The life of the token, in seconds. */
  expires_in: number;
}

export interface AccessToken {
  token: string;
  /** True when the token came from the cache, with no fetch. */
  cached: boolean;
}

export interface AccessTokenOptions {
  now?: () => number;
}

const RENEW_BEFORE_EXPIRY_MS = 60_000;

export function cachedAccessToken(
  fetchToken: () => Promise<FetchedToken>,
  { now = Date.now }: AccessTokenOptions = {}
): () => Promise<AccessToken> {
  let kept: { token: string; renewAt: number } | null = null;
  let pending: Promise<AccessToken> | null = null;

  return async () => {
    if (kept && now() < kept.renewAt) return { token: kept.token, cached: true };
    if (pending) return pending;

    pending = fetchToken()
      .then((fetched) => {
        kept = {
          token: fetched.access_token,
          renewAt: now() + fetched.expires_in * 1000 - RENEW_BEFORE_EXPIRY_MS,
        };
        return { token: fetched.access_token, cached: false };
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
