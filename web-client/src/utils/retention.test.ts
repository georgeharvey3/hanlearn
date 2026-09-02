import { describe, it, expect } from 'vitest';
import {
  directionInterval,
  directionMetrics,
  dayKey,
  emptyDayTally,
  lookbackFrom,
  median,
  reviewLoad,
  sumDays,
  tallyOutcomes,
  MATURE_INTERVAL_DAYS,
  MIN_REVIEWS_FOR_RETENTION,
  type DirectionTally,
  type ReviewOutcome,
  type ReviewStatsDay,
} from './retention';
import { DIRECTIONS, Direction, DirectionStates, Word } from '../types/models';

function day(date: string, entries: Partial<Record<Direction, Partial<DirectionTally>>>) {
  const directions = emptyDayTally();
  for (const direction of DIRECTIONS) {
    const entry = entries[direction];
    if (entry) directions[direction] = { ...directions[direction], ...entry };
  }
  return { date, directions } as ReviewStatsDay;
}

function makeDirections(
  overrides: Partial<Record<Direction, { level?: number; dueDate?: string; interval?: number }>>,
): DirectionStates {
  return DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = {
      // Far past every forecast window a test uses, so a direction a test does
      // not name adds nothing to the load it measures.
      level: 1,
      dueDate: '2027/01/01',
      ...overrides[direction],
    };
    return acc;
  }, {} as DirectionStates);
}

function makeWord(id: number, directions: DirectionStates): Word {
  return {
    id,
    simp: `字${id}`,
    trad: `字${id}`,
    pinyin: 'pīn',
    meaning: 'meaning',
    level: 1,
    due_date: '2027/01/01',
    directions,
  };
}

