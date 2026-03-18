## Summary

Fixes #223 — Sentence similarity scoring was returning a 500 error because the `scoreSimilarity` Cloud Function relied on Vertex AI text embedding API calls that were failing in production.

**Root cause:** The Cloud Function at `functions/src/similarity.ts` made raw HTTP requests to the Vertex AI embedding endpoint (`us-central1-aiplatform.googleapis.com`), which required the Vertex AI API to be enabled and properly authenticated in the GCP project. This was failing with a 500 error.

**Fix:** Replaced the Cloud Function approach with a client-side implementation using Firebase AI (Gemini), the same infrastructure already used successfully by `sentenceService.ts` for generating example sentences. This eliminates the dependency on Vertex AI embeddings and the associated Cloud Function.

## Key Implementation Details

- **`similarityService.ts`** — Rewrote to use Gemini (`gemini-2.5-flash-lite`) via Firebase AI SDK directly on the client, instead of calling the `scoreSimilarity` Cloud Function via `httpsCallable`. The service asks Gemini to compare two sentences and return a 0–100 similarity score with JSON output mode.
- The public API (`getSimilarityScore`) is unchanged — components (`SentenceRead`, `SentenceWrite`) required no modifications.
- Score clamping (0–100) and `rawSimilarity` (0–1) are preserved for backward compatibility with the UI.

## Decisions & Trade-offs

- **Client-side vs Cloud Function:** Moving scoring to the client simplifies infrastructure (no Vertex AI API setup, no Cloud Function deployment needed) and mirrors the existing pattern used by sentence generation. The trade-off is that scoring is no longer server-validated, but since it's used for informal feedback (not grading), this is acceptable.
- **Gemini prompt-based scoring vs embeddings:** Using Gemini to evaluate similarity via a prompt is less mathematically precise than cosine similarity of embeddings, but is more reliable and doesn't require additional GCP API enablement. The scoring guide in the prompt provides consistent, pedagogically useful feedback.
- **Cloud Function not removed:** The `scoreSimilarity` Cloud Function in `functions/src/similarity.ts` is left in place to avoid a breaking deployment. It can be cleaned up separately.

## Files Modified

- `web-client/src/services/similarityService.ts` — Rewrote to use Firebase AI (Gemini) instead of Cloud Function
- `web-client/src/services/similarityService.test.ts` — New unit tests for the rewritten service (6 tests)
- `web-client/e2e/sentence-similarity.spec.ts` — New E2E tests for sentence similarity scoring flow (2 tests)

## Test Plan

- [x] All 1056 unit tests pass (65 test files)
- [x] New `similarityService.test.ts` covers: score parsing, clamping, language labels, error propagation
- [x] E2E tests written for: successful score display, error fallback ("Score unavailable")
- [ ] E2E tests require Firebase emulators (run in CI)
