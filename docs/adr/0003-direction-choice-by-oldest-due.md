# 3. The session asks the direction with the oldest due date

- Status: accepted
- Date: 2026-08-27
- Issue: #328
- Related: #306
- Supersedes: the third entry under "Consequences / Bad" in
  [0002-direction-level-scheduling.md](0002-direction-level-scheduling.md)

## Context

A session asks each word once, so it must choose one of the five directions.
The first version of the session queue used the fixed order of `DIRECTIONS`,
which is `MC`, `MP`, `PM`, `PC`, `CM`. The intent was a rotation: the direction
that passes takes a later due date, so the next session reaches the next
direction in the list.

The rotation does not start. All five directions of a word hold the same due
date whenever the word is new, wholly passed, or wholly failed, and the
migration in ADR 0002 copies one due date into all five. Every direction of such
a word is therefore due together, the fixed order takes the first of them, and
the session asks `MC` of every word until `MC` passes. A learner sees one
direction for the whole session.

ADR 0002 records this effect and accepts it:

> Queue position, not the interval, then decides when a direction comes back.
> This is accepted, and the plan on issue #328 records the reasoning.

That acceptance was made before the queue existed. In use the result is a
session of one direction, which is worse than the all-or-nothing promotion that
ADR 0002 set out to remove.

## Decision

Rank the due directions of a word by their own due dates, oldest first, and ask
the first of them.

Directions that share the oldest due date are interchangeable, because the
schedule holds no information that separates them. Choose between them in this
order:

1. The `priority` direction, if the learner set one and it is in the tied group.
   See [0004-priority-breaks-ties-only.md](0004-priority-breaks-ties-only.md).
2. A random choice, seeded from the day and the word.

The seed mixes the word into the day seed. `seededShuffle` is a linear
congruential generator, so one seed over one tied set returns one permutation.
A seed of the day alone gives every word in step the same direction, which is
the original fault in a new form.

Practice mode keeps an unseeded random choice. Practice reschedules nothing, so
all five directions stay tied forever, and a seeded choice repeats for the rest
of the day. A learner runs practice more than once in a sitting.

## Consequences

Good:

- A word in step gives a different direction from the next word in step, so a
  session covers all five directions.
- A direction that falls behind outranks one that is ahead, so no direction
  starves. The fixed order gave this property only in theory.
- A reload on the same day rebuilds the same session, which the budget cut in
  `planSession` already needs.

Bad:

- The choice for a word is fixed for the day. A learner who wants a second run
  at a different direction must use practice mode.
- `PC` now appears as often as the other four. It has no name in Settings, and
  the priority list omits it. Pull request 6 names it.
