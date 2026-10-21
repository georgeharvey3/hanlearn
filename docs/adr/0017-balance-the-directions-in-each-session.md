# 17. Balance the directions in each session

- Status: accepted
- Date: 2026-10-21
- Issue: #388
- Related: [0004-priority-breaks-ties-only.md](0004-priority-breaks-ties-only.md),
  [0010-partial-demotion-and-leeches.md](0010-partial-demotion-and-leeches.md),
  [0013-retention-metrics.md](0013-retention-metrics.md),
  [0015-a-cap-on-new-words-per-session.md](0015-a-cap-on-new-words-per-session.md),
  [0016-bury-sibling-directions.md](0016-bury-sibling-directions.md)
- Supersedes: the direction choice in
  [0003-direction-choice-by-oldest-due.md](0003-direction-choice-by-oldest-due.md),
  and the word ranking in
  [0006-the-due-date-is-the-only-rank.md](0006-the-due-date-is-the-only-rank.md)

## Context

The `CM` direction (meaning to character, by hand) is the hardest direction.
Most `CM` answers fail, also for words that the learner saw many times. A failed
`CM` comes back the next day or within three days (ADR 0010), and a failure
buries nothing (ADR 0016).

Two rules then put `CM` at the front of every session:

- A word asks its oldest due direction (ADR 0003). The failed `CM` is usually
  that direction, so the word goes to `CM` again.
- The queue ranks the words by the due date of that direction (ADR 0006). A
  `CM` that the session did not reach stays overdue and ranks first the next
  day.

Most sessions therefore ask `CM` and few questions in the other four directions.
These sessions are slow and not enjoyable. The other four directions of a `CM`
leech also wait, because the word reaches the session only through `CM`.

## Decision

Each direction gets an equal part of the budget, its **direction share**. The
share is the budget divided by the number of directions that the session asks,
rounded down. With a budget of 25 and five directions, each share is 5. With
handwriting off, the session asks four directions and each share is 6.

### Rank pairs, not words

`planSession` lists every due (word, direction) pair, not one pair for each
word. The due date of the direction itself ranks the pair, oldest first. Pairs
that share a day are shuffled with the day seed, as before.

Two walks over this one list make the session:

1. **The share walk.** Take a pair if its direction share has room and its word
   is not in the session yet.
2. **The fill walk.** If questions are still free because a direction had fewer
   due pairs than its share, walk the list again. This walk ignores the shares.

A word appears at most once in a session, as before. The new-word cap of
ADR 0015 applies in both walks. The session asks the pairs in the order of the
list, so a pair from the fill walk keeps its due-date position.

### The direction of a word

The oldest due direction of a word is its first choice and no longer its only
choice. If the share of that direction is full, a later pair of the same word
comes up in the walk. The word then goes to its oldest due direction that has
room. A word drops out of the session only when no due direction of it has room.

This replaces the decision of ADR 0003. The tie-break of ADR 0003 stays: pairs
on one day are shuffled with a seed, so a reload on the same day gives the same
session.

### Priority

`priority` still breaks ties only (ADR 0004). The tie is now between pairs on
one due day: within each day, the pairs in the `priority` direction come before
the shuffled rest. A word whose directions are in step therefore goes to the
`priority` direction, as before. The `priority` direction gets no larger share.
`onlyPriority` is unchanged, and its one direction gets the whole budget.

### Practice

Practice mode uses the same shares and the same two walks. Practice ignores the
due date, so the list holds every pair of every word, shuffled without a seed.
This replaces the random direction for each word. Practice then gets an exact
mix of directions on every run.

### Measurement

`/stats` shows the overdue directions per direction, next to the metrics of each
direction. `reviewLoad` counts them from the words when the page loads, the same
as the forecast. Nothing new goes into `reviewStats`. The attempts per direction
in `reviewStats` already show the balance itself.

## Consequences

Good:

- A session asks each direction about equally, whatever the fail rate of `CM`.
- The other directions of a `CM` leech get reviews, because the word can go to
  them when the `CM` share is full.
- A direction with few due pairs costs the session nothing. The fill walk gives
  its free questions to the other directions.
- Review and practice use one planner with no branch for the mix.

Bad:

- The `CM` backlog can grow without a limit. If more than 5 `CM` pairs come due
  each day, the share of 5 does not clear them. The overdue count per direction
  on `/stats` shows this growth.
- A `CM` pair that waits is late when it comes up. FSRS reads the elapsed days,
  so a late pass gives a longer interval, which is correct. A failed `CM` holds
  a low stability, and a few more days change little.
- The due date alone no longer explains why a word is in a session. This is
  the second exception to ADR 0006, after the new-word cap of ADR 0015.
- An exact share moves the session away from the due-date order also on days
  with no skew.
- A `CM` that fails because the handwriting grade is too strict is not fixed
  here. That needs its own issue.

## Alternatives

**A cap on every direction, for example 40% of the budget.** Below the cap, the
due date ranks everything as before. This keeps more of ADR 0006, and it
changes nothing on days with no skew. It was rejected because a cap of 40%
still gives `CM` 10 of 25 questions. The issue asks for a balanced session, and
only an equal share gives one.

**A cap on `CM` only.** This makes `CM` a special case in the ranking, and it
does nothing if another direction collects failures in the same way.

**Drop the word when its first direction has no room.** This keeps ADR 0003 as
it is. But a word with a failed `CM` then reaches the session only through
`CM`, and its other due directions starve behind it.

**Rank words and re-choose only on a collision.** A word that goes to `MC` then
ranks by the date of its `CM`. It can push out a word whose `MC` has waited
longer.

**Let the `CM` share grow with its backlog.** This brings back the skew that
the issue reports.
