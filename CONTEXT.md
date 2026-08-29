# CONTEXT

Working vocabulary for HanLearn. `CLAUDE.md` describes the repository; this file
fixes the words the code and the issues use for the domain, so that one concept
does not collect four names.

## Direction

A **direction** is a pair of an answer category and a question category, written
answer-first. There are five:

| Direction | Question shown | Answer given | Skill                  |
| --------- | -------------- | ------------ | ---------------------- |
| `MC`      | Character      | Meaning      | Receptive recognition  |
| `MP`      | Pinyin         | Meaning      | Receptive recognition  |
| `PM`      | Meaning        | Pinyin       | Productive recall      |
| `PC`      | Character      | Pinyin       | Productive recall      |
| `CM`      | Meaning        | Character    | Handwriting production |

The listed order has no effect on the session queue. When more than one
direction of a word is due, the queue asks the direction with the oldest due
date. Directions that share the oldest date go to the `priority` setting, or to
a random choice. See
[docs/adr/0003-direction-choice-by-oldest-due.md](docs/adr/0003-direction-choice-by-oldest-due.md).

Each direction of each word carries its own bank and due date. See
[docs/adr/0002-direction-level-scheduling.md](docs/adr/0002-direction-level-scheduling.md).

**Direction is the canonical name.** The code used four older names for the
same concept, and issue #328 removed them all. Older issues and pull requests
still hold them:

| Older name       | Current name                                      |
| ---------------- | ------------------------------------------------- |
| `TestPerm`       | `QueuePair`                                       |
| `permList`       | `queue`                                           |
| `perm`           | `pair`, and `currentPair` for the one being asked |
| `initNumPerms`   | `initialQueueLength`                              |
| `qaCombinations` | `DIRECTIONS`                                      |
| "QA combination" | Direction                                         |

## Bank and level

The spaced repetition level of a word or of one direction, an integer from 1
to 5. Firestore stores the field as `bank`; the client model calls it `level`.
Both names are current, and a rename needs its own pull request.

Level 1 is a word that has not been answered correctly yet. The intervals are
1, 3, 7, 30 and 60 days (`LEVEL_INTERVALS` in `wordService.ts`).

## Derived fields

The top-level `bank` and `dueDate` on a `userWords` document are **derived**:
the lowest bank and the earliest due date across the five directions. They exist
because Firestore cannot range-query five map fields. Every write of a direction
also writes both, in the same batch.

## Session, queue and pair

A **session** is one run of the test flow. Its **queue** is an ordered list of
**(word, direction) pairs**, and one pair is one question. A word appears at most
once in a session. There is no exception.

The due date of the chosen direction gives the order, oldest first. Pairs that
share a day are shuffled, and the **budget** cuts the queue at its end.

The code calls one pair a `QueuePair`, and it holds the index of the word plus
the two categories of the direction. `TestState` holds the queue as `queue`, and
the pair the learner answers now as `currentPair`.

## Budget

How many questions one session may ask. The learner sets it with the "Questions
per session" slider, which runs from 5 to 50 in steps of 5 and defaults to 25.
The setting is stored as `questionsPerSession`.

The slider counted words before the queue existed, and one word gave five
questions. A learner who has the old `numWords` value keeps the session length
they had: `readQuestionsPerSession` reads it one time, multiplies it by five,
and caps the result at 50.

## New word

A word whose five directions are all at bank 1, that is, one that has never been
answered correctly in any direction.

The session teaches a new word in the Learn step, then asks it once, in one
direction like any other word. The five directions of a new word share one due
date, so the queue treats them as tied. The four directions that the session
does not ask stay at bank 1 and due, and a later session reaches them. See
[docs/adr/0005-new-words-take-one-direction.md](docs/adr/0005-new-words-take-one-direction.md).

A new word holds no place of its own in the queue. Its due date ranks it against
every other word, it has no cap, and a word with no due date is not due. See
[docs/adr/0006-the-due-date-is-the-only-rank.md](docs/adr/0006-the-due-date-is-the-only-rank.md).

## Practice

**Practice mode** is the unscored run that ignores due dates. This is the only
thing the name covers. The step of the session stepper that holds the sentence
stages carried the same name before, and it is **"Sentences"** now.

## Grade

A **grade** is how one question went. The grade comes from the **first attempt**
at that question, and one question gets one grade. There are three:

| Grade   | The learner                                                     | Bank                    |
| ------- | --------------------------------------------------------------- | ----------------------- |
| `pass`  | answered correctly on the first attempt                           | + 1, to a maximum of 5  |
| `lapse` | answered wrongly first, then answered correctly without a reveal  | − 1, to a minimum of 1  |
| `fail`  | selected "I don't know", or the handwriting reveal ran            | 1                       |

The retries stay. A wrong answer gives "Try again", and the learner can answer
again as many times as they want. The retries give feedback and learning value.
They do not change the grade of the question.

`fail` keeps the meaning it always had: the learner did not retrieve the answer.
`lapse` is the new middle grade for a retrieval that succeeded late. See
[docs/adr/0007-grade-the-first-attempt.md](docs/adr/0007-grade-the-first-attempt.md).

The grade of a question comes from what the learner did, and each answer mode
gives it in a different way:

| Answer mode | `pass`                    | `lapse`                        | `fail`                |
| ----------- | ------------------------- | ------------------------------ | --------------------- |
| Input       | correct on first attempt  | wrong first, then correct      | "I don't know"        |
| Flashcard   | the learner reports it    | the learner reports it         | the learner reports it |
| Handwriting | drawn with no stroke missed 5 times | drawn after 5 misses on a stroke | the reveal ran   |

Flashcard is a recognition task with no attempt to read, so the learner grades
the question. This is why the reveal shows three buttons and not two.

The handwriting quiz counts the misses on each stroke, and it shows the stroke
outline after five misses on one stroke. Five misses is the point where the app
helps, so it is the point where a handwriting question stops being a `pass`. A
word of more than one character takes the worst grade of its characters.

## Aid

An **aid** is help that the learner asks for during a question. The hint, the
character of a pinyin question, and the pinyin of a character question are all
aids.

An aid does not change the grade. A meaning gloss or a bare pinyin can fit more
than one word, so the learner sometimes needs an aid to find out which word the
question asks. A grade that counted aids would grade this ambiguity and not the
memory of the learner.

There is one exception. The stroke outline of a character question is the answer
and not a way to identify the question. A learner who asks for the outline gets
the same grade as a learner who missed one stroke five times. Both cap the
question at `lapse`.

## Attempt

An **attempt** is one answer that the learner sends. The learner sends it with
the Submit button, or with the Enter key.

Speech recognition does not send an attempt. The transcript goes into the input,
and the learner reads it and sends it. A transcript that the learner did not send
has no grade, because the grade would be a measure of the recognizer.

## Tone error

A **tone error** is an attempt at a pinyin answer that gives the correct
syllables with one or more incorrect tones. A tone error is an incorrect answer,
and it takes the same grade as any other incorrect answer.

The direction counts the tone errors that it collects, so that a later feature
can show the learner which words hold the tones that they do not know.
