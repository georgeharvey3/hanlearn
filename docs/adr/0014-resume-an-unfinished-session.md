# 14. Resume an unfinished session from local storage

- Status: accepted
- Date: 2026-09-03
- Issue: #305
- Related: [0006-the-due-date-is-the-only-rank.md](0006-the-due-date-is-the-only-rank.md),
  [0013-retention-metrics.md](0013-retention-metrics.md)

## Context

A session writes nothing until it ends. The engine collects a `DirectionGrade`
for each question in `gradeList`, and `finishTest` turns the whole list into one
Firestore batch when the queue empties. Close the page on question 12 of 25 and
all 12 grades are gone. Nothing is corrupted — those directions were never
rescheduled, so they are still due — but the learner answered twelve questions
for nothing and will answer them again.

The app is used on a phone, mid-session, where the page is closed by a call, a
tab eviction, or a thumb. This is the ordinary case, not the rare one.

Two designs answer it. The first commits each grade as it is given, so there is
no session to resume: the answered directions stop being due and a new session
simply plans what is left. The second saves the running session and offers it
back. The first protects the data even against a crash, and it costs no extra
word writes, because a word appears at most once in a session and `finishTest`
already reads and writes each word once. It does multiply the `reviewStats`
rollup write by the number of questions, it splits one session across several
`now` instants, and it does not by itself put the learner back where they were.

## Decision

Save the running session to `localStorage`, and offer it back on the next visit.

- The record is **local**, not Firestore. A session is something one device is
  in the middle of, not something an account owns, and the app's costs are kept
  off Firestore wherever a static or local answer will do. It also means a
  session survives being closed with no network.
- The record holds **word ids**, not words. The words are put back from Redux on
  restore, so an amended meaning is the current one and a word deleted since
  cannot come back. Every id has to resolve or the whole session is dropped: the
  saved queue holds positions in the saved word order, so dropping one word
  would shift every later question onto the wrong word.
- A session belongs to **one learner, one list and one day**. The plan is seeded
  from the date and the due dates move at midnight, so yesterday's queue is not
  a session today would have planned. A record that fails those checks is
  deleted rather than ignored, except one belonging to another list, which is
  left where it is.
- The learner is **asked**. An unfinished session shows "Resume" and "Start
  fresh" rather than resuming by itself, because a session left behind on
  purpose is as likely as one lost by accident.
- The record is written on **each stage and each graded question**, which is
  every moment the session moves, and deleted when the session reaches the
  summary.
- Resume is exact **within the vocab stage** and returns to the **start of a
  sentence stage**. The vocab stage is where the grades are, and it is what
  losing a session actually costs.

`utils/savedSession.ts` holds the record and its rules, `TestWords` writes it
and makes the offer, and the engine takes the saved queue and grades through its
`resume` prop and reports its progress through `onProgress`.

## Consequences

Good:

- A session closed halfway through can be finished, and the grades it collected
  are rescheduled with the rest at the end.
- The scheduler is untouched: one session is still one batch, at one instant,
  with one rollup write. Every measurement in ADR 0013 counts what it did.
- It costs nothing — no reads, no writes, no network.

Bad:

- The record is a second description of a session, beside the component state it
  was made from, and it has to be kept in step with it.
- Clearing the browser, using a different device, or a browser that refuses
  storage loses the session, exactly as before.
- Nothing is written until the session finishes, so a crash during the final
  write still loses the session's grades. That is the fault the other design
  answers, and it stays open.
- A sentence stage restarts rather than resuming.
