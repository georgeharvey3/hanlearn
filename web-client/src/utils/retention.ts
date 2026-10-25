import { DIRECTIONS, Direction, DirectionResult } from '../types/models';

/**
 * The daily rollup of what the reviews did. The Dashboard reads it for the
 * recall of each direction, the calendar and the progress chart.
 *
 * Every function here is pure, so that a counting rule can be checked without
 * a database. `retentionService.ts` holds the Firestore read and write. See
 * docs/adr/0013-retention-metrics.md.
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

/** How many words sit at each level, keyed by level 1 to 5. */
export type LevelCounts = Record<number, number>;

export interface ReviewStatsDay {
  /** The local date the session ran on, as YYYY-MM-DD. */
  date: string;
  directions: DayTally;
  /**
   * The words of the whole collection at each level, as the last session of
   * the day left them. Days before the snapshot existed carry none.
   */
  levels?: LevelCounts;
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
