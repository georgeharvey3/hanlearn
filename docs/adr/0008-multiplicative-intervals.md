# 8. Multiply the interval, and measure it from the review date

- Status: accepted
- Date: 2026-09-01
- Issue: #330
- Related: [0002-direction-level-scheduling.md](0002-direction-level-scheduling.md),
  [0007-grade-the-first-attempt.md](0007-grade-the-first-attempt.md)

## Context

`LEVEL_INTERVALS` gave a table of five fixed steps: 1, 3, 7, 30 and 60 days. The
bank of a direction selected a row of the table, and `finishTest` added that
number of days to the date of the session.

This design has three faults.

A table of five numbers is the same for every word and for every learner. A word
that a learner finds easy and a word that they find hard get the same schedule.

The last step is 60 days. A learner who knows a word for years answers it six
times a year for ever, and the queue holds work that gives no learning value.

The new due date came from the date of the session. A learner who answered a
30 day direction correctly on day 60 proved a memory that was more stable than
the schedule expected. The old calculation discarded this evidence and gave the
same 60 days as an answer on day 30.

FSRS (#331) corrects all three faults with a model that fits the review log of
the learner. FSRS needs a review log, a port of the algorithm, and a target
retention setting. This decision is the step before it.

## Decision

Each direction carries an interval in days, an ease, and the date of its last
review. The grade of a question moves the interval and the ease.

| Grade   | Interval                       | Ease   |
| ------- | ------------------------------ | ------ |
| `pass`  | (interval + delay / 2) × ease  | + 0    |
| `lapse` | interval × 0.5, at least 1 day | − 0.15 |
| `fail`  | 0                              | − 0.2  |

The ease starts at 2.5 and stays between 1.3 and 3.0. The delay is the number of
days that the review ran later than the schedule asked for. A pass adds at least
one day, so the first pass of a direction moves it from 0 days to 1 day. The
maximum interval is 365 days.

An interval of 0 is a direction that no learner has answered correctly, or one
that a failure reset. The schedule asks such a direction again the next day.

The formula for a pass comes from the Anki v2 scheduler. Half of the delay is
credit, and half is not, because a late answer is evidence of stability and also
evidence that the learner saw the word somewhere else.

The due date takes a fuzz of up to 5% of the interval, in both directions. An
interval of less than 3 days takes no fuzz. Without the fuzz, the words that a
learner adds on one day come back on one day for ever.

The bank is derived now. The interval gives it:

| Interval        | Bank |
| --------------- | ---- |
| 0 days          | 1    |
| 1 to 6 days     | 2    |
| 7 to 29 days    | 3    |
| 30 to 59 days   | 4    |
| 60 days or more | 5    |

The five bands are the five steps of the table that the interval replaces. A
document that holds a bank and no interval therefore keeps the schedule it had:
the read path seeds the interval from the bank with the same five numbers, and
the bank of that interval is the bank the document holds.

No migration runs. A direction gains the three new fields when a session next
asks it, and a direction that no session asks keeps the bank and the due date
that it holds.

## Consequences

Good:

- A well-known word leaves the queue for up to a year, and the queue holds the
  words that the learner does not know.
- Two directions of one word grow apart. The ease of a direction that the
  learner lapses again and again drops, and its interval grows more slowly.
- A late correct review gives the learner credit for the days that they waited.
- The new state is the state that FSRS needs. `lastReview` is the field that a
  review log is built from, and #331 replaces the arithmetic and not the shape.

Bad:

- The bank is a band of the interval now, and not a count of correct answers.
  A learner needs six correct answers to reach bank 5, and four were enough
  before. The level distribution of the dashboard moves down for one or two
  sessions after the release.
- "Mastered" on the dashboard means an interval of 60 days or more. This is a
  stronger claim than the old bank 5, which one more correct answer could reach
  from bank 4 after 30 days.
- The ease is a single number for a direction, and it holds no memory of when
  the lapses happened. FSRS models this correctly. The ease is a heuristic.
- The fuzz makes a due date non-deterministic. The tests of the interval
  calculation pass their own random function, and the tests of `finishTest`
  accept a range.

## Alternatives

**Keep the bank as its own state machine, and add the interval beside it.** ADR
0007 gave the bank three transitions, and they could stay. Two state machines
for one concept can disagree, and the bank would then be a number that means
nothing to the schedule. The derived bank keeps one source of truth.

**Take the full elapsed days as credit.** A learner who returns after 300 days
and answers one question correctly reaches the cap in one review. Half of the
delay is the rule that Anki uses, and it is the safer of the two.

**Go directly to FSRS.** FSRS needs a review log to fit its parameters, and the
app holds none. This change writes `lastReview`, which is the first field of
that log. It also gives a schedule that the learner benefits from now.
