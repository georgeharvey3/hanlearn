# 5. A new word takes one direction

- Status: superseded in part by
  [0006-the-due-date-is-the-only-rank.md](0006-the-due-date-is-the-only-rank.md)
- Date: 2026-08-27
- Issue: #328
- Related: #306,
  [0003-direction-choice-by-oldest-due.md](0003-direction-choice-by-oldest-due.md)
- Supersedes: rule 4 of the session queue plan on issue #328

## Context

A session asks each word once. That rule closes issue #306, because a word holds
three facts and each direction shows two of them, so a second question about the
same word gives the answer to the first.

The first version of the session queue made a new word an exception. The Learn
step shows the character, the pinyin and the meaning of a new word together, so
a fan-out of all five directions leaks nothing that the learner has not just
seen. The new word therefore contributed five questions to the queue.

The exception costs too much of a session. Five directions of one word is a
fifth of a default session of 25 questions, and five new words fill it
completely. A learner then answers the same five words 25 times and reviews
nothing. The exemption also made the budget arithmetic admit a new word only
when 5 questions remained, which starves new words on a day with a backlog.

The argument for the fan-out was that it is safe, not that it is useful. A
learner does not need five questions on a word met one minute ago.

## Decision

A new word takes one direction, the same as any other word.

The five directions of a new word are all at bank 1 and share one due date, so
they are all tied. `chooseDirection` settles the tie the same way it settles any
other: the `priority` setting, or a random choice seeded from the day and the
word. There is no special case.

New words still enter after the review pairs, and at most
`NEW_WORDS_PER_SESSION` of them enter. ADR 0006 removes both of these rules.
The due date ranks a new word against every other word.

## Consequences

Good:

- A new word costs one question. Five new words cost 5 questions of 25, not all 25.
- New words reach the queue on a day with a backlog. The old rule needed 5 free
  questions for one new word.
- One rule covers every word, so `planSession` has no fan-out branch and the
  queue holds one entry per word.

Bad:

- A new word can be asked in `CM`, which asks the learner to write a character
  first met one minute before. This is accepted. The alternative pins the first
  question of every new word to one direction, which is the fixed order that
  ADR 0003 removes.
- The other four directions of a new word wait for a later session. A word
  therefore takes longer to reach bank 5 in all five directions.
