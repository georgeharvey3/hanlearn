/**
 * The counting rules of the Dashboard: the sizes of session it offers, the
 * month of the calendar, the weeks of the progress chart and the recall of
 * each direction. Every function here is pure; `dashboardService.ts` reads the
 * data and the widgets draw it.
 *
 * No function here returns a word. A word seen on the Dashboard just before the
 * test asks it primes the answer, so the Dashboard shows counts only.
 */
import { DIRECTIONS, Direction, Word } from '../types/models';
import { BankCounts } from './directions';
import { BANKS } from './scheduling';
import { parseDueDate } from './dueDate';
import { dayKey, lookbackFrom, type LevelCounts, type ReviewStatsDay } from './retention';

/** The days of history the Dashboard reads: the calendar's months and the 12 weeks of progress. */
export const HISTORY_DAYS = 120;

/** The days ahead the calendar shows the questions due on. */
export const FORECAST_DAYS = 42;

/** The sizes of session the Dashboard offers. */
export type SessionSize = 'quick' | 'usual' | 'all';

export const SESSION_SIZES: readonly SessionSize[] = ['quick', 'usual', 'all'];

/** The questions in a quick session. */
export const QUICK_SESSION_QUESTIONS = 10;

/**
 * The question budget of a session size.
 *
 * `usual` is the learner's "Questions per session" setting. `all` asks every
 * candidate word once, which is the most a plan can ask, because a plan asks
 * one direction of each word. Neither end crosses the usual session, so the
 * three sizes stay in order.
 */
export function sizeBudget(size: SessionSize, usual: number, candidateCount: number): number {
  if (size === 'quick') return Math.min(QUICK_SESSION_QUESTIONS, usual);
  if (size === 'all') return Math.max(usual, candidateCount);
  return usual;
}

/** The window, in days, that the recall of a direction reads. */
export const RECALL_WINDOW_DAYS = 30;

/**
 * The share of reviews whose first attempt was correct, per direction, over the
 * last 30 days. A direction with no review in the window has no recall to give,
 * which is null rather than 0.
 */
export function recallByDirection(
  days: ReviewStatsDay[],
  now: Date,
): Record<Direction, number | null> {
  const from = lookbackFrom(now, RECALL_WINDOW_DAYS);
  const recent = days.filter((d) => d.date >= from);
  return DIRECTIONS.reduce(
    (acc, direction) => {
      const reviews = recent.reduce((sum, d) => sum + d.directions[direction].reviews, 0);
      const passes = recent.reduce((sum, d) => sum + d.directions[direction].reviewPasses, 0);
      acc[direction] = reviews === 0 ? null : passes / reviews;
      return acc;
    },
    {} as Record<Direction, number | null>,
  );
}

/** The weeks the progress chart covers. */
export const PROGRESS_WEEKS = 12;

export interface ProgressWeek {
  /** The day the point stands for, as YYYY-MM-DD. The last one is today. */
  date: string;
  /** The words at each level on that day, or null before the first snapshot. */
  levels: LevelCounts | null;
}

/**
 * The words at each level, one point a week for 12 weeks, ending today.
 *
 * A level only moves when a session ends, and each session leaves a snapshot
 * on its day. So the last snapshot on or before a day is the state of that day,
 * and a week without a session carries the week before forward.
 */
export function progressWeeks(days: ReviewStatsDay[], now: Date): ProgressWeek[] {
  const snapshots = days.filter((d) => d.levels).sort((a, b) => a.date.localeCompare(b.date));
  return Array.from({ length: PROGRESS_WEEKS }, (_, i) => {
    const point = new Date(now);
    point.setDate(point.getDate() - 7 * (PROGRESS_WEEKS - 1 - i));
    const date = dayKey(point);
    let levels: LevelCounts | null = null;
    for (const snapshot of snapshots) {
      if (snapshot.date > date) break;
      levels = snapshot.levels!;
    }
    return { date, levels };
  });
}

