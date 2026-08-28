# 4. Priority breaks ties only

- Status: accepted
- Date: 2026-08-27
- Issue: #328
- Related: [0003-direction-choice-by-oldest-due.md](0003-direction-choice-by-oldest-due.md)

## Context

The `priority` setting names a direction that the learner prefers. Before the
session queue existed, it front-loaded the session. `setPermList` held every
direction of every word, and `assignQA` drew the next question from the priority
direction while any remained:

```ts
const perm = priorityPerms.length > 0 ? ranChoice(priorityPerms) : ranChoice(permList);
```

Every direction still reached the learner. The setting decided the order of the
session, not its contents. `onlyPriority` was the separate switch that removed
the other directions.

A session now asks each word once, which is what closes issue #306. That rule
removes the list that front-loading acted on. A priority direction that wins the
choice outright therefore takes every question in the session, and `priority`
becomes a second name for `onlyPriority`.

## Decision

`priority` decides only between directions that share the oldest due date. The
ranking in ADR 0003 runs first.

A word whose directions are all in step has all five tied, so it goes to the
priority direction. This is every migrated word on the day of the release, which
is where the old front-loading had its effect. A direction that falls behind
holds an older due date, outranks the priority, and cannot starve.

`onlyPriority` is unchanged. It remains the way to ask one direction and no
other.

## Consequences

Good:

- A learner who sets a priority still gets variety, which the outright win
  removed.
- The two settings have two meanings again. `priority` prefers a direction,
  `onlyPriority` restricts to it.

Bad:

- The priority direction appears less often as the five due dates of a word
  spread apart. This is intended. At that point the schedule has an opinion, and
  the schedule wins.
- A learner who wants one direction and nothing else must set `onlyPriority`.
  `priority` on its own no longer does that, and it did for one release.
