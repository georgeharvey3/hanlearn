# 16. Bury the other directions of a passed word

- Status: accepted
- Date: 2026-10-16
- Issue: #377
- Related: [0002-direction-level-scheduling.md](0002-direction-level-scheduling.md),
  [0003-direction-choice-by-oldest-due.md](0003-direction-choice-by-oldest-due.md),
  [0005-new-words-take-one-direction.md](0005-new-words-take-one-direction.md),
  [0009-fsrs.md](0009-fsrs.md)

## Context

A session asks each word once, in one direction: the one due longest (ADR 0003).
Only that direction is rescheduled. The directions of a word are often due on
the same day: a new word, a word that passed or failed as a whole, a migrated
word, or directions that simply landed close together. The ones the session did
not ask stay due, so the word comes back the next day, and the day after, until
each direction has had its turn.

A word with five due directions therefore takes a slot in about five sessions in
a row. The learner sees the same word every day, and the interval FSRS gave the
answered direction never shows up as a gap.

A simulation of one new word over 120 days of daily sessions, with recall drawn
from the FSRS retrievability, puts 61% of its sightings on the day after the
previous one.

## Decision

When every direction a session asked of a word passed, the directions it did not
ask are **buried**: each one due inside the bury window moves to the end of it.
This is what Anki does for the cards of one note.

- **How far.** The window is the shortest interval the session gave the word,
  held between 2 and 7 days (`MIN_BURY_DAYS`, `MAX_BURY_DAYS`). The gap between
  two sightings of a word then follows the interval it was just given. Two days
  is the least that keeps a sibling off the next day. A week is the most, so a
  mature direction's long interval does not hold an overdue sibling back for a
  month.
- **Only the due date moves.** Stability, difficulty, interval, last review and
  the counters stay as they were. FSRS reads the elapsed days at the next
  review, so a sibling asked late gets the longer interval a late correct answer
  earns. The derived top-level `dueDate` follows from the map as before.
- **No burial after a failed retrieval.** A `lapse` or a `fail` on any asked
  direction buries nothing, so a weak word keeps coming back.
- **A sibling due after the window keeps its date.** Burying never brings a
  direction forward.

`shouldBury`, `buryDays` and `buriedDueDate` in `utils/scheduling.ts` hold the
rules, and `finishTest` applies them in the same batch as the reschedule. The
write changes only existing `dueDate` fields, which `firestore.rules` already
accepts; a rules test covers the shape.

## Consequences

Good:

- In the same simulation, the share of sightings on the day after the previous
  one falls from 61% to 33%. What remains comes from lapses and failures, which
  bury nothing on purpose.
- The learner meets a word at gaps that follow its intervals, and each session
  holds more distinct words.

Bad:

- A word takes longer to reach bank 5 in all five directions, since its siblings
  wait up to a week each. ADR 0005 already accepted a slower start for the four
  directions a new word's first session does not ask.
- A buried sibling is reviewed later than its own schedule asked. FSRS credits
  the delay, and `reviewStats` measures the retention per direction, which
  should not drop for the buried directions. If it does, the window shrinks.
- The two bounds are a starting point to tune, not a result.

## Alternatives

- Ask more than one direction of a word in a session. ADR 0005 rejected this,
  because one question on a word leaks the answer to the next.
- Schedule at word level and pick the direction inside the review. This undoes
  ADR 0002's per-direction memory, which is what lets the three skills advance
  at their own rates.
