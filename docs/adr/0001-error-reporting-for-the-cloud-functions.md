# 1. Error reporting for the Cloud Functions

- Status: proposed
- Date: 2026-08-25
- Issue: #312
- Related: #282, #311

## Context

The Cloud Functions have no error reporting. `functions/package.json` has no
Sentry dependency and `functions/src` has no Sentry code. Every failure goes to
`console.error` and stays in Cloud Logging. Nobody reads Cloud Logging.

The web client is different. It has `@sentry/react` 10.43.0, and
`web-client/src/sentry.ts` starts it when `VITE_SENTRY_DSN` is present. The
deploy workflow passes this secret at build time.

Issue #282 shows the cost of the gap. `decomposeCharacter` was above its memory
limit for months. Three separate faults hid it:

1. The platform killed the instance before `console.error` ran, so Cloud
   Logging held only the platform message.
2. The handler caught the error and returned `{ components: [] }`. The client
   had no way to tell an empty result from a failure.
3. `DecompositionTree.tsx` discarded the error in a bare catch block, so Sentry
   held nothing.

PR #311 corrected the memory limit and the client-side catch blocks for this one
component. The other nine functions and most of the client still have the
pattern.

This decision record answers the four questions in issue #312.

## Decision

Report errors in two layers, because the two layers catch different classes of
failure.

### Layer 1: report in the process, with Sentry

Add `@sentry/google-cloud-serverless` to `functions/`. Start it once in
`functions/src/index.ts`. Then wrap the handler of each callable in a shared
helper that reports the error and calls `Sentry.flush()` before it returns.

Wrap the handler, not the exported function. `functions.https.onCall` returns a
Firebase function object with deploy metadata. The Sentry wrappers such as
`Sentry.wrapHttpFunction` expect a plain HTTP handler, so they remove that
metadata.

The flush is necessary. Cloud Functions freezes the CPU of the instance after
the response, so a queued event never leaves the process.

This layer catches every error that the handler can see. Examples are a thrown
exception, a non-2xx response from Vertex AI or Google TTS, a missing data file,
and a Firestore error.

### Layer 2: report from the platform, with Cloud Monitoring

Layer 1 cannot report an out-of-memory error. The platform kills the process, so
no reporter in that process runs. Sentry has the same limit as `console.error`
here. Two alert policies in Cloud Monitoring cover this class:

1. A log-based alert policy with a log-match condition on `resource.type=
   "cloud_function"` and the platform message for the kill.
2. A threshold alert policy on the memory use of the function, at about 85% of
   the limit. This one sends the alert before the kill, and it does not depend
   on a message string.

Send both to the same email address as the Sentry alerts.

## Comparison of the two methods

Question 1 in issue #312 asks whether Sentry in the functions gives value over
Cloud Logging with a log-based alert.

| | Sentry in the functions | Cloud Logging with a log-based alert |
|---|---|---|
| Stack trace | Yes, with source context | Only the text that `console.error` printed |
| Grouping | Yes, by fingerprint | No |
| Release and commit | Yes | No |
| Link to the client error | Yes, same organization and trace | No, two separate systems |
| Reports an out-of-memory error | No | Yes |
| Cost | Included in the current account | Free today |
| Effort | One module, ten call sites, one secret | Two policies, once |

Sentry costs nothing more. The account is already open for the web client. The
free Developer plan is enough for ten functions with this traffic, and the paid
plans include 50,000 errors per month.

Cloud Monitoring alerting is free today. Google will start to charge no sooner
than 1 September 2027. A log-match condition returns no points, so the future
charge per point does not apply to it. Prefer a log-based alert policy over a
user-defined log-based metric, because a log-based metric is a chargeable custom
metric.

### Alternatives that this record rejects

**Cloud Logging alone.** It gives no grouping, no stack trace, and no release.
The alert is an email with one log line. It also keeps the client error and the
server error in two systems. As a result, the question in issue #282 ("Was it
caught by Sentry?") stays hard to answer.

