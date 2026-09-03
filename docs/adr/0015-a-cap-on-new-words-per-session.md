# 15. A cap on new words per session

- Status: accepted
- Date: 2026-09-03
- Related: [0005-new-words-take-one-direction.md](0005-new-words-take-one-direction.md),
  [0006-the-due-date-is-the-only-rank.md](0006-the-due-date-is-the-only-rank.md)
- Supersedes: the removal of `NEW_WORDS_PER_SESSION` in
  [0006-the-due-date-is-the-only-rank.md](0006-the-due-date-is-the-only-rank.md)

## Context

ADR 0006 made the due date the only rank and removed the cap of 5 new words a
session, leaving the budget as the only limit on the new-word load. Its own
"Bad" section named what that costs, and using it showed the cost is real:

`addWordToList` gives a new word a due date of today or tomorrow, so every word
added in one sitting is due in the next session, all on the same day, ahead of
most of the backlog. A learner who adds 30 words meets 25 of them in the next
session and reviews nothing. The Learn step teaches all 25 before the first
question.

That is not a session a learner takes in, and it is why the cap existed. The
load a day of adding words creates is spread over the following days, or it is
not spread at all.

## Decision

At most `NEW_WORDS_PER_SESSION` new words enter a session, and it is 5 again.

The due date still ranks every word, new or not, and it decides which new words
those 5 are: the ranking is built first, then the session takes from it in
order and passes over a new word once 5 have been admitted. So the 5 that enter
are the 5 that have waited longest, and the review word behind a passed-over
new word takes its question, which costs the session nothing while any word is
left to review.

This is the one exception to ADR 0006's rule, and it is the only place a word's
level enters the ranking. Everything else in ADR 0006 stands: there is no
reserved part of the session, no separate ordering for new words, and no
budget arithmetic that admits a new word only when several questions remain.
The fault ADR 0006 fixed — a new word with an old due date starved behind newer
reviews — does not come back, because the cap holds the newest new words out,
not the oldest.

The cap applies to practice too. Practice ignores the due date, so without it
practice would teach every new word in the collection at once.

## Consequences

Good:

- A day of adding words costs 5 new words a session, and the rest of the
  session reviews.
- The oldest new words are the ones admitted, so nothing added earlier is
  starved by something added today.

Bad:

- A learner who wants to meet 20 new words in one session cannot, and must run
  four sessions instead. A setting for the new-word load would answer this; the
  cap is a fixed 5 until one exists.
- A session with nothing to review and only new words left is 5 questions long,
  short of the budget, because no review word is there to take the questions the
  cap frees. A learner starting a collection meets it for their first days.
- A word's level now decides one thing in the ranking, so the due date is no
  longer the whole answer to "why is this word in my session".
