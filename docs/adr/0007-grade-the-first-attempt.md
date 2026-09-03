# 7. Grade the first attempt

- Status: accepted
- Date: 2026-08-29
- Issue: #329
- Related: [0002-direction-level-scheduling.md](0002-direction-level-scheduling.md)

## Context

A direction failed only when the learner selected "I don't know", or when the
handwriting reveal ran. A wrong answer gave "Try again" and unlimited retries,
and the retries cost nothing. A session that ended with every answer correct
therefore reported a pass for every direction that it asked.

The interval calculation reads that report. It advances a bank on a pass and it
resets a bank on a failure. A report that says "pass" for a word that took nine
attempts measures the persistence of the learner, and not the memory of the
learner. Retrieval practice helps to the degree that the retrieval succeeds, so
a schedule that is built on this report is built on the wrong number.

Two more paths sent a grade that the learner did not choose. Speech recognition
submitted its transcript directly, and the `useAutoRecord` setting is on by
default, so the microphone opened without a press. An exact match on the target
characters passed the question with no submission at all.

## Decision

The first attempt at a question carries the grade, and the grade has three
values.

| Grade   | The learner                                                      | Bank                   |
| ------- | ---------------------------------------------------------------- | ---------------------- |
| `pass`  | answered correctly on the first attempt                            | + 1, to a maximum of 5 |
| `lapse` | answered wrongly first, then answered correctly without a reveal   | − 1, to a minimum of 1 |
| `fail`  | selected "I don't know", or the handwriting reveal ran             | 1                      |

`fail` keeps the meaning it always had. `lapse` is the new middle grade for a
retrieval that succeeded late, and it demotes one bank instead of a full reset.

The retries stay. They give feedback and learning value, and they do not change
the grade.

Each answer mode gives the grade in a different way. Input mode reads the first
attempt. Flashcard mode has no attempt to read, so the reveal shows three
buttons and the learner grades the question. The handwriting quiz counts the
misses on each stroke, and five misses on one stroke caps the question at
`lapse`.

An attempt is an answer that the learner sends, with the Submit button or with
the Enter key. Speech recognition puts its transcript in the input and sends
nothing. The exact-match path is gone, and a Submit button is new, because the
input had no submit control other than the Enter key.

An aid does not change the grade. A meaning gloss or a bare pinyin can fit more
than one word, so a learner sometimes needs an aid to find out which word the
question asks. The one exception is the stroke outline of a character question,
which is the answer and not a way to identify the question. It caps the question
at `lapse`, the same as five misses on one stroke.

A tone error takes the same grade as any other incorrect answer. Each direction
counts the tone errors that it collects, in the same batch that writes the bank.

## Consequences

Good:

- The report that the interval calculation reads is a measure of retrieval.
- A learner who knows a word but types it wrong loses one bank and not four.
- Every graded attempt is one that the learner chose to send.
- The tone errors of each word are available to a later feature.

Bad:

- Hands-free study is slower. The learner speaks, reads the transcript, then
  presses Submit. The exact-match path saved a press and it is gone.
- The grade of a flashcard question is a report of the learner about the
  learner. A learner who grades themselves generously gets a schedule to match.
- Three grades in place of two touch the summary, the results payload, the
  Firestore write, and the tests.
- A learner can still retry aloud until the transcript matches, and then send a
  correct first attempt. The Submit button makes this deliberate, not
  impossible.

## Notes

The three directions that ask an ambiguous question are #348. Until that issue
is complete, a learner uses an aid to find out which word a gloss means, which
is why an aid is free. Issue #339 owns what gates the sentence stages, so this
change leaves that gate where it was: only a `fail` blocks them.