describe('median', () => {
  it('has none for an empty list', () => {
    expect(median([])).toBeNull();
  });

  it('takes the middle value of an odd list', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('takes the mean of the middle two of an even list', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe('sumDays', () => {
  it('adds every day of the window, per direction', () => {
    const totals = sumDays([
      day('2026-09-01', { CM: { attempts: 3, reviews: 2, reviewPasses: 1, promoted: 1, held: 2 } }),
      day('2026-09-02', { CM: { attempts: 2, reviews: 2, reviewPasses: 2, promoted: 2 } }),
    ]);

    expect(totals.CM.attempts).toBe(5);
    expect(totals.CM.reviewPasses).toBe(3);
    expect(totals.CM.promoted).toBe(3);
    expect(totals.MC.attempts).toBe(0);
  });
});

describe('directionInterval', () => {
  it('reads the stored interval', () => {
    const word = makeWord(1, makeDirections({ MC: { level: 4, interval: 44 } }));
    expect(directionInterval(word, 'MC')).toBe(44);
  });

  it('seeds from the bank when the direction has no interval yet', () => {
    const word = makeWord(1, makeDirections({ MC: { level: 4 } }));
    expect(directionInterval(word, 'MC')).toBe(30);
  });

  it('falls back to the top-level level for a word with no directions', () => {
    const word = { ...makeWord(1, makeDirections({})), directions: undefined, level: 5 };
    expect(directionInterval(word, 'MC')).toBe(60);
  });
});

describe('directionMetrics', () => {
  it('reports true retention over reviews, not over every attempt', () => {
    // 25 reviews, 20 of them passed, plus 10 first meetings that are not reviews.
    const days = [day('2026-09-01', { PC: { attempts: 35, reviews: 25, reviewPasses: 20 } })];
    const metrics = directionMetrics(days, []);
    const pc = metrics.find((m) => m.direction === 'PC')!;

    expect(pc.reviews).toBe(25);
    expect(pc.trueRetention).toBeCloseTo(0.8);
  });

  it('withholds retention below the review floor', () => {
    const days = [
      day('2026-09-01', {
        PC: {
          attempts: MIN_REVIEWS_FOR_RETENTION - 1,
          reviews: MIN_REVIEWS_FOR_RETENTION - 1,
          reviewPasses: 0,
        },
      }),
    ];
    const pc = directionMetrics(days, []).find((m) => m.direction === 'PC')!;

    expect(pc.trueRetention).toBeNull();
    expect(pc.reviews).toBe(MIN_REVIEWS_FOR_RETENTION - 1);
  });

  it('reports promotion and stall over every attempt', () => {
    const days = [day('2026-09-01', { CM: { attempts: 10, promoted: 2, held: 6, demoted: 2 } })];
    const cm = directionMetrics(days, []).find((m) => m.direction === 'CM')!;

    expect(cm.promotionRate).toBeCloseTo(0.2);
    expect(cm.stallRate).toBeCloseTo(0.6);
  });

  it('has no rates at all when a direction was never asked', () => {
    const cm = directionMetrics([], []).find((m) => m.direction === 'CM')!;

    expect(cm.trueRetention).toBeNull();
    expect(cm.promotionRate).toBeNull();
    expect(cm.stallRate).toBeNull();
  });

  it('takes the median interval of the mature words only', () => {
    const words = [
      makeWord(1, makeDirections({ MC: { interval: 10 } })),
      makeWord(2, makeDirections({ MC: { interval: 40 } })),
      makeWord(3, makeDirections({ MC: { interval: 100 } })),
      makeWord(4, makeDirections({ MC: { interval: 60 } })),
    ];
    const mc = directionMetrics([], words).find((m) => m.direction === 'MC')!;

    // 10 is below the maturity threshold, so the median is of 40, 60 and 100.
    expect(mc.matureCount).toBe(3);
    expect(mc.medianMatureInterval).toBe(60);
  });

  it('counts a direction exactly at the threshold as mature', () => {
    const words = [makeWord(1, makeDirections({ MC: { interval: MATURE_INTERVAL_DAYS } }))];
    const mc = directionMetrics([], words).find((m) => m.direction === 'MC')!;

    expect(mc.matureCount).toBe(1);
  });
});

describe('reviewLoad', () => {
  const now = new Date(2026, 8, 2); // 2 September 2026

  it('counts directions, not words, on the day they come due', () => {
    const words = [
      makeWord(
        1,
        makeDirections({
          MC: { dueDate: '2026/09/04' },
          MP: { dueDate: '2026/09/04' },
          PM: { dueDate: '2026/09/05' },
          PC: { dueDate: '2026/09/05' },
          CM: { dueDate: '2026/09/05' },
        }),
      ),
    ];
    const load = reviewLoad(words, 14, now);

    expect(load.days[2].due).toBe(2);
    expect(load.days[3].due).toBe(3);
    expect(load.overdue).toBe(0);
  });

  it('separates the overdue from the days ahead', () => {
    const words = [
      makeWord(1, makeDirections({ MC: { dueDate: '2026/08/30' }, MP: { dueDate: '2026/09/02' } })),
    ];
    const load = reviewLoad(words, 14, now);

    expect(load.overdue).toBe(1);
    expect(load.days[0].due).toBe(1);
  });

  it('leaves out what falls past the window', () => {
    const words = [makeWord(1, makeDirections({ MC: { dueDate: '2026/12/01' } }))];
    const load = reviewLoad(words, 14, now);

    expect(load.days.reduce((sum, d) => sum + d.due, 0)).toBe(0);
    expect(load.overdue).toBe(0);
  });

  it('averages across the window and not across the days with reviews', () => {
    const words = [makeWord(1, makeDirections({ MC: { dueDate: '2026/09/03' } }))];
    const load = reviewLoad(words, 10, now);

    expect(load.days).toHaveLength(10);
    expect(load.perDay).toBeCloseTo(0.1);
  });
});

function outcome(over: Partial<ReviewOutcome> = {}): ReviewOutcome {
  return {
    direction: 'MC',
    result: 'pass',
    learned: true,
    bankBefore: 2,
    bankAfter: 3,
    ...over,
  };
}

describe('tallyOutcomes', () => {
  it('leaves out a direction the session did not ask', () => {
    expect(Object.keys(tallyOutcomes([outcome({ direction: 'CM' })]))).toEqual(['CM']);
  });

  it('counts a first meeting as an attempt but not as a review', () => {
    const tally = tallyOutcomes([
      outcome({ learned: false, result: 'pass' }),
      outcome({ learned: true, result: 'pass' }),
    ]);

    expect(tally.MC).toMatchObject({ attempts: 2, reviews: 1, reviewPasses: 1 });
  });

  it('counts only a correct first attempt as a pass', () => {
    const tally = tallyOutcomes([
      outcome({ result: 'pass' }),
      outcome({ result: 'lapse' }),
      outcome({ result: 'fail' }),
    ]);

    expect(tally.MC).toMatchObject({ reviews: 3, reviewPasses: 1 });
  });

  it('splits the bank movement into promoted, held and demoted', () => {
    const tally = tallyOutcomes([
      outcome({ bankBefore: 2, bankAfter: 3 }),
      outcome({ bankBefore: 3, bankAfter: 3 }),
      outcome({ bankBefore: 3, bankAfter: 1 }),
    ]);

    expect(tally.MC).toMatchObject({ promoted: 1, held: 1, demoted: 1 });
  });
});

describe('dayKey and lookbackFrom', () => {
  it('keys by the local date, so a late session belongs to the day it was studied', () => {
    expect(dayKey(new Date(2026, 8, 2, 23, 30))).toBe('2026-09-02');
  });

  it('counts today as the last day of the window', () => {
    expect(lookbackFrom(new Date(2026, 8, 2), 30)).toBe('2026-08-04');
    expect(lookbackFrom(new Date(2026, 8, 2), 1)).toBe('2026-09-02');
  });
});
