import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Per-function rate limit configurations.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  getDailyChengyu: { maxRequests: 30, windowMs: 60_000 },
  lookupChengyuChar: { maxRequests: 60, windowMs: 60_000 },
};

/**
 * Check and enforce rate limits for a user calling a specific function.
 *
 * Uses Firestore to track request counts per user per function within
 * a sliding time window. Throws resource-exhausted (HTTP 429) when
 * the limit is exceeded.
 */
export async function checkRateLimit(
  uid: string,
  functionName: string,
  config: RateLimitConfig
): Promise<void> {
  const db = admin.firestore();
  const counterRef = db
    .collection('rateLimits')
    .doc(uid)
    .collection('counters')
    .doc(functionName);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    const now = Date.now();

    if (!doc.exists) {
      transaction.set(counterRef, { count: 1, windowStart: now });
      return;
    }

    const data = doc.data()!;
    const windowStart = data.windowStart as number;
    const count = data.count as number;

    // Window expired — reset counter
    if (now - windowStart >= config.windowMs) {
      transaction.set(counterRef, { count: 1, windowStart: now });
      return;
    }

    // Check limit
    if (count >= config.maxRequests) {
      const retryAfterMs = config.windowMs - (now - windowStart);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Rate limit exceeded. Please try again later.',
        { retryAfterMs }
      );
    }

    // Increment counter
    transaction.update(counterRef, {
      count: admin.firestore.FieldValue.increment(1),
    });
  });
}