export interface CalendarDay {
  /** YYYY-MM-DD. */
  date: string;
  /** The day of the month. */
  day: number;
  /** Graded questions that day. */
  reviewed: number;
  /** Questions that moved a direction up a level that day. */
  promoted: number;
  /** Words due that day, for today and the forecast days ahead; else null. */
  due: number | null;
  isToday: boolean;
  future: boolean;
}

export interface CalendarMonth {
  /** The blank cells before the 1st, in a week that starts on Monday. */
  lead: number;
  cells: CalendarDay[];
  /** The graded questions of the month. */
  reviews: number;
  /** The level-ups of the month. */
  promoted: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const sumTally = (day: ReviewStatsDay | undefined, field: 'attempts' | 'promoted'): number =>
  day ? DIRECTIONS.reduce((sum, direction) => sum + day.directions[direction][field], 0) : 0;

/**
 * The month that holds `month`, as calendar cells: the past from the daily
 * rollups, and today and the days ahead from the forecast, where index 0 is
 * today with the overdue questions in it.
 */
export function calendarMonth(
  month: Date,
  days: ReviewStatsDay[],
  forecast: number[],
  now: Date,
): CalendarMonth {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const cells = Array.from({ length }, (_, i): CalendarDay => {
    const date = new Date(first.getFullYear(), first.getMonth(), i + 1);
    const key = dayKey(date);
    const offset = Math.round((date.getTime() - today) / MS_PER_DAY);
    const rollup = byDate.get(key);
    return {
      date: key,
      day: i + 1,
      reviewed: sumTally(rollup, 'attempts'),
      promoted: sumTally(rollup, 'promoted'),
      due: offset >= 0 && offset < forecast.length ? forecast[offset] : null,
      isToday: offset === 0,
      future: offset > 0,
    };
  });

  return {
    lead: (first.getDay() + 6) % 7,
    cells,
    reviews: cells.reduce((sum, c) => sum + c.reviewed, 0),
    promoted: cells.reduce((sum, c) => sum + c.promoted, 0),
  };
}

/** The level a word must reach to count as strong: Familiar. */
export const STRONG_LEVEL = 3;

/** The share of a direction's words at Familiar or above: one number per skill. */
export function strengthOf(counts: BankCounts): number {
  const total = BANKS.reduce((sum, bank) => sum + (counts[bank] ?? 0), 0);
  if (total === 0) return 0;
  const strong = BANKS.filter((bank) => bank >= STRONG_LEVEL).reduce(
    (sum, bank) => sum + (counts[bank] ?? 0),
    0,
  );
  return strong / total;
}

/**
 * The words at each level, every level present. A word without a level is at
 * level 1, as the read path treats it.
 */
export function levelCounts(words: Pick<Word, 'level'>[]): LevelCounts {
  const counts: LevelCounts = Object.fromEntries(BANKS.map((bank) => [bank, 0]));
  for (const word of words) counts[word.level ?? 1] += 1;
  return counts;
}

/**
 * What the Dashboard hands the Test page in the router state: the size of
 * session the learner chose, or that they chose to resume the unfinished one.
 * The Study button of the tab bar hands nothing, and gets the usual session.
 */
export interface SessionLaunch {
  size?: SessionSize;
  resume?: boolean;
}

/**
 * The words that fall due on each of the next `days` days, index 0 being today
 * with every overdue word in it. A word counts once, on its earliest due
 * direction, so today's count agrees with what a session can ask: one question
 * of each word.
 */
export function wordsDueAhead(words: Pick<Word, 'due_date'>[], days: number, now: Date): number[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const counts = new Array<number>(days).fill(0);
  for (const word of words) {
    const due = word.due_date ? parseDueDate(word.due_date) : null;
    if (!due) continue;
    const day = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const offset = Math.max(0, Math.round((day - today) / MS_PER_DAY));
    if (offset < days) counts[offset] += 1;
  }
  return counts;
}
