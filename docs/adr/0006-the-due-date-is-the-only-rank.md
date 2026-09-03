# 6. The due date is the only rank

- Status: the removal of the new-word cap is superseded by
  [0015-a-cap-on-new-words-per-session.md](0015-a-cap-on-new-words-per-session.md)
- Date: 2026-08-28
- Issue: #328
- Related: [0003-direction-choice-by-oldest-due.md](0003-direction-choice-by-oldest-due.md),
  [0005-new-words-take-one-direction.md](0005-new-words-take-one-direction.md)
- Supersedes: the ordering and the cap in
  [0005-new-words-take-one-direction.md](0005-new-words-take-one-direction.md)

## Context

ADR 0005 gave a new word one direction, the same as any other word. It kept two
rules of its own for where that question goes:

- A new word enters after every review pair.
- At most `NEW_WORDS_PER_SESSION` new words enter, which was 5.

`planSession` therefore split the candidates in two, ranked and cut the review
pairs against the budget, then appended the new pairs.

The two rules give a new word a schedule of its own, and that schedule ignores
the due date. A new word that came due three weeks ago waits behind a review
word that came due today. A learner who adds 20 words gets 5 of them, however
empty the session is. The cap is also a second answer to "how long is a
session", which the budget already answers.

The learner reads one number from the app, the due date. Two words that show
the same date get a different place in the queue, and nothing on the screen
explains the difference.

## Decision

The due date of the chosen direction is the only rank. A new word is one more
word with a due date.

`planSession` builds one pair for each due word, new or not, ranks every pair
by that date, shuffles the pairs that share a day, and cuts at the budget.
There is no new-word branch, no reserved part of the session, and no
`NEW_WORDS_PER_SESSION`.

A word with no due date at all is not due, for every word. The exemption that
let a new word into the queue without a due date is gone.

`plan.newWords` is now the new words in the queue, which is what the Learn step
teaches. The Learn step and the queue cannot disagree, because one list makes
both.

## Consequences

Good:

- One rule orders the session, and the learner can read it off the due date.
- A new word with an old due date is no longer starved by a backlog of newer
  reviews.
- More new words can enter an empty session, because only the budget stops
  them.

Bad, and the reason ADR 0015 brings the cap back:

- A day with many new words can fill the session with new words. The budget is
  the only limit, and `addWordToList` gives a new word a due date of today or
  tomorrow. A learner who adds 30 words in one sitting meets 25 of them in the
  next session.
- The old cap gave a mixed session on such a day. A learner who wants that must
  add fewer words at a time, until a separate setting for the new-word load
  exists.
