/**
 * The state of one direction as if a wrongly marked answer had been a pass.
 *
 * Used by restore-missed-pass.js, for an answer the app marked wrong by
 * mistake (ü typed as "v" or "ü" against the "u:" of CC-CEDICT). It takes the
 * memory from the review log entry of the first wrong grade, grades it again
 * as a pass at the same moment, and takes back the lapses and the tone errors
 * that the wrong grades added. The reviews after it are dropped: a pass would
 * not have brought the word back that day.
 *
 * The FSRS settings are those of web-client/src/utils/scheduling.ts, and
 * restoreMissedPass.test.js checks the result against its nextMemory. The
 * due date takes no fuzz.
 */

const { fsrs, Rating, State } = require('ts-fsrs');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: false,
});

function bankOf(interval) {
  if (interval <= 0) return 1;
  if (interval < 7) return 2;
  if (interval < 30) return 3;
  if (interval < 60) return 4;
  return 5;
}

/** The memory and the elapsed days that FSRS read at the first wrong review. */
function memoryBefore(entry, reviewedAt) {
  const before = entry.before;
  if (!before) return { memory: { stability: 0, difficulty: 0, interval: 0 }, elapsed: 0 };
  // The log does not keep the interval. At a target retention of 0.9 the
  // interval FSRS gives is the stability, and a Review card's next state
  // depends on the stability, the difficulty and the elapsed days.
  const interval = Math.max(1, Math.round(before.stability));
  const elapsed = before.lastReview
    ? Math.max(0, Math.floor((reviewedAt.getTime() - before.lastReview.getTime()) / MS_PER_DAY))
    : interval;
  return { memory: { stability: before.stability, difficulty: before.difficulty, interval }, elapsed };
}

/** The memory a pass gives, as nextMemory in scheduling.ts gives it. */
function passMemory(memory, elapsed, now) {
  const learned = memory.stability > 0;
  const lastReview = new Date(now.getTime() - elapsed * MS_PER_DAY);
  const card = {
    due: learned ? new Date(lastReview.getTime() + memory.interval * MS_PER_DAY) : now,
    stability: memory.stability,
    difficulty: learned ? memory.difficulty : 0,
    elapsed_days: learned ? elapsed : 0,
    scheduled_days: memory.interval,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: learned ? State.Review : State.New,
    last_review: learned ? lastReview : undefined,
  };
  const next = scheduler.next(card, now, Rating.Good).card;
  return {
    stability: next.stability,
    difficulty: next.difficulty,
    interval: Math.min(365, Math.max(1, next.scheduled_days)),
  };
}

/**
 * @param current  The direction as Firestore holds it now, dates as Date.
 * @param reviews  The log entries of this word and direction, oldest first,
 *                 each with `reviewedAt` (Date) and `before.lastReview` (Date or null).
 * @returns The direction to write, dates as Date.
 */
function restoreMissedPass(current, reviews) {
  const first = reviews[0];
  if (!first || first.grade === 'pass') {
    throw new Error('The first review of the day is not a wrong grade, so there is nothing to restore');
  }
  const reviewedAt = first.reviewedAt;
  const { memory, elapsed } = memoryBefore(first, reviewedAt);
  const next = passMemory(memory, elapsed, reviewedAt);

  // A failed retrieval counts as a lapse only on a direction that held a memory.
  const lapsesAdded = reviews.filter((r) => r.grade !== 'pass' && r.before).length;
  const toneErrorsAdded = reviews.reduce((sum, r) => sum + (r.toneErrors ?? 0), 0);
  const lapses = Math.max(0, (current.lapses ?? 0) - lapsesAdded);
  const toneErrors = Math.max(0, (current.toneErrors ?? 0) - toneErrorsAdded);

  const restored = {
    bank: bankOf(next.interval),
    dueDate: new Date(reviewedAt.getTime() + next.interval * MS_PER_DAY),
    stability: next.stability,
    difficulty: next.difficulty,
    interval: next.interval,
    lastReview: reviewedAt,
  };
  if (toneErrors > 0) restored.toneErrors = toneErrors;
  if (lapses > 0) restored.lapses = lapses;
  return restored;
}

module.exports = { restoreMissedPass, passMemory, bankOf };
