import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSchedulerStats, FORECAST_DAYS, RETENTION_WINDOW_DAYS } from './statsService';
import * as wordService from './wordService';
import * as retentionService from './retentionService';
import { DIRECTIONS, Direction, DirectionStates, Word } from '../types/models';
import { emptyDayTally, MIN_REVIEWS_FOR_RETENTION } from '../utils/retention';

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));
vi.mock('./wordService');
vi.mock('./retentionService');
vi.mock('./performanceService', () => ({
  traceAsync: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

const mockedWordService = vi.mocked(wordService);
const mockedRetentionService = vi.mocked(retentionService);

const now = new Date(2026, 8, 2);

function makeWord(
  id: number,
  intervals: Partial<Record<Direction, number>>,
  dueDate: string,
): Word {
  const directions = DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = { level: 1, dueDate, interval: intervals[direction] ?? 0 };
    return acc;
  }, {} as DirectionStates);

  return {
    id,
    simp: `字${id}`,
    trad: `字${id}`,
    pinyin: 'pīn',
    meaning: 'meaning',
    level: 1,
    due_date: dueDate,
    directions,
  };
}

describe('getSchedulerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedRetentionService.getReviewStats.mockResolvedValue([]);
  });

  it('reads the rollups from the start of the window', async () => {
    await getSchedulerStats('user-1', undefined, now);

    expect(mockedRetentionService.getReviewStats).toHaveBeenCalledWith('user-1', '2026-08-04');
  });

  it('passes the list filter through to the words', async () => {
    await getSchedulerStats('user-1', 'list-7', now);

    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('user-1', 'list-7');
  });

  it('reports the window and the forecast length it used', async () => {
    const stats = await getSchedulerStats('user-1', undefined, now);

    expect(stats.windowDays).toBe(RETENTION_WINDOW_DAYS);
    expect(stats.load.days).toHaveLength(FORECAST_DAYS);
  });

  it('takes the overall median across every mature direction of every word', async () => {
    mockedWordService.getUserWords.mockResolvedValue([
      makeWord(1, { MC: 30, MP: 50 }, '2027/01/01'),
      makeWord(2, { MC: 10, MP: 70 }, '2027/01/01'),
    ]);

    const stats = await getSchedulerStats('user-1', undefined, now);

    // 10 is not mature, so the median is of 30, 50 and 70.
    expect(stats.matureCount).toBe(3);
    expect(stats.medianMatureInterval).toBe(50);
  });

  it('has no median at all when nothing is mature yet', async () => {
    mockedWordService.getUserWords.mockResolvedValue([makeWord(1, { MC: 3 }, '2027/01/01')]);

    const stats = await getSchedulerStats('user-1', undefined, now);

    expect(stats.medianMatureInterval).toBeNull();
    expect(stats.matureCount).toBe(0);
  });

  it('counts the days of the window that recorded a question', async () => {
    const busy = emptyDayTally();
    busy.MC = { ...busy.MC, attempts: 4, reviews: 4, reviewPasses: 4 };

    mockedRetentionService.getReviewStats.mockResolvedValue([
      { date: '2026-08-30', directions: busy },
      { date: '2026-08-31', directions: emptyDayTally() },
    ]);

    const stats = await getSchedulerStats('user-1', undefined, now);

    expect(stats.daysStudied).toBe(1);
  });

  it('carries the per-direction metrics through from the rollups', async () => {
    const day = emptyDayTally();
    day.CM = {
      attempts: MIN_REVIEWS_FOR_RETENTION,
      reviews: MIN_REVIEWS_FOR_RETENTION,
      reviewPasses: MIN_REVIEWS_FOR_RETENTION / 2,
      promoted: 0,
      held: MIN_REVIEWS_FOR_RETENTION,
      demoted: 0,
    };
    mockedRetentionService.getReviewStats.mockResolvedValue([
      { date: '2026-09-01', directions: day },
    ]);

    const stats = await getSchedulerStats('user-1', undefined, now);
    const cm = stats.directions.find((m) => m.direction === 'CM')!;

    expect(cm.trueRetention).toBeCloseTo(0.5);
    expect(cm.stallRate).toBe(1);
    expect(cm.promotionRate).toBe(0);
  });

  it('forecasts the load from the due dates the words hold', async () => {
    mockedWordService.getUserWords.mockResolvedValue([makeWord(1, {}, '2026/09/04')]);

    const stats = await getSchedulerStats('user-1', undefined, now);

    // All five directions of the word come due on the same day.
    expect(stats.load.days[2].due).toBe(5);
  });
});
