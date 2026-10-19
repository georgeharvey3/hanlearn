# 16. Bury the other directions of a passed word

- Status: accepted, amended 2026-10-19 (a miss buries too)
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

When a session asks a word, the directions it did not ask are **buried**: each one due inside the bury window moves to the end of it.
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
- **A miss buries too.** A `lapse` or a `fail` buries by the same rule. Its
  interval is 0 to 3 days, so the siblings wait 2 or 3 days. See the amendment
  below.
- **A sibling due after the window keeps its date.** Burying never brings a
  direction forward.

`buryDays` and `buriedDueDate` in `utils/scheduling.ts` hold the
rules, and `finishTest` applies them in the same batch as the reschedule. The
write changes only existing `dueDate` fields, which `firestore.rules` already
accepts; a rules test covers the shape.

## Consequences

Good:

- In the same simulation, the share of sightings on the day after the previous
  one falls from 61% to 33%. That figure is from before the amendment, when
  lapses and failures buried nothing.
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

## Amendment, 2026-10-19: a miss buries too

The first version buried nothing after a `lapse` or a `fail`, so that a weak word
kept coming back. But its other directions then stayed due that same day. A
learner who missed a word, or used the hint that caps it at a lapse, in a morning
session met the same word in another direction in an afternoon session, with
the answer still fresh. That is the leak ADR 0005 avoids by asking one direction
per session, and a second session on the same day reopens it.

A miss now buries by the same rule as a pass. The word still comes back soon:
the missed direction's own interval brings it back the next day after a `fail`,
or within 1 to 3 days after a `lapse`, and the siblings follow a day or two
later. A miss on one skill is also no evidence that the others are weak.
