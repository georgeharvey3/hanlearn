# 2. Direction-level scheduling

- Status: accepted
- Date: 2026-08-26
- Issue: #328
- Related: #301, #306, #337, #338, #339

## Context

A word is tested in five directions: `MC`, `MP`, `PM`, `PC` and `CM`. Each one
is a pair of an answer category and a question category, written answer-first,
so `CM` shows the meaning and takes the character as the answer. `TestLogic.ts`
builds the five as `qaCombinations`.

All five share one `bank` value and one `dueDate` in Firestore. `finishTest` in
`wordService.ts` promotes the word only when the score for the whole word is 4,
and it resets the word to bank 1 for any lower score.

The five directions are not one skill. Receptive recognition (`MC`, `MP`),
productive recall (`PC`, `PM`) and handwriting production (`CM`) are separate
constructs, and a learner acquires them at different rates.

The shared bank makes promotion all-or-nothing, and that is a bottleneck. For a
per-direction success probability of p, the probability of promotion is p to the
power of 5. At p = 0.85 that is about 0.44, and at p = 0.75 it is about 0.24.
One weak direction, usually handwriting, holds the word at bank 1 and discards
the four correct answers.

## Decision

Give each direction its own bank and due date.

```
users/{userId}/userWords/{wordId}
  wordData, amendedMeaning, listId, addedAt   // unchanged
  bank: number          // derived: the lowest bank across the directions
  dueDate: Timestamp    // derived: the earliest dueDate across the directions
  directions: {
    MC: { bank: number, dueDate: Timestamp },
    MP: { ... }, PM: { ... }, PC: { ... }, CM: { ... }
  }
```

### Why the top-level fields stay

Firestore cannot range-query five map fields in one query. `getDueUserWords`,
`getListStats` and `getDashboardStats` query `dueDate`, so a word needs one
queryable due date. `bank` is kept for the same reason and for the level
distribution on the Dashboard.

Both fields are derived, not authoritative. Every write of a direction also
writes the two derived fields in the same batch. No new index is needed.

### Why the read path synthesizes the map

`mapDocumentToWord` builds a full directions map for every document. A document
that has no `directions` field gets five entries derived from its single `bank`
and `dueDate`. The demo word and the optimistic add in the reducer build the
same shape.

As a result, no caller needs a fallback for a word without directions, and the
Firestore migration is a cleanup rather than a prerequisite. The migration and
the read path agree on the same derivation, so a document that the migration has
not reached yet behaves exactly as one it has.

### Scope of this record

This record covers the structure only. The contents of each direction record
stay on the current 5-level interval algorithm (`LEVEL_INTERVALS`: 1, 3, 7, 30
and 60 days). Issue #328 shows `stability`, `difficulty` and `lapses` fields.
Those belong to an FSRS-style algorithm, which is issue #301. A move to FSRS
rewrites the contents of each direction record and not the structure, so it does
not invalidate this decision.

## Consequences

Good:

- A failure in one direction no longer discards the progress of the other four.
- The three skills advance at their own rates, which is what the research on
  them describes.
- A word can be scheduled as one (word, direction) pair per session, which is
  what issue #306 needs.

Bad:

- A document holds five records where it held one. The document is still far
  below the 1 MiB limit.
- `masteredCount` and `levelDistribution` read the lowest bank, so level 5 comes
  to mean all five directions at bank 5. The migration copies the old bank into
  all five directions, so no number moves on the day of the release, but mastery
  is harder from then on. This belongs in the release notes.
- At bank 1 the interval is 1 day, so all five directions of a new word are due
  every day while only one of them is served per session. Queue position, not
  the interval, then decides when a direction comes back. This is accepted, and
  the plan on issue #328 records the reasoning.

## Rollout

The pull requests land in order, and this one lands alone.

1. Schema, migration and rules. No change of behavior: the read path
   synthesizes the map, the write path stores it, and nothing reads it yet.
2. The write path, which updates one direction at a time.
3. Results and the summary, per direction.
4. The session queue, which serves one direction per word. Closes #306.
5. Settings and the Dashboard estimate.
6. The renames to the `direction` vocabulary.

Deploy step 1 on its own. The migration then runs for every user while the read
path still ignores the stored map, so a rollback loses nothing.

The Firestore rules accept a document without the map, because a client running
the previous release writes one during the rollout. When the map is present the
rules require all five keys, an integer bank between 1 and 5, and a timestamp.
