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

The listed order is also the rotation order the session queue uses when more
than one direction of a word is due.

Each direction of each word carries its own bank and due date. See
[docs/adr/0002-direction-level-scheduling.md](docs/adr/0002-direction-level-scheduling.md).

**Direction is the canonical name.** The code still uses three older names for
the same concept, and a later pull request renames them:

| Older name         | Where                              | Replaced by                               |
| ------------------ | ---------------------------------- | ----------------------------------------- |
| `TestPerm`         | `types/models.ts`                  | The direction and its resolved categories |
| `permList`, `perm` | `TestLogic.ts`, `useTestEngine.ts` | The session queue and its entries         |
| `qaCombinations`   | `TestLogic.ts`                     | `DIRECTIONS`                              |
| "QA combination"   | Issues and comments                | Direction                                 |

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
once in a session, except in the new-word fan-out.

## New word

A word whose five directions are all at bank 1, that is, one that has never been
answered correctly in any direction. A new word is exempt from the one-pair rule
and contributes all five directions to the queue. The exemption ends as soon as
one direction passes.

## Practice

Two different things carry this name today:

- **Practice mode** — the unscored run that ignores due dates. This use stays.
- The **"Practice" step** of the session stepper, which holds the sentence
  stages. This one is renamed to **"Sentences"**.

## Pass and failure

A direction **fails** only when the learner selects "I don't know", or when the
handwriting reveal runs. A wrong answer gives "Try again" and unlimited retries.
Inside a new-word fan-out, a direction that fails and is then answered correctly
counts as failed.