**Sentry alone.** It cannot report an out-of-memory error, a timeout, or a crash
before `Sentry.init` runs. These are the exact failures of issue #282.

## Which errors send an alert

Question 2 asks which errors are normal. The rule is one line:

> Report the error, unless the code of the `HttpsError` says that the caller is
> at fault.

| Class | Examples | Action |
|---|---|---|
| Caller fault | `unauthenticated`, `invalid-argument`, `resource-exhausted`, `not-found` | Do not report. Add a tag or a breadcrumb only. |
| Service fault | `internal`, any exception that is not an `HttpsError`, a non-2xx response from Vertex AI or Google TTS, a missing bundled data file, a Firestore error | Report to Sentry. Sentry sends the alert for a new error. |
| Platform fault | Out of memory, timeout, container crash | Cloud Monitoring sends the alert. No reporter in the process runs. |

A rate limit error is normal, so `resource-exhausted` from `checkRateLimit` stays
silent. An out-of-memory error is not normal, so it always sends an alert.

## Which handlers must throw

Question 3 asks which handlers must throw instead of a return of an empty
result.

| Function | Behavior today | Decision |
|---|---|---|
| `decomposeCharacter` | Catches every error and returns `{ components: [] }` (`decompose.ts:154`, `decompose.ts:160`) | Throw `internal`. Keep `{ components: [] }` only when HanziJS has no decomposition for the character, which is a true answer. |
| `decomposeCharacter`, `ensureCharDefinitions` | Logs the error and continues with `{}` for the life of the instance (`decompose.ts:56`) | Keep the fallback, but report the error. The file is absent in production only when the build is broken, so it must send an alert. |
| `decomposeCharacter`, `describeComponent` | Silent catch around the radical lookup (`decompose.ts:82`) | Keep it silent. This is normal for an unusual component. |
| `getDailyChengyu` | Returns `{ chengyu: null, options: [], correct: '', char_results: [] }` when the `chengyus` collection is empty (`index.ts:109`) | Throw `internal`. An admin manages this collection, so an empty result means broken data or broken rules. The client cannot show `null` anyway. |
| `lookupChengyuChar` | Returns empty arrays for an unknown character | Keep it. An empty result is a true answer here. |
| The five `dictionary*` functions | No try block. A failure of `loadDictionary` becomes `internal` | Keep the throw. Add the report. |
| `textToSpeech` | Throws `internal`, with `console.error` only (`tts.ts:84`, `tts.ts:98`) | Keep the throw. Add the report. |
| `scoreSimilarity` | Throws `internal`, with `console.error` only (`similarity.ts:145`) | Keep the throw. Add the report. |

This changes the contract of `decomposeCharacter`. Today `{ components: [] }`
means both "this character has no components" and "the function failed". After
the change, the client gets a `functions/internal` error for the second case and
can offer a retry. `DecompositionTree.tsx` reports the error since PR #311, so
it needs only the retry.

## How to detect an out-of-memory error

Question 4 asks for a method that detects a failure that kills the process.

1. Add the two Cloud Monitoring alert policies from Layer 2 above.
2. Make sure that the log-match string is correct. Read a real event in Cloud
   Logging first. The message is not the same for 1st gen and 2nd gen functions.
3. Make sure that the metric name for the memory of the function is correct.
   Read it in Metrics Explorer. Do not copy it from a document.
4. Set an explicit `runWith({ memory })` on every function. Then the limit is a
   decision, and not the 1st gen default of 256 MB.

The threshold policy on memory is better than the log-match policy. It does not
depend on a message string, and it sends the alert before the kill. Keep both,
because the threshold policy misses a fast increase in memory use inside one
invocation.

## A related risk that this review found

The five `dictionary*` functions call `loadDictionary()`. That function reads
`functions/data/dictionary.json` (15.9 MB) and builds two `Map` indexes over all
of the entries. No function in `dictionary.ts` sets `runWith()`, so each one
runs at the 1st gen default of 256 MB.

A measurement of the same work on Node 22, on a desktop, gives this result:

