import { describe, it, expect } from 'vitest';
import {
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  STARTING_EASE,
  bankOf,
  dueDateFrom,
  elapsedDays,
  fuzzInterval,
  nextSchedule,
  seedInterval,
} from './scheduling';

const start = { interval: 0, ease: STARTING_EASE };

/** A review that ran on the day the schedule asked for. */
function onTime(schedule: { interval: number; ease: number }) {
  return schedule.interval;
}

describe('nextSchedule — a pass', () => {
  it('moves a direction that has never been passed to one day', () => {
    expect(nextSchedule(start, 'pass', onTime(start)).interval).toBe(1);
  });

  it('multiplies the interval by the ease', () => {
    const schedule = { interval: 10, ease: 2.5 };
    expect(nextSchedule(schedule, 'pass', onTime(schedule)).interval).toBe(25);
  });

  it('adds at least one day, so no interval stands still', () => {
    // A low ease would otherwise leave a one day interval at one day.
    const schedule = { interval: 1, ease: MIN_EASE };
    expect(nextSchedule(schedule, 'pass', onTime(schedule)).interval).toBe(2);
  });

  it('holds the ease', () => {
    const schedule = { interval: 10, ease: 2.5 };
    expect(nextSchedule(schedule, 'pass', onTime(schedule)).ease).toBe(2.5);
  });

  it('gives a late review half of the delay as credit', () => {
    // 30 days asked, 60 days elapsed: (30 + 15) * 2.5.
    const schedule = { interval: 30, ease: 2.5 };
    expect(nextSchedule(schedule, 'pass', 60).interval).toBe(113);
  });

  it('gives an early review no credit and no penalty', () => {
    const schedule = { interval: 30, ease: 2.5 };
    expect(nextSchedule(schedule, 'pass', 12).interval).toBe(75);
  });

  it('caps the interval at one year', () => {
    const schedule = { interval: 300, ease: 2.5 };
    expect(nextSchedule(schedule, 'pass', onTime(schedule)).interval).toBe(MAX_INTERVAL_DAYS);
  });

  it('reaches the cap in eight reviews from a new direction', () => {
    let schedule = start;
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      schedule = nextSchedule(schedule, 'pass', onTime(schedule));
      intervals.push(schedule.interval);
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50, 125, 313, 365]);
  });
});

describe('nextSchedule — a lapse', () => {
  it('halves the interval', () => {
    const schedule = { interval: 50, ease: 2.5 };
    expect(nextSchedule(schedule, 'lapse', onTime(schedule)).interval).toBe(25);
  });

  it('keeps at least one day of a direction that was passed once', () => {
    const schedule = { interval: 1, ease: 2.5 };
    expect(nextSchedule(schedule, 'lapse', onTime(schedule)).interval).toBe(1);
  });

  it('leaves a direction that has never been passed at zero', () => {
    expect(nextSchedule(start, 'lapse', 0).interval).toBe(0);
  });

  it('drops the ease by 0.15', () => {
    const schedule = { interval: 50, ease: 2.5 };
    expect(nextSchedule(schedule, 'lapse', onTime(schedule)).ease).toBeCloseTo(2.35);
  });

  it('takes no delay credit from a late review', () => {
    const schedule = { interval: 30, ease: 2.5 };
    expect(nextSchedule(schedule, 'lapse', 300).interval).toBe(15);
  });
});

describe('nextSchedule — a failure', () => {
  it('resets the interval to zero from any interval', () => {
    const schedule = { interval: 365, ease: 2.5 };
    expect(nextSchedule(schedule, 'fail', onTime(schedule)).interval).toBe(0);
  });

  it('drops the ease by 0.2', () => {
    const schedule = { interval: 50, ease: 2.5 };
    expect(nextSchedule(schedule, 'fail', onTime(schedule)).ease).toBeCloseTo(2.3);
  });
});

describe('nextSchedule — the ease range', () => {
  it('does not fall below the minimum', () => {
    let schedule = { interval: 10, ease: 1.4 };
    for (let i = 0; i < 5; i++) schedule = nextSchedule(schedule, 'fail', 10);
    expect(schedule.ease).toBe(MIN_EASE);
  });

  it('does not rise above the maximum', () => {
    const schedule = { interval: 10, ease: 3.0 };
    expect(nextSchedule(schedule, 'pass', 10).ease).toBe(3.0);
  });
});

describe('bankOf', () => {
  it('gives bank 1 to a direction that has never been passed', () => {
    expect(bankOf(0)).toBe(1);
  });

  it.each([
    [1, 2],
    [6, 2],
    [7, 3],
    [29, 3],
    [30, 4],
    [59, 4],
    [60, 5],
    [365, 5],
  ])('gives an interval of %i days bank %i', (interval, bank) => {
    expect(bankOf(interval)).toBe(bank);
  });

  it('agrees with the interval that each bank seeds', () => {
    // A document that the interval never touched keeps the bank it holds.
    for (const bank of [1, 2, 3, 4, 5]) {
      expect(bankOf(seedInterval(bank))).toBe(bank);
    }
  });
});

describe('elapsedDays', () => {
  const now = new Date(2026, 5, 20, 12, 0, 0);

  it('counts the whole days since the last review', () => {
    expect(elapsedDays(new Date(2026, 5, 10, 12, 0, 0), now, 5)).toBe(10);
  });

  it('reports the interval when the direction has no last review', () => {
    // No last review means no delay credit, so the review counts as on time.
    expect(elapsedDays(undefined, now, 7)).toBe(7);
  });

  it('never reports a negative count', () => {
    expect(elapsedDays(new Date(2026, 5, 25), now, 5)).toBe(0);
  });
});

describe('fuzzInterval', () => {
  it('leaves an interval below three days exact', () => {
    expect(fuzzInterval(2, () => 0)).toBe(2);
  });

  it('spreads a long interval by up to 5%', () => {
    // 100 days gives a spread of 5 days either way.
    expect(fuzzInterval(100, () => 0)).toBe(95);
    expect(fuzzInterval(100, () => 0.5)).toBe(100);
    expect(fuzzInterval(100, () => 0.999)).toBe(105);
  });

  it('spreads a short interval by one day either way', () => {
    expect(fuzzInterval(3, () => 0)).toBe(2);
    expect(fuzzInterval(3, () => 0.999)).toBe(4);
  });

  it('does not spread past the cap', () => {
    expect(fuzzInterval(MAX_INTERVAL_DAYS, () => 0.999)).toBe(MAX_INTERVAL_DAYS);
  });
});

describe('dueDateFrom', () => {
  const now = new Date(2026, 5, 20, 12, 0, 0);

  it('asks a direction that has never been passed again the next day', () => {
    expect(dueDateFrom(0, now, () => 0.5)).toEqual(new Date(2026, 5, 21, 12, 0, 0));
  });

  it('adds the interval to the date of the session', () => {
    expect(dueDateFrom(10, now, () => 0.5)).toEqual(new Date(2026, 5, 30, 12, 0, 0));
  });

  it('keeps the time of day of the session', () => {
    expect(dueDateFrom(10, now, () => 0.5).getHours()).toBe(12);
  });
});
