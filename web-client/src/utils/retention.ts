import { DIRECTIONS, Direction, DirectionResult, Word } from '../types/models';
import { seedInterval } from './scheduling';
import { parseDueDate } from './dueDate';

/**
 * The four measurements of the scheduler: what the reviews did, and how far the
 * schedule has spread the words out.
 *
 * Every function here is pure — the counting rules and the derivations both, so
 * that a metric can be checked without a database. `retentionService.ts` holds
 * the Firestore read and write. See docs/adr/0013-retention-metrics.md.
 */

// ─── What a day of reviews recorded ──────────────────────────────────────────

/** The counters one direction collects on one day. */
export interface DirectionTally {
  /** Every graded question of this direction, learning attempts included. */
  attempts: number;
  /**
   * The attempts that were reviews: the direction had already been recalled at
   * least once, so the question tested a memory rather than forming one. True
   * retention is measured over these, as Anki measures it, because a first
   * meeting with a word carries no retention to report.
   */
  reviews: number;
  /** The reviews whose first attempt was correct. The numerator of true retention. */
  reviewPasses: number;
  /** Attempts that moved the direction up a bank. */
  promoted: number;
  /** Attempts that left the direction in the bank it held. */
  held: number;
  /** Attempts that moved the direction down a bank. */
  demoted: number;
}

/** The counters of every direction on one day. */
export type DayTally = Record<Direction, DirectionTally>;

export interface ReviewStatsDay {
  /** The local date the session ran on, as YYYY-MM-DD. */
  date: string;
  directions: DayTally;
}

/** What one graded question did, as `finishTest` observed it. */
export interface ReviewOutcome {
  direction: Direction;
  result: DirectionResult;
  /**
   * Whether the direction had been recalled before this question. A direction
   * with no stability has never been passed, so the question was the learner
   * meeting it rather than retrieving it.
   */
  learned: boolean;
  bankBefore: number;
  bankAfter: number;
}

const EMPTY_TALLY: DirectionTally = {
  attempts: 0,
  reviews: 0,
  reviewPasses: 0,
  promoted: 0,
  held: 0,
  demoted: 0,
};

/** A day with no reviews at all: the shape every reader can count on. */
export function emptyDayTally(): DayTally {
  return DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = { ...EMPTY_TALLY };
    return acc;
  }, {} as DayTally);
}

/**
 * The local date of an instant, as the document id of its day.
 *
 * The rollup is keyed by local date for the same reason the streak is: a
 * session that runs at 11pm belongs to the day the learner studied on.
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** The day key `days` days before `now`, the start of a lookback window. */
export function lookbackFrom(now: Date, days: number): string {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return dayKey(start);
}

/**
 * Add up what a session's questions did, per direction.
 *
 * A direction the session did not ask is absent from the result, and therefore
 * untouched by the write.
 */
export function tallyOutcomes(outcomes: ReviewOutcome[]): Partial<DayTally> {
  const tally: Partial<DayTally> = {};

  for (const outcome of outcomes) {
    const entry = tally[outcome.direction] ?? { ...EMPTY_TALLY };

    entry.attempts += 1;
    if (outcome.learned) {
      entry.reviews += 1;
      if (outcome.result === 'pass') entry.reviewPasses += 1;
    }
    if (outcome.bankAfter > outcome.bankBefore) entry.promoted += 1;
    else if (outcome.bankAfter < outcome.bankBefore) entry.demoted += 1;
    else entry.held += 1;

    tally[outcome.direction] = entry;
  }

  return tally;
}

// ─── What the counts and the words add up to ─────────────────────────────────

/**
 * The interval from which a direction counts as mature.
 *
 * Three weeks is the threshold Anki uses to separate a memory that has settled
 * from one still being formed. It sits inside bank 3, so a mature direction is
 * one the learner has held for longer than the schedule's first real gap.
 */
export const MATURE_INTERVAL_DAYS = 21;

/** How few reviews make a retention figure noise rather than a measurement. */
export const MIN_REVIEWS_FOR_RETENTION = 20;

/** The band the target retention sits in. */
export const TARGET_RETENTION_RANGE = { min: 0.85, max: 0.9 } as const;

