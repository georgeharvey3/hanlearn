# 21. Sentence tasks are a separate practice, outside the scheduler

- Status: accepted
- Date: 2026-11-04
- Issue: #489
- Amends: [0011-gate-the-write-stage-on-partial-mastery.md](0011-gate-the-write-stage-on-partial-mastery.md)

## Context

The sentence tasks were the last step of the study session, and they recorded
nothing. They made the session longer, and the learner felt that they had no
purpose. The developer could not measure them either (#458).

## Decision

The sentence tasks live in two tabs, Comprehend and Compose, and the session
ends with its cards.

A sentence result never changes the schedule of a word. To recognize a word in
a sentence is not the retrieval of any one direction. Sentence results in FSRS
would also blur the measurement in `reviewStats`. The result orders the queue
of its tab, and `sentenceLog` records it.

The state of the queue lives in `sentencePractice/{wordId}`, not on
`userWords`. Thus the documents of the scheduler and their rules carry no
sentence state.

## Considered options

- Keep the step in the session and record its results. The session stays long,
  and the step has no purpose for the learner.
- Feed a sentence miss to FSRS as a lapse. Rejected for the reasons above.
- A field on `userWords`. Each grade would then write the document of the
  scheduler.

## Consequences

- ADR 0011 still holds for Compose, because production waits for partial
  mastery. `readyForCompose` and `COMPOSE_BANK` replace `readyForWriteStage` and
  `WRITE_STAGE_BANK`.
- Comprehend now has a gate of its own, at bank 2, because the tab has no
  session and "new word" has no meaning there. This replaces the decision of
  ADR 0011 that the Read stage fires on novelty.
- A word with a direction due within 2 days is not eligible, because a sentence
  primes the answer of its card review. A `fail` from today is due tomorrow, so
  the rule also keeps today's misses out.
- The "Translate sentences", "Make sentences" and "Translate with all words"
  settings are gone. The app ignores their saved values.
- A grade is saved when the learner makes it, so a set needs no resume.
