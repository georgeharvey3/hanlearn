# 10. Demote a failed direction instead of resetting it, and flag the leeches

- Status: accepted
- Date: 2026-09-02
- Issue: #332
- Related: [0007-grade-the-first-attempt.md](0007-grade-the-first-attempt.md),
  [0008-multiplicative-intervals.md](0008-multiplicative-intervals.md),
  [0009-fsrs.md](0009-fsrs.md)

## Context

The calculation that ADR 0008 replaced sent a direction back to bank 1 whenever
the learner did not recall it. A full reset throws away every review that the
direction survived, so a word the learner has known for four months and one they
met yesterday come back on the same schedule.

The research agrees on a middle position. A full reset is not optimal, and full
preservation of the interval is also harmful, because a direction that keeps its
interval through failure after failure takes a long time to stand out as one the
schedule is not fixing. SuperMemo reports that the first interval after a lapse
is typically one to four days.

ADR 0009 already moved most of the way there. FSRS reads a failure as the Again
rating, and the stability after Again is a function of the stability before it,
so the direction keeps some of what it learned. Two gaps are left.

The first is a guarantee. Nothing in this app states that a failed retrieval
cannot leave a direction more stable than it was. The FSRS-6 formula holds to it
in `ts-fsrs` 5.4.2, in one clamp inside `next_state`, but that is a property of
a library the app does not own, tested by nothing here.

The second is the interval. FSRS gives a direction with a very high stability
four or five days after a lapse. That is outside the range SuperMemo reports,
and it is a long time to wait for a word the learner has just got wrong.

Nothing counts the failures at all, so no part of the app can tell a direction
the schedule is working on from one it is not.

## Decision

### The demotion

A failed retrieval demotes a direction. It never resets it, and it never leaves
it more stable than it was.

`nextMemory` clamps the stability after a `lapse` or a `fail` to the stability
the direction held. The clamp states the rule the schedule depends on rather
than inheriting it from the FSRS weights, and it holds if a release of
`ts-fsrs` changes them.

A direction that has never been passed holds no stability to demote. The failed
attempt is the learner meeting the word rather than forgetting it, so FSRS seeds
the first stability and the clamp does not apply.

### The first interval after a lapse

A lapse takes the day FSRS names, capped at **3 days**. A failure is unchanged:
it takes an interval of 0, which is the next day. Together the two grades put
every failed retrieval inside the one-to-three-day range.

| Grade   | Interval before this ADR | Interval now                    |
| ------- | ------------------------ | ------------------------------- |
| `pass`  | the day FSRS gives       | unchanged                       |
| `lapse` | the day FSRS gives       | the day FSRS gives, capped at 3 |
| `fail`  | 0, so the next day       | unchanged                       |

The cap moves only the most stable directions. A direction at 30 days that
lapses already came back in 2 days; one at a year came back in 5.

### The leech rule

Each direction counts the retrievals it has lost, in a `lapses` field. A `lapse`
and a `fail` both count, because both mean the learner did not recall the
answer. A failure on a direction that has never been passed does not count: this
is the same event Anki counts as a lapse, an Again on a card that has already
graduated.

A direction with **8 or more** lapses is a **leech**. Eight is the default of
Anki.

A leech is **flagged and not suspended**. The word list shows a "Hard to recall"
chip on the word, naming each direction that has reached the threshold. The
schedule does not change: the direction stays in the queue and comes back when
it is due.

The count is never cleared. A pass does not clear it, so a flag stays until the
learner acts on it.

No migration runs. A direction written before the counter existed has no
`lapses` field, it reads as 0, and it starts counting from its next failure.

## Consequences

Good:

- The app owns its own demotion rule, and a test states it. A release of
  `ts-fsrs` that changes the weights cannot quietly turn a lapse into a promotion.
- Every failed retrieval comes back inside three days, whatever the direction
  held before it.
- The learner can see which of the five directions of a word is the one that is
  not going in, rather than only that the word is hard.
- The count is the input a later feature needs, whether that is a leech filter,
  a dashboard figure, or a prompt to rewrite the meaning.

Bad:

- A learner who lapses a mature direction sees it more often than FSRS asks for,
  which is a review the model says is not needed.
- The threshold of 8 is the Anki default, and it counts a different population:
  this app counts per direction, and its `lapse` grade includes a question the
  learner answered correctly on the second attempt. The right number for this
  app needs data the app does not collect yet.
- The word list is the only surface. A learner who does not open it does not see
  the flag.
- A direction that reached 8 lapses years ago and is now solid still carries the
  flag.

## Alternatives

**Suspend the leech.** Anki suspends by default, and the direction stops being
asked until the learner unsuspends it. This app does not: a suspended direction
is a word the learner asked to learn that silently stops appearing, and the
learner has to find the suspension to understand why. Flagging gives them the
same information and leaves the decision with them.

**Clear the count on a pass.** A leech that the learner has fixed then stops
being a leech on its own. It also hides the history that makes the flag useful:
a direction that alternates between a pass and a failure never reaches the
threshold, and that is exactly the direction worth showing.

**Set the cap at 4 days, the top of the SuperMemo range.** The issue asks for 1
to 3. Three days keeps a failed direction inside the week even after the fuzz,
and the difference between three and four days only reaches the directions with
the highest stability.

**Leave the stability clamp to `ts-fsrs`.** The library already holds to it. The
clamp is four lines and one test, and it makes the guarantee the app's own
rather than a property of a dependency's default weights.
