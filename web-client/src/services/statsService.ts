import { getUserWords } from './wordService';
import { getReviewStats } from './retentionService';
import { traceAsync } from './performanceService';
import {
  directionMetrics,
  reviewLoad,
  DirectionMetrics,
  ReviewLoad,
  MATURE_INTERVAL_DAYS,
  median,
  directionInterval,
  lookbackFrom,
  type ReviewStatsDay,
} from '../utils/retention';
import { DIRECTIONS, Word } from '../types/models';

/** How far back the counted metrics look, in days. */
export const RETENTION_WINDOW_DAYS = 30;

/** How far ahead the review load forecast reaches, in days. */
export const FORECAST_DAYS = 14;

export interface SchedulerStats {
  /** Per question type: retention, promotion, stall, and mature intervals. */
  directions: DirectionMetrics[];
  /** The median interval of every mature direction of every word, in days. */
  medianMatureInterval: number | null;
  /** How many directions across the collection are mature. */
  matureCount: number;
  /** Directions coming due over the next FORECAST_DAYS days. */
  load: ReviewLoad;
  /** How many days of the window held at least one review. */
  daysStudied: number;
  /** The length of the counted window, in days. */
  windowDays: number;
}

/** The median interval across every mature direction of every word. */
function overallMature(words: Word[]): { median: number | null; count: number } {
  const intervals: number[] = [];
  for (const word of words) {
    for (const direction of DIRECTIONS) {
      const interval = directionInterval(word, direction);
      if (interval >= MATURE_INTERVAL_DAYS) intervals.push(interval);
    }
  }
  return { median: median(intervals), count: intervals.length };
}

/** How many days of the window recorded a graded question. */
function daysStudied(days: ReviewStatsDay[]): number {
  return days.filter((day) =>
    DIRECTIONS.some((direction) => day.directions[direction].attempts > 0),
  ).length;
}

/**
 * Everything the scheduler stats view shows.
 *
 * Two reads: the words, for the intervals and the due dates they hold now, and
 * the daily rollups of the window, for what the reviews did. Neither depends on
 * the other, so they run together.
 */
export const getSchedulerStats = async (
  userId: string,
  listId?: string,
  now: Date = new Date(),
): Promise<SchedulerStats> =>
  traceAsync('scheduler_stats_load', async () => {
    const [words, days] = await Promise.all([
      getUserWords(userId, listId),
      getReviewStats(userId, lookbackFrom(now, RETENTION_WINDOW_DAYS)),
    ]);

    const mature = overallMature(words);

    return {
      directions: directionMetrics(days, words),
      medianMatureInterval: mature.median,
      matureCount: mature.count,
      load: reviewLoad(words, FORECAST_DAYS, now),
      daysStudied: daysStudied(days),
      windowDays: RETENTION_WINDOW_DAYS,
    };
  });
