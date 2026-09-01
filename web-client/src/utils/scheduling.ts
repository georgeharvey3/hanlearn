import { DirectionResult } from '../types/models';

/**
 * The interval calculation for one direction of one word.
 *
 * A direction carries an interval in days and an ease. The grade of a question
 * multiplies the interval by the ease, and the product is the next interval.
 * There is no table of fixed steps, so a direction that a learner finds easy
 * grows past a direction of the same word that they find hard.
 *
 * The calculation reads the elapsed days since the last review, not the
 * interval that the schedule asked for. A learner who answers a 30 day
 * direction correctly on day 60 proves a memory that is more stable than the
 * schedule expected, and the next interval takes half of that delay as credit.
 *
 * Every function here is pure. `finishTest` in `wordService.ts` holds the
 * Firestore write. See docs/adr/0008-multiplicative-intervals.md.
 */

/** The longest interval the schedule gives. */
export const MAX_INTERVAL_DAYS = 365;

/** The ease a direction starts with, and the range it stays in. */
export const STARTING_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

/** What each grade adds to the ease of a direction. */
const EASE_STEPS: Record<DirectionResult, number> = {
  pass: 0,
  lapse: -0.15,
  fail: -0.2,
};

/** What a lapse leaves of the interval. */
const LAPSE_FACTOR = 0.5;

/** The share of the delay that a late correct answer takes as credit. */
const DELAY_CREDIT = 0.5;

/** The interval from which the fuzz applies, and how far it spreads. */
const FUZZ_FROM_DAYS = 3;
const FUZZ_RATIO = 0.05;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The interval that a direction with no interval field starts from, read from
 * the bank it holds.
 *
 * These are the five steps of the fixed table that this calculation replaces,
 * so a document written before the interval existed keeps the schedule it had.
 * Bank 1 gives 0 because bank 1 means the direction has never been answered
 * correctly, and the schedule asks such a direction again the next day.
 */
const SEED_INTERVALS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 30, 5: 60 };

/** The scheduling state of one direction. */
export interface Schedule {
  /** Days between the last review and the next one. 0 is a direction that has never been passed. */
  interval: number;
  /** The multiplier the next interval takes. */
  ease: number;
}

/**
 * The interval a direction starts from, for a direction that holds a bank but
 * no interval. Every other caller reads the stored interval.
 */
export function seedInterval(bank: number): number {
  return SEED_INTERVALS[bank] ?? 0;
}

/**
 * The bank of an interval.
 *
 * The bank is derived now: the grade moves the interval, and the interval gives
 * the bank. The five bands are the five steps of the table that the interval
 * replaces, so a word keeps the bank it had until its next review moves it.
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
 * reports the interval it holds, so that its next review takes no delay credit.
 */
export function elapsedDays(lastReview: Date | undefined, now: Date, interval: number): number {
  if (!lastReview) return interval;
  return Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / MS_PER_DAY));
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
}

/**
 * The interval and ease a direction moves to.
 *
 * A pass multiplies the interval, plus half of the days the review ran late, by
 * the ease. A lapse halves the interval, and a failure resets it to 0. The ease
 * holds on a pass and drops on the other two grades, so a direction that lapses
 * again and again grows more slowly every time.
 */
export function nextSchedule(current: Schedule, grade: DirectionResult, elapsed: number): Schedule {
  const ease = clampEase(current.ease + EASE_STEPS[grade]);

  if (grade === 'fail') return { interval: 0, ease };

  if (grade === 'lapse') {
    // A direction that has never been passed has nothing to halve.
    const interval =
      current.interval === 0 ? 0 : Math.max(1, Math.round(current.interval * LAPSE_FACTOR));
    return { interval, ease };
  }

  const delay = Math.max(0, elapsed - current.interval);
  const grown = Math.round((current.interval + delay * DELAY_CREDIT) * current.ease);
  // A pass always adds at least one day, so the first pass of a direction moves
  // it off 0 and no interval can stand still.
  const interval = Math.min(MAX_INTERVAL_DAYS, Math.max(grown, current.interval + 1));
  return { interval, ease };
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
