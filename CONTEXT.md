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

## Pass and failure

A direction **fails** only when the learner selects "I don't know", or when the
handwriting reveal runs. A wrong answer gives "Try again" and unlimited retries.
A direction that fails and is then answered correctly counts as failed.