```
124259 entries, 379 ms, peak RSS 188 MB, post-GC RSS 182 MB, heapUsed 107 MB
```

188 MB plus the baseline of `firebase-functions` and the Admin SDK is near the
limit of 256 MB. This is the failure mode of issue #282, and no alert covers it
today. A measurement in the deployed runtime is necessary, and these functions
probably need a higher limit.

## The web client

Issue #312 also asks for a review of the catch blocks in the web client. These
blocks discard the error today.

Silent degradation, which is the worst class here:

- `services/ttsService.ts:149` — sets `_googleTtsAvailable` to `false` and moves
  to the native speech synthesis. An outage of Google TTS degrades every user
  for the rest of the session and reports nothing.
- `components/Test/SentenceWrite/SentenceWrite.tsx:387` and
  `components/Test/SentenceRead/SentenceRead.tsx:362` — `.catch(() => ...)`
  sets the score to `null`. Every failure of `scoreSimilarity` is invisible.
- `components/Test/NewWords/NewWord/NewWord.tsx:108` — a failed lookup becomes
  the string `(lookup failed)` in the user interface.

Discarded errors:

- `components/Test/useTestEngine.ts:454`, `:488`, `:529` — `catch (e) { // ignore }`
  around HanziWriter.
- `components/Test/useTestEngine.ts:235` — `.catch(() => null)` on a word fetch.
- `components/Test/NewWords/NewWord/NewWord.tsx:178` — a failed pre-fetch.
- `components/Home/Chengyu/Chengyu.tsx:71` — `.catch(() => setExampleSentence(null))`.
- `components/TestChengyusTest/TestChengyusTest.tsx:88` — shows a message only.

Console only, with no report:

- `containers/AddWords/AddWords.tsx:300`
- `containers/Dashboard/Dashboard.tsx:59`
- `components/Test/SentenceRead/SentenceRead.tsx:309`
- `components/Test/SentenceWrite/SentenceWrite.tsx:228`
- `services/sentenceService.ts:102` — the AI returned invalid JSON.

Acceptable as they are:

- `firebase/config.ts:33` and `:38` — Performance and Analytics do not start.
  These are not critical, and `console.warn` is enough.
- `services/sentenceService.ts:146`, `:155` and
  `services/chengyuSentenceService.ts:78`, `:87` — a cache read or a cache write
  failed. The code has a correct fallback.
- `services/decompositionService.ts` — no catch block. The error goes to the
  caller, which is correct.

`store/actions/word.ts` and `store/actions/auth.ts` are the model to copy. Each
catch block there writes to the console, reports to Sentry, and shows a
notification.

The client and the functions will both report a failure of the same call. This
is correct, because the client event holds the user impact and the function
event holds the cause. Tag them `layer:client` and `layer:functions` to keep
them apart.

## Consequences

Good:

- A failure of a Cloud Function reaches an inbox that somebody reads.
- An out-of-memory error and a timeout become visible, which they were not
  before.
- The client can tell a failure from an empty result, so it can offer a retry.
- The client event and the function event for one user action are in the same
  organization.

Bad:

- The functions get a new dependency and a new secret to hold the DSN.
- `Sentry.flush()` adds latency to a failed call. Use a timeout of 2000 ms.
- The number of Sentry events increases. Watch the quota for one month.
- The alert policies live in the Google Cloud console, and not in this
  repository. Record them in this file, or move them to Terraform later.

## Out of scope

The five `dictionary*` functions have no `verifyAuth` call and no rate limit.
Every other callable has both. This is a security question and not an error
reporting question, so this record only records it.

## Work that follows

Issue #312 asks for separate issues for the work. This record proposes five:

1. Add Sentry to the Cloud Functions, with a shared report helper and a flush.
2. Add the Cloud Monitoring alert policies, and set an explicit memory limit on
   every function.
3. Make `decomposeCharacter` and `getDailyChengyu` throw instead of a return of
   an empty result, and handle the error in the client.
4. Report the discarded errors in the web client, from the list above.
5. Measure the memory headroom of the `dictionary*` functions in the deployed
   runtime.
