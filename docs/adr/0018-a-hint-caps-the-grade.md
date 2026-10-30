# 18. A hint caps the grade

- Status: accepted
- Date: 2026-10-30
- Issue: #396
- Related: [0009-fsrs.md](0009-fsrs.md),
  [0013-retention-metrics.md](0013-retention-metrics.md)
- Supersedes: the rule "An aid does not change the grade" in
  [0007-grade-the-first-attempt.md](0007-grade-the-first-attempt.md)

## Context

ADR 0007 made every aid free. A meaning gloss or a bare pinyin can fit more than
one word, and the learner used the hint to find out which word the question
asked. A grade that counted the hint graded this ambiguity, not the memory of
the learner.

The hint also does a second job. It gives part of the answer to a learner who
knows which word is asked but cannot recall it. Because the hint was free, a
question that needed the pinyin initials graded as `pass`. FSRS then read a
recall that did not occur.

#348 removes most of the ambiguity. It accepts an alternative answer, an answer
that fits the question but belongs to another word, and it does not grade it.
Thus the app knows when a question was ambiguous, and the first job no longer
needs a free hint.

A partial cue is real retrieval practice. Recall with fading cues improves
retention (Finley, Benjamin, Hays, Bjork and Kornell 2011). Thus a hinted answer
is a true middle grade between `pass` and `fail`. A failed attempt that gets
feedback also helps (Kornell, Hays and Bjork 2009), so a lower grade does not
harm the learner.

## Decision

An aid has two kinds, and the kind is what the aid does for the question.

A **hint** gives one step of the answer, and it caps the question at `lapse`.
Each answer category keeps the hint that it had:

| Answer    | Directions   | Hint                              |
| --------- | ------------ | --------------------------------- |
| Pinyin    | `PM`, `PC`   | the initial of each syllable      |
| Meaning   | `MC`, `MP`   | the pinyin of an example sentence |
| Character | `CM`         | the stroke outline, for 1 s       |

The hint has one step. A second press hides it, and there is no ladder that ends
in `fail`. FSRS gives `lapse` and `fail` the same rating, so a ladder adds UI for
a difference that only the due date shows. A hint that does not load costs
nothing.

A **disambiguator** narrows the question to its own word, and it does not change
the grade. It comes from the data of the asked word, so it needs no new field
and no generated text. The app shows it after an alternative answer, with no
tap:

| Direction | Disambiguator                    |
| --------- | -------------------------------- |
| `PM`      | the initial of each syllable     |
| `MP`      | the character                    |
| `MC`      | the pinyin of the reading asked  |
| `PC`      | the meaning of the reading asked |

The `PM` disambiguator is the same text as the `PM` hint. Before an alternative
answer, the initials are a hint. After it, they are free, because the learner
already gave a word that fits the gloss.

`CM` has a different rule. The handwriting quiz grades each stroke against one
character, so it cannot see an alternative answer. And 90% of HSK words share a
gloss with another entry of CC-CEDICT, so a collision check finds a collision on
almost every question. `CM` tests the drawing, and the learner is expected to
know the pinyin. Thus a button on every `CM` question shows the initials for
free.

The `MP` question no longer has its "Show character" toggle. The character is
now the `MP` disambiguator, and it shows only after an alternative answer. The
"Show pinyin" toggle stays, because the pinyin is the same question in text.

In flashcard mode, a hint removes the `pass` button from the reveal, and the
engine holds the reported grade to the cap.

`reviewLog` moves to version 2. The `hint` field records only a hint that the
learner asked for, and a new `disambiguator` field records a disambiguator. In
version 1, `hint` was a free aid, so a reader of the log tells the two apart by
the version.

## Consequences

Good:

- A `pass` is a recall with no part of the answer shown.
- The scheduler gets a `lapse` for a hinted recall, which is the grade that the
  research supports.
- #446 can compare the hint and the disambiguator, because the log records each
  one apart.

Bad:

- A hinted question demotes the direction. A learner who used the hint as a free
  check now sees more `lapse` grades and shorter intervals.
- The free `CM` initials can make some `CM` passes easier than a recall of the
  form from the meaning alone. #446 measures this.
- A `CM` collision with a word that has other initials is still graded as a
  miss. #398 owns the `CM` question.
- The rule depends on #348. If #348 does not detect an alternative answer, the
  learner can resolve the ambiguity only with a hint, which costs `lapse`.