/** What the rollups say about one direction over the whole window. */
export interface DirectionMetrics {
  direction: Direction;
  /** Every graded question of this direction in the window. */
  attempts: number;
  /** The attempts that tested a memory rather than forming one. */
  reviews: number;
  /**
   * The share of reviews whose first attempt was correct, or null when the
   * window holds too few reviews to say anything.
   */
  trueRetention: number | null;
  /** The share of attempts that moved the direction up a bank. */
  promotionRate: number | null;
  /** The share of attempts that left the direction where it was. */
  stallRate: number | null;
  /** The median interval, in days, of this direction's mature words. */
  medianMatureInterval: number | null;
  /** How many of this direction's words are mature. */
  matureCount: number;
}

/** Add up the daily rollups of a window into one tally per direction. */
export function sumDays(days: ReviewStatsDay[]): DayTally {
  return DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = days.reduce(
      (total, day) => {
        const entry = day.directions[direction];
        return {
          attempts: total.attempts + entry.attempts,
          reviews: total.reviews + entry.reviews,
          reviewPasses: total.reviewPasses + entry.reviewPasses,
          promoted: total.promoted + entry.promoted,
          held: total.held + entry.held,
          demoted: total.demoted + entry.demoted,
        };
      },
      { ...EMPTY_TALLY },
    );
    return acc;
  }, {} as DayTally);
}

/**
 * The interval a direction of a word holds.
 *
 * A direction that no session has asked since FSRS arrived carries no interval,
 * and its bank names the band it was in, so the bank seeds the value. This is
 * the same fallback the scheduler itself uses.
 */
export function directionInterval(word: Word, direction: Direction): number {
  const state = word.directions?.[direction];
  if (!state) return seedInterval(word.level ?? 1);
  return state.interval ?? seedInterval(state.level);
}

/** The middle value of a list of numbers, or null when the list is empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function share(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * The measurements of every direction: the counted ones from the rollups, the
 * interval ones from the words as they stand.
 *
 * Retention is withheld below a floor of reviews, because the first handful of
 * reviews of a direction give a figure that swings between 0 and 1 and invites
 * a conclusion the data does not support. The other rates are reported from the
 * first attempt, since they describe what happened rather than estimating a
 * probability.
 */
export function directionMetrics(days: ReviewStatsDay[], words: Word[]): DirectionMetrics[] {
  const totals = sumDays(days);

  return DIRECTIONS.map((direction) => {
    const tally = totals[direction];
    const matureIntervals = words
      .map((word) => directionInterval(word, direction))
      .filter((interval) => interval >= MATURE_INTERVAL_DAYS);

    return {
      direction,
      attempts: tally.attempts,
      reviews: tally.reviews,
      trueRetention:
        tally.reviews >= MIN_REVIEWS_FOR_RETENTION
          ? share(tally.reviewPasses, tally.reviews)
          : null,
      promotionRate: share(tally.promoted, tally.attempts),
      stallRate: share(tally.held, tally.attempts),
      medianMatureInterval: median(matureIntervals),
      matureCount: matureIntervals.length,
    };
  });
}

/** One day of the review load ahead. */
export interface ForecastDay {
  /** Days from today: 0 is today. */
  offset: number;
  /** How many directions come due on that day. */
  due: number;
}

export interface ReviewLoad {
  /** The days ahead, oldest first, starting at today. */
  days: ForecastDay[];
  /** Directions whose due date has already passed. They are not in `days`. */
  overdue: number;
  /** The mean directions per day across the window, overdue excluded. */
  perDay: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The review load ahead: how many directions come due on each of the next
 * `days` days.
 *
 * The forecast counts directions and not words, because a direction is the unit
 * the session asks and the unit the learner spends time on. It is a floor
 * rather than a prediction: it reads only the words the learner already has, so
 * new words and the reviews that today's failures will produce are not in it.
 * That is what makes it answer the question it is for — whether the load of the
 * words already added is about to outgrow the time the learner has.
 */
export function reviewLoad(words: Word[], days: number, now: Date = new Date()): ReviewLoad {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const counts = new Array<number>(days).fill(0);
  let overdue = 0;

  for (const word of words) {
    for (const direction of DIRECTIONS) {
      const dueDate = word.directions?.[direction]?.dueDate ?? word.due_date;
      if (!dueDate) continue;
      const parsed = parseDueDate(dueDate);
      if (!parsed) continue;

      const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
      const offset = Math.round((day - today) / MS_PER_DAY);

      if (offset < 0) overdue += 1;
      else if (offset < days) counts[offset] += 1;
    }
  }

  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    days: counts.map((due, offset) => ({ offset, due })),
    overdue,
    perDay: days === 0 ? 0 : total / days,
  };
}
