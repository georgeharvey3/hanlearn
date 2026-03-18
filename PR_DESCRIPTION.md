## Summary

Fixes #224 — The Chengyu of the Day example sentence was not appearing because the client-side Firebase AI (Gemini via `firebase/ai` with `GoogleAIBackend`) was failing silently. This moves sentence generation to a server-side Cloud Function using Vertex AI, which is more reliable as it uses service account credentials rather than a client-side API key.

## Key changes

- **New Cloud Function `generateChengyuSentence`** (`functions/src/chengyuSentence.ts`) — generates example sentences server-side using Vertex AI (Gemini 2.0 Flash), with Firestore caching and rate limiting
- **Updated client service** (`web-client/src/services/chengyuSentenceService.ts`) — replaced client-side `firebase/ai` generation with a `httpsCallable` Cloud Function call. The 3-tier cache strategy is preserved: localStorage → Firestore (public read) → Cloud Function (auth required, handles AI + caching)
- **Added `@google-cloud/vertexai`** dependency to Cloud Functions for server-side Gemini access
- **Updated unit tests** to mock `firebase/functions` (httpsCallable) instead of `firebase/ai` (getGenerativeModel)
- **Added E2E test** that verifies the example sentence appears after solving the chengyu (seeds Firestore cache to avoid AI dependency in test environment)

## Architecture

The sentence generation flow is now:

1. **Client**: Check localStorage cache → fast, no network
2. **Client**: Check Firestore `chengyuSentences` cache → public read, works without auth
3. **Client**: Call `generateChengyuSentence` Cloud Function → requires auth
4. **Cloud Function**: Check Firestore cache (for concurrent requests) → generate via Vertex AI → cache in Firestore → return

This ensures that after the first authenticated user triggers generation for a given chengyu, all subsequent users (even unauthenticated) see the sentence instantly from the Firestore cache.

## Files modified

- `functions/src/chengyuSentence.ts` — **new**: Cloud Function for sentence generation
- `functions/src/index.ts` — export new function
- `functions/src/rateLimit.ts` — add rate limit config for new function
- `functions/package.json` — add `@google-cloud/vertexai` dependency
- `web-client/src/services/chengyuSentenceService.ts` — replace client-side AI with Cloud Function call
- `web-client/src/services/chengyuSentenceService.test.ts` — updated mocks and assertions
- `web-client/e2e/chengyu.spec.ts` — new E2E test for example sentence
- `web-client/e2e/fixtures/seed.ts` — add `seedChengyuSentence` helper
- `web-client/e2e/pages/dashboard.page.ts` — add `getChengyuCharacters` method

## Decisions & trade-offs

- **Server-side AI over client-side**: Client-side Firebase AI requires the Gemini/Generative Language API to be enabled on the project's API key, which was not working. Server-side Vertex AI uses service account credentials (ADC) which is the standard approach for Cloud Functions on Google Cloud.
- **Kept client-side Firestore cache read**: The Firestore `chengyuSentences` collection has public read rules, so unauthenticated users still benefit from cached sentences without needing to call the Cloud Function.
- **Rate limit of 10 req/min**: Sentence generation is expensive (AI call), so the rate limit is conservative. Most users will hit the cache anyway.
