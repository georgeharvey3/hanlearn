import { fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { DirectionResult } from '../types/models';

/**
 * The schedule of one direction of one word, from FSRS.
 *
 * FSRS holds two numbers for a memory. The **stability** is the number of days
 * after which the learner recalls the answer with a probability of 0.9. The
 * **difficulty**, from 1 to 10, is how much one review moves that stability.
 * The grade of a question moves both, and the interval is the number of days
 * after which the predicted recall probability falls to the target retention.
 *
 * The three grades of the app map to two of the four FSRS ratings. A `lapse` is
 * a wrong first attempt, so the graded attempt did not retrieve the answer, and
 * FSRS reads that as Again. Hard means a retrieval that succeeded, and it grows
 * the interval. Easy has no button in this app.
 *
 * | Grade   | Rating | Interval           |
 * | ------- | ------ | ------------------ |
 * | `pass`  | Good   | the day FSRS gives |
 * | `lapse` | Again  | the day FSRS gives |
 * | `fail`  | Again  | 0, so the next day |
 *
 * A lapse and a failure give the same memory state, and the due date separates
 * them. A learner who did not retrieve the answer at all sees the direction the
 * next day. See docs/adr/0009-fsrs.md.
 *
 * Every function here is pure. `finishTest` in `wordService.ts` holds the
 * Firestore write.
 */

/** The recall probability that the due date aims for. */
export const TARGET_RETENTION = 0.9;

/** The longest interval the schedule gives. */
export const MAX_INTERVAL_DAYS = 365;

/**
 * The ease of the calculation that FSRS replaces, and the range it stayed in.
 *
 * The ease is no longer part of the schedule. These three numbers stay because
 * a direction that holds an ease and no difficulty seeds its difficulty from
 * the ease it holds.
 */
export const STARTING_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

/** The range of the FSRS difficulty. */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/** The interval from which the fuzz applies, and how far it spreads. */
const FUZZ_FROM_DAYS = 3;
const FUZZ_RATIO = 0.05;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The one scheduler of the app.
 *
 * The learning steps are off, because the app has no intra-day step: a question
 * comes back on a later day or it does not come back. With the steps on, FSRS
 * answers a new card in minutes, and the session cannot ask it again.
 *
 * The fuzz is off here because `fuzzInterval` applies it, with a random
 * function that the tests replace.
 */
const scheduler = fsrs({
  request_retention: TARGET_RETENTION,
  maximum_interval: MAX_INTERVAL_DAYS,
  enable_fuzz: false,
  enable_short_term: false,
});

const RATINGS: Record<DirectionResult, Grade> = {
  pass: Rating.Good,
  lapse: Rating.Again,
  fail: Rating.Again,
};

/**
 * The interval that a direction with no interval field starts from, read from
 * the bank it holds.
 *
 * These are the five steps of the fixed table that the interval replaced, so a
 * document written before the interval existed keeps the schedule it had. Bank
 * 1 gives 0 because bank 1 means the direction has never been answered
 * correctly, and the schedule asks such a direction again the next day.
 */
const SEED_INTERVALS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 30, 5: 60 };

/** The memory state of one direction. */
export interface Memory {
  /** The days after which the recall probability of this direction is 0.9. 0 is a direction that has never been passed. */
  stability: number;
  /** How much one review moves the stability, from 1 (easy) to 10 (hard). */
  difficulty: number;
  /** Days between the last review and the next one. 0 is a direction that the schedule asks again the next day. */
  interval: number;
}

/**
 * The scheduling state of one direction as Firestore holds it.
 *
 * Only `bank` is always present. The three fields below it arrived with three
 * different calculations, and `currentMemory` reads whichever of them a
 * document carries.
 */
export interface StoredMemory {
  bank: number;
  stability?: number;
  difficulty?: number;
  interval?: number;
  ease?: number;
}

/**
 * The interval a direction starts from, for a direction that holds a bank but
 * no interval.
 */
export function seedInterval(bank: number): number {
  return SEED_INTERVALS[bank] ?? 0;
}

/**
 * The FSRS difficulty of an ease.
 *
 * The two numbers measure the same thing in opposite directions: a high ease is
 * a word the learner finds easy, and a high difficulty is a word they find
 * hard. The map is linear across the range of each, so the starting ease of 2.5
 * gives a difficulty of about 3.6.
 */
export function difficultyFromEase(ease: number): number {
  const share = (MAX_EASE - ease) / (MAX_EASE - MIN_EASE);
  const difficulty = MIN_DIFFICULTY + share * (MAX_DIFFICULTY - MIN_DIFFICULTY);
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, difficulty));
}

