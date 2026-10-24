import { describe, it, expect } from 'vitest';
import {
  calendarMonth,
  levelCounts,
  progressWeeks,
  recallByDirection,
  sizeBudget,
  strengthOf,
  wordsDueAhead,
} from './dashboard';
import { emptyDayTally, type DirectionTally, type ReviewStatsDay } from './retention';
import { DIRECTIONS, Direction, Word } from '../types/models';

function day(
  date: string,
  entries: Partial<Record<Direction, Partial<DirectionTally>>>,
  levels?: ReviewStatsDay['levels'],
): ReviewStatsDay {
  const directions = emptyDayTally();
  for (const direction of DIRECTIONS) {
    const entry = entries[direction];
    if (entry) directions[direction] = { ...directions[direction], ...entry };
  }
  return { date, directions, ...(levels ? { levels } : {}) };
}

describe('sizeBudget', () => {
  it('gives a quick session 10 questions, the usual one the setting, and everything one per word', () => {
    expect(sizeBudget('quick', 25, 40)).toBe(10);
    expect(sizeBudget('usual', 25, 40)).toBe(25);
    expect(sizeBudget('all', 25, 40)).toBe(40);
  });

  it('never makes a quick session longer than the usual one', () => {
    expect(sizeBudget('quick', 5, 40)).toBe(5);
  });

  it('never makes everything shorter than the usual session', () => {
    expect(sizeBudget('all', 25, 3)).toBe(25);
  });
});

describe('recallByDirection', () => {
  const now = new Date(2026, 9, 23, 12);

  it('gives the first-try passes over the reviews of the last 30 days', () => {
    const days = [
      day('2026-09-20', { CM: { reviews: 50, reviewPasses: 0 } }),
      day('2026-10-01', {
        CM: { reviews: 10, reviewPasses: 6 },
        MC: { reviews: 4, reviewPasses: 4 },
      }),
      day('2026-10-23', { CM: { reviews: 10, reviewPasses: 9 } }),
    ];
    const recall = recallByDirection(days, now);
    expect(recall.CM).toBeCloseTo(0.75);
    expect(recall.MC).toBe(1);
  });

  it('gives null for a direction with no reviews in the window', () => {
    expect(recallByDirection([], now).PM).toBeNull();
  });
});

describe('progressWeeks', () => {
  const now = new Date(2026, 9, 23, 12);

  it('ends on today and steps back a week at a time', () => {
    const weeks = progressWeeks([], now);
    expect(weeks).toHaveLength(12);
    expect(weeks[11].date).toBe('2026-10-23');
    expect(weeks[10].date).toBe('2026-10-16');
    expect(weeks[0].date).toBe('2026-08-07');
  });

  it('takes for each week the last snapshot on or before it', () => {
    const days = [
      day('2026-10-10', {}, { 1: 4, 2: 10, 3: 5, 4: 1, 5: 0 }),
      day('2026-10-14', {}, { 1: 3, 2: 11, 3: 5, 4: 1, 5: 0 }),
      day('2026-10-15', {}),
      day('2026-10-20', {}, { 1: 2, 2: 9, 3: 8, 4: 1, 5: 0 }),
    ];
    const weeks = progressWeeks(days, now);
    expect(weeks[11].levels).toEqual({ 1: 2, 2: 9, 3: 8, 4: 1, 5: 0 });
    expect(weeks[10].levels).toEqual({ 1: 3, 2: 11, 3: 5, 4: 1, 5: 0 });
    expect(weeks[9].levels).toBeNull();
  });
});

describe('calendarMonth', () => {
  const now = new Date(2026, 9, 23, 12);
  const days = [
    day('2026-09-30', { MC: { attempts: 9, promoted: 9 } }),
    day('2026-10-05', { MC: { attempts: 20, promoted: 4 }, CM: { attempts: 10, promoted: 2 } }),
    day('2026-10-23', { PM: { attempts: 6, promoted: 1 } }),
  ];
  const forecast = [14, 3, 0, 8];

  it('starts the grid on a Monday', () => {
    // 1 October 2026 is a Thursday.
    expect(calendarMonth(now, days, forecast, now).lead).toBe(3);
    expect(calendarMonth(now, days, forecast, now).cells).toHaveLength(31);
  });

  it('counts what each past day reviewed and moved up', () => {
    const fifth = calendarMonth(now, days, forecast, now).cells[4];
    expect(fifth).toMatchObject({ date: '2026-10-05', reviewed: 30, promoted: 6, due: null });
  });

  it('gives today and the days ahead the words due from the forecast', () => {
    const { cells } = calendarMonth(now, days, forecast, now);
    expect(cells[22]).toMatchObject({ isToday: true, reviewed: 6, due: 14 });
    expect(cells[25]).toMatchObject({ future: true, due: 8 });
    expect(cells[26].due).toBeNull();
  });

  it('adds up the reviews and the level-ups of the month', () => {
    expect(calendarMonth(now, days, forecast, now)).toMatchObject({ reviews: 36, promoted: 7 });
  });
});

describe('strengthOf', () => {
  it('gives the share of words at Familiar or above', () => {
    expect(strengthOf({ 1: 2, 2: 3, 3: 1, 4: 2, 5: 2 })).toBe(0.5);
  });

  it('gives 0 for a direction with no words', () => {
    expect(strengthOf({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })).toBe(0);
  });
});

describe('levelCounts', () => {
  it('counts the words at each level, with every level present', () => {
    const words = [{ level: 1 }, { level: 3 }, { level: 3 }, {}] as Word[];
    expect(levelCounts(words)).toEqual({ 1: 2, 2: 0, 3: 2, 4: 0, 5: 0 });
  });
});

describe('wordsDueAhead', () => {
  const now = new Date(2026, 9, 23, 12);
  const word = (due: string) => ({ due_date: due }) as Word;

  it('counts the words that fall due on each day, with the overdue ones today', () => {
    const words = [
      word('2026/10/20'),
      word('2026/10/23'),
      word('2026/10/24'),
      word('2026/10/24'),
      word('2026/11/30'),
    ];
    expect(wordsDueAhead(words, 3, now)).toEqual([2, 2, 0]);
  });
});
