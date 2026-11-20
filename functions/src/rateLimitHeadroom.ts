/**
 * When `textToSpeech` can start the synthesis before the rate limit answers
 * (#576).
 *
 * The rate-limit transaction takes about 0.5 s, as long as the synthesis.
 * Running the two at the same time halves the wait. But a call that the limit
 * then rejects has already spent one synthesis, so an unguarded overlap lets a
 * caller over the limit spend quota with no cap.
 *
 * The guard: a call overlaps only when this instance's last check for the
 * same user, in a window that is still open, left the count below half the
 * limit. Other instances can add to the count, and the half is the margin for
 * them. After a rejection the user does not overlap for a full window, so a
 * caller over the limit spends at most one synthesis per instance per window.
 * The first call of a user on an instance never overlaps.
 *
 * This module imports no Firebase package, so the test run needs no install
 * of `functions/`.
 */
export interface RateLimitState {
  count: number;
  windowStart: number;
}

export interface HeadroomConfig {
  maxRequests: number;
  windowMs: number;
}

export interface HeadroomOptions {
  now?: () => number;
  /** The users kept before the instance forgets them all. */
  maxUsers?: number;
}

export interface RateLimitHeadroom {
  canOverlap(uid: string): boolean;
  /** The state that an allowed check left. */
  record(uid: string, state: RateLimitState): void;
  /** The check rejected the call. */
  reject(uid: string): void;
}

export function rateLimitHeadroom(
  config: HeadroomConfig,
  { now = Date.now, maxUsers = 1000 }: HeadroomOptions = {}
): RateLimitHeadroom {
  const last = new Map<string, RateLimitState>();

  const keep = (uid: string, state: RateLimitState) => {
    if (!last.has(uid) && last.size >= maxUsers) last.clear();
    last.set(uid, state);
  };

  return {
    canOverlap(uid) {
      const state = last.get(uid);
      if (!state) return false;
      if (now() - state.windowStart >= config.windowMs) return true;
      return state.count < config.maxRequests / 2;
    },
    record: keep,
    reject(uid) {
      keep(uid, { count: config.maxRequests, windowStart: now() });
    },
  };
}
