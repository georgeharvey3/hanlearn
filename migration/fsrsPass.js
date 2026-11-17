/**
 * The memory a pass gives, as nextMemory in web-client/src/utils/scheduling.ts
 * gives it, with the same FSRS settings. restore-missed-pass.js passes it to
 * restoreMissedPass. It sits in its own file because the test run of CI does
 * not install the packages of this directory; the test passes nextMemory
 * itself instead.
 */

const { fsrs, Rating, State } = require('ts-fsrs');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: false,
});

function fsrsPass(memory, elapsed, now) {
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

module.exports = { fsrsPass };
