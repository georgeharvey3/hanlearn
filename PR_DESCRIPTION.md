## Summary

Adds per-user rate limiting to Cloud Functions to prevent API abuse and control costs (closes #49).

- **New file `functions/src/rateLimit.ts`** — Firestore-based rate limiter that tracks request counts per user per function within a configurable time window. Uses Firestore transactions for atomicity across concurrent requests.
- **Modified `functions/src/index.ts`** — Applied rate limiting to `getDailyChengyu` (30 req/min) and `lookupChengyuChar` (60 req/min) immediately after authentication.
- **Updated `firestore.rules`** — Added deny-all rule for `rateLimits` collection so clients cannot tamper with rate limit counters directly.

## Key implementation details

- **Firestore-based storage**: Rate limit counters live in `rateLimits/{userId}/counters/{functionName}` with `count` and `windowStart` fields. This works across Cloud Functions instances (unlike in-memory counters).
- **Sliding window**: Each counter resets after its `windowMs` expires. When `count >= maxRequests` within the window, the function throws `HttpsError('resource-exhausted')` which maps to HTTP 429.
- **Retry info**: The error `details` include `retryAfterMs` so clients can display meaningful messages or auto-retry.
- **Extensible**: New functions just need a `RATE_LIMITS` entry and a one-line `checkRateLimit()` call — designed for the future translation function mentioned in the issue.

## Decisions and trade-offs

- **Firestore over in-memory/Redis**: Cloud Functions are stateless, so in-memory counters don't work across instances. Firestore is already in use, avoiding new infrastructure. Adds 1 read + 1 write per request, negligible at current scale.
- **Per-user only (no IP-based)**: All current functions require auth, so per-user limiting is sufficient. IP-based limiting noted as future work if unauthenticated endpoints are added.
- **Dictionary functions not rate-limited**: These are lightweight in-memory lookups with no external API costs and some don't require auth. Rate limiting them would add Firestore overhead without meaningful benefit.
- **No new dependencies**: Uses only Firestore (already available) — no `rate-limiter-flexible` or Redis needed.

## Files modified

| File | Change |
|------|--------|
| `functions/src/rateLimit.ts` | New — rate limit checker with Firestore transactions |
| `functions/src/index.ts` | Added rate limit checks to `getDailyChengyu` and `lookupChengyuChar` |
| `firestore.rules` | Added deny-all rule for `rateLimits` collection |

## Testing

- TypeScript compilation passes with no errors
- All 436 existing frontend tests pass (no regressions)
- Manual testing with emulators recommended for verifying 429 responses
