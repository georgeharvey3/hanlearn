# 12. Show the character components again after a miss

- Status: accepted
- Date: 2026-09-02
- Issue: #335
- Related: [0007-grade-the-first-attempt.md](0007-grade-the-first-attempt.md),
  [0010-partial-demotion-and-leeches.md](0010-partial-demotion-and-leeches.md)

## Context

The Learn stage breaks a new character into its components: `NewWord` offers a
"Decompose" button, and `DecompositionTree` calls the `decomposeCharacter`
function for the radicals and the parts. It ran there and nowhere else, so a
learner met the components of a character once, on the day the character was
newest and least meaningful to them.

Knowledge of radicals and components predicts character recognition and reading
comprehension, which is why the Learn stage shows them at all. The moment that
argument applies most is a moment the app was silent for: a direction the
learner has just failed to recall.

The design review that raised this (issue #335) also asked that two properties
of the current design survive the scheduler work: the shuffle of words within a
session, and the independence of the schedule from the streak. Both already
hold. `planSession` ranks by due date and shuffles within a due day, reading
neither the list nor the bank of a word, and no file that computes a schedule
mentions the streak — `recordTestCompletion` runs after `finishTest` and feeds
the Dashboard only.

## Decision

A question that ends below a `pass` and had a character on screen offers the
components of that character before the session moves on.

- The trigger is a `lapse` or a `fail` on `MC`, `PC` or `CM` — the directions
  that show or ask for the character. `MP` and `PM` have no character on
  screen, so they offer nothing.
- The offer is **collapsed**. The breakdown is one tap away, and
  `decomposeCharacter` is not called until the learner asks for it, so a rushed
  session costs no extra calls.
- The session **holds** on the reveal. A graded question moved on after one to
  two seconds, which is not long enough to open a panel and read it, so the
  timer is replaced by a Continue button on exactly these questions. Every
  other question keeps its timed advance.
- A word of more than one character gets one breakdown per character.

`componentsToReview` in `useTestEngine.ts` decides what a question offers, and
`holdOrAdvance` holds the step that ends the question until Continue runs it.
`ComponentReview` is the UI, and it reuses the Learn stage's
`DecompositionTree` so that both places agree on what a component is.

The two properties the review asked to protect are now stated as tests rather
than left as facts about the current code:
`TestLogic.interleaving.test.ts` pins that a session plan is blind to the list
and to the level of a word, and `scheduling.streak.test.ts` pins that no
scheduling file reads the streak.

## Consequences

Good:

- The components of a character are shown at the moment the learner has just
  proved they do not know it, not only when it was new.
- The reveal stops being a flash. A missed question stays on screen until the
  learner has finished with it, which is worth having whether or not they open
  the breakdown.
- The two protected properties now fail loudly if a later change breaks them.

Bad:

- A missed character question costs an extra tap. Handwriting sessions are the
  ones that lose most, because `CM` misses are the common ones.
- The hold is a second place, after "I don't know", where the session waits for
  the learner. A learner who answers with the keyboard continues with Enter or
  space, but the flow is no longer uniform.
- The breakdown is a cloud-function call per character, rate-limited to 60 a
  minute per user. A learner who opens it on every miss of a long session will
  notice the latency of the first call for each character.
