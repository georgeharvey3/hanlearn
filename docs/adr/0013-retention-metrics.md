# 13. Measure the scheduler with a daily rollup

Date: 2026-09-02

## Status

Accepted

## Context

The scheduler has changed a great deal: FSRS replaced the fixed interval table
(ADR 0009), each direction gained its own state (ADR 0002), the first attempt
became the grade (ADR 0007), and a failure now demotes rather than resets
(ADR 0010). None of it is measured. Whether the changes helped is unknown, and
the next change to the schedule would be made just as blindly.

Four measurements answer the questions actually being asked:

- **True retention per question type** — the share of reviews whose first
  attempt was correct. FSRS aims at 0.9, and a figure far from the 0.85 to 0.90
  band means the schedule is asking at the wrong time.
- **Promotion rate and stall rate per question type** — whether `CM` is the
  bottleneck the direction split was meant to unblock.
- **Median interval of mature words** — whether the intervals are climbing.
- **Review load ahead** — whether the load of the words already added is about
  to outgrow the time the learner has.

The last two are properties of the words as they stand: every direction already
carries an interval and a due date, so they need no new data at all. The first
two are properties of the reviews, and a review leaves no trace. `finishTest`
overwrites the direction it reschedules, and `testCompletions` records only that
a session happened, not what was in it. So retention and promotion cannot be
computed from anything stored today, and nothing can be backfilled: the
measurement starts from the release.

## Decision

Record the reviews as a **daily rollup**, one document per user per day at
`users/{userId}/reviewStats/{YYYY-MM-DD}`, holding six counters per direction:
`attempts`, `reviews`, `reviewPasses`, `promoted`, `held` and `demoted`.

Every counter is a `FieldValue.increment`, and the write joins the batch that
`finishTest` already commits. A session therefore costs one extra write, and it
records what it scheduled and what it measured together or not at all — the
counts can never describe reviews that did not happen. Reading a user's whole
history is one query bounded by the days they have studied.

`attempts` counts every graded question. `reviews` counts only the attempts on a
direction that had already been recalled once, and `reviewPasses` the correct
first attempts among those. **True retention is `reviewPasses / reviews`**: a
first meeting with a word is not a test of memory, and counting it would drag
the figure down by however much new material the learner happens to be adding.
This is the distinction Anki draws between learning cards and review cards.

Promotion and stall are measured over `attempts` rather than `reviews`, because
a new word climbing from bank 1 to bank 2 is a real promotion, and the question
those two rates answer is whether a question type is moving at all.

The bank bands are coarse, so a pass that grows an interval from 8 days to 20
counts as **held**, not promoted. That is the intended reading: the stall rate
is about crossing bands, and the median interval is what shows growth inside
one.

A direction is **mature** at an interval of 21 days or more, the threshold Anki
uses. Retention is withheld below 20 reviews in the window, because the first
handful of reviews give a figure that swings between 0 and 1 and invites a
conclusion the data does not support.

The metrics live on a `/stats` page of their own, not on the Dashboard. The
Dashboard's job is to get the learner into a session in as few taps as possible,
and four diagnostic panels in the way of that is the opposite of what it is for.

## Consequences

- Retention and promotion start empty and fill in from the first session after
  the release. There is no backfill, and the `/stats` page says so rather than
  showing a misleading zero.
- The rollup cannot answer per-word questions — "which words fail most", "is
  this leech getting better". Those need per-review documents, which is roughly
  twenty to forty writes a session and an unbounded collection. If the need
  arises, the rollup stays and the log is added beside it.
- The counters only ever grow, so the Firestore rules check shape and sign
  rather than value, and a replayed write cannot corrupt a day beyond
  double-counting a session that did commit.
- Both interval metrics read `interval`, which a direction only gains when a
  session next asks it. Until then the bank seeds the value, exactly as the
  scheduler does, so no migration is needed and no word is missing from the
  count.
- The load forecast reads only the words the learner already has. It excludes
  new words and the reviews that today's failures will produce, so it is a floor
  and not a prediction.