/**
 * The memory state that a stored direction holds now.
 *
 * A direction that FSRS has scheduled carries its stability and its difficulty.
 * A direction that only the interval calculation reached carries an interval
 * and an ease, and the stability of an interval is the interval itself: both
 * are the number of days at which the recall probability is 0.9. A direction
 * that neither calculation reached carries a bank, and the bank seeds the
 * interval.
 *
 * No migration runs. A direction gains the FSRS fields when a session next
 * asks it.
 */
export function currentMemory(state: StoredMemory): Memory {
  const interval = state.interval ?? seedInterval(state.bank);
  const stability = state.stability ?? interval;

  // A direction with no stability has no memory for FSRS to read, and the
  // question that passes it gives it its first stability and difficulty.
  if (stability <= 0) return { stability: 0, difficulty: 0, interval: 0 };

  return {
    stability,
    difficulty: state.difficulty ?? difficultyFromEase(state.ease ?? STARTING_EASE),
    interval,
  };
}

/**
 * The bank of an interval.
 *
 * The bank is derived: the grade moves the memory, the memory gives the
 * interval, and the interval gives the bank. The five bands are the five steps
 * of the fixed table that the interval replaced.
 *
 * Bank 1 is an interval of 0, which is a direction that has never been answered
 * correctly, or one that a failure reset.
 */
export function bankOf(interval: number): number {
  if (interval <= 0) return 1;
  if (interval < 7) return 2;
  if (interval < 30) return 3;
  if (interval < 60) return 4;
  return 5;
}

/**
 * Whole days from the last review to now. A direction with no last review
 * reports the interval it holds, so that its next review counts as on time.
 */
export function elapsedDays(lastReview: Date | undefined, now: Date, interval: number): number {
  if (!lastReview) return interval;
  return Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / MS_PER_DAY));
}

/**
 * The memory state a direction moves to.
 *
 * FSRS reads the state the direction holds, the grade, and the days that passed
 * since the last review. A review that ran late is evidence of a memory that is
 * more stable than the schedule expected, and the model takes that evidence
 * itself.
 *
 * A failure gives an interval of 0, so the schedule asks the direction again
 * the next day. The stability and the difficulty that the failure produced are
 * kept, and they give the interval of the next pass.
 */
export function nextMemory(
  memory: Memory,
  grade: DirectionResult,
  elapsed: number,
  now: Date,
): Memory {
  const next = scheduler.next(toCard(memory, elapsed, now), now, RATINGS[grade]).card;

  return {
    stability: next.stability,
    difficulty: next.difficulty,
    // A failure gives an interval of 0, which the due date reads as the next
    // day. Every other grade takes the day that FSRS gives.
    interval: grade === 'fail' ? 0 : clampInterval(next.scheduled_days),
  };
}

/**
 * The FSRS card of a memory state.
 *
 * A direction with a stability of 0 has never been passed, and it is a new card
 * that FSRS gives its first stability and difficulty to. A new card carries no
 * difficulty either, because FSRS rejects one half of a memory state. Every
 * other direction is a review card, and its last review is the day that the
 * elapsed days count back to.
 *
 * `reps` and `lapses` are counters that FSRS-6 does not read, so the app does
 * not store them.
 */
function toCard(memory: Memory, elapsed: number, now: Date): Card {
  const learned = memory.stability > 0;
  const lastReview = new Date(now.getTime() - elapsed * MS_PER_DAY);

  return {
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
}

/**
 * The days of an FSRS interval, as the schedule stores them.
 *
 * FSRS counts the days between two dates, so a leap year can carry an interval
 * one day past the maximum. A pass always gives at least one day.
 */
function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, days));
}

/**
 * Spread an interval by up to 5%, so that the words a learner adds on one day
 * do not come back on one day for ever.
 *
 * Short intervals keep their exact length, because one day of spread on a two
 * day interval is a large share of it.
 */
export function fuzzInterval(interval: number, random: () => number = Math.random): number {
  if (interval < FUZZ_FROM_DAYS) return interval;
  const spread = Math.max(1, Math.round(interval * FUZZ_RATIO));
  const offset = Math.floor(random() * (2 * spread + 1)) - spread;
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, interval + offset));
}

/**
 * The date a direction comes back, from the interval it moved to.
 *
 * An interval of 0 comes back the next day. The learner sees the word again
 * soon, and the interval stays 0 to record that the direction is not learned.
 */
export function dueDateFrom(interval: number, now: Date, random?: () => number): Date {
  const days = Math.max(1, fuzzInterval(interval, random));
  const dueDate = new Date(now.getTime());
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}
