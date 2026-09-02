import { describe, it, expect } from 'vitest';
import { DirectionResult } from '../types/models';
import {
  LEECH_THRESHOLD,
  MAX_DIFFICULTY,
  MAX_INTERVAL_DAYS,
  MAX_POST_LAPSE_INTERVAL_DAYS,
  MIN_DIFFICULTY,
  MIN_EASE,
  MAX_EASE,
  STARTING_EASE,
  bankOf,
  currentMemory,
  difficultyFromEase,
  dueDateFrom,
  elapsedDays,
  fuzzInterval,
  isLeech,
  nextLapses,
  nextMemory,
  seedInterval,
  type Memory,
} from './scheduling';

const now = new Date(2026, 5, 20, 12, 0, 0);

/** A direction that no session has ever passed. */
const fresh: Memory = { stability: 0, difficulty: 0, interval: 0 };

/** A direction that the schedule asks every 30 days. */
const learned: Memory = { stability: 30, difficulty: 5, interval: 30 };

/** The result of a review that ran on the day the schedule asked for. */
function onTime(memory: Memory, grade: DirectionResult): Memory {
  return nextMemory(memory, grade, memory.interval, now);
}

describe('nextMemory — a pass', () => {
  it('gives a direction that has never been passed its first interval', () => {
    expect(onTime(fresh, 'pass').interval).toBe(3);
  });

  it('grows the interval of a direction that is already learned', () => {
    expect(onTime(learned, 'pass').interval).toBeGreaterThan(learned.interval);
  });

  it('grows the stability with the interval', () => {
    const next = onTime(learned, 'pass');
    expect(next.stability).toBeGreaterThan(learned.stability);
  });

  it('gives a late review a longer interval than a review on time', () => {
    const late = nextMemory(learned, 'pass', 60, now);
    expect(late.interval).toBeGreaterThan(onTime(learned, 'pass').interval);
  });

  it('gives an early review a shorter interval than a review on time', () => {
    const early = nextMemory(learned, 'pass', 10, now);
    expect(early.interval).toBeLessThan(onTime(learned, 'pass').interval);
  });

  it('caps the interval at one year', () => {
    const stable: Memory = { stability: 900, difficulty: 5, interval: 365 };
    expect(onTime(stable, 'pass').interval).toBe(MAX_INTERVAL_DAYS);
  });

  it('holds a hard direction back', () => {
    const easy: Memory = { ...learned, difficulty: MIN_DIFFICULTY };
    const hard: Memory = { ...learned, difficulty: MAX_DIFFICULTY };
    expect(onTime(hard, 'pass').interval).toBeLessThan(onTime(easy, 'pass').interval);
  });
});

describe('nextMemory — a lapse', () => {
  it('keeps the direction in the schedule', () => {
    expect(onTime(learned, 'lapse').interval).toBeGreaterThanOrEqual(1);
  });

  it('cuts the interval far below a pass from the same state', () => {
    expect(onTime(learned, 'lapse').interval).toBeLessThan(learned.interval);
  });

  it('drops the stability', () => {
    expect(onTime(learned, 'lapse').stability).toBeLessThan(learned.stability);
  });

  it('raises the difficulty', () => {
    expect(onTime(learned, 'lapse').difficulty).toBeGreaterThan(learned.difficulty);
  });

  it('gives the same memory as a failure, because neither retrieved the answer', () => {
    const lapse = onTime(learned, 'lapse');
    const fail = onTime(learned, 'fail');
    expect(lapse.stability).toBe(fail.stability);
    expect(lapse.difficulty).toBe(fail.difficulty);
  });

  it('comes back later than a failure, which comes back the next day', () => {
    expect(onTime(learned, 'lapse').interval).toBeGreaterThan(onTime(learned, 'fail').interval);
  });
});

describe('nextMemory — a failure', () => {
  it('resets the interval to zero from any state', () => {
    expect(onTime(fresh, 'fail').interval).toBe(0);
    expect(onTime(learned, 'fail').interval).toBe(0);
    expect(
      nextMemory({ stability: 900, difficulty: 2, interval: 365 }, 'fail', 365, now).interval,
    ).toBe(0);
  });

  it('drops the stability', () => {
    expect(onTime(learned, 'fail').stability).toBeLessThan(learned.stability);
  });

  it('keeps a stability, so the next pass starts from the memory and not from zero', () => {
    expect(onTime(learned, 'fail').stability).toBeGreaterThan(0);
  });

  it('raises the difficulty', () => {
    expect(onTime(learned, 'fail').difficulty).toBeGreaterThan(learned.difficulty);
  });
});

describe('nextMemory — the demotion of a failed retrieval', () => {
  // The whole range of memories a direction can hold when it loses one, from
  // the first day it was learned to a year of stability.
  const memories: Memory[] = [
    { stability: 0.5, difficulty: 9, interval: 1 },
    { stability: 3, difficulty: 5, interval: 3 },
    { stability: 30, difficulty: 5, interval: 30 },
    { stability: 400, difficulty: 2, interval: 365 },
  ];
  // On time, a year late, and answered the day it was scheduled.
  const delays = [0, 1, 30, 365];

  it('never leaves a direction more stable than it was', () => {
    for (const memory of memories) {
      for (const elapsed of delays) {
        for (const grade of ['lapse', 'fail'] as const) {
          expect(nextMemory(memory, grade, elapsed, now).stability).toBeLessThanOrEqual(
            memory.stability,
          );
        }
      }
    }
  });

  it('keeps some of the stability the direction had, rather than resetting it', () => {
    for (const memory of memories) {
      expect(onTime(memory, 'lapse').stability).toBeGreaterThan(0);
    }
  });

  it('gives a direction that has never been passed its first stability', () => {
    // There is nothing to demote here: the failed attempt is the learner
    // meeting the word, so FSRS seeds the memory rather than cutting it.
    expect(onTime(fresh, 'lapse').stability).toBeGreaterThan(0);
    expect(onTime(fresh, 'fail').stability).toBeGreaterThan(0);
  });

  it('asks a lapsed direction again within three days, from any interval', () => {
    for (const memory of memories) {
      for (const elapsed of delays) {
        const interval = nextMemory(memory, 'lapse', elapsed, now).interval;
        expect(interval).toBeGreaterThanOrEqual(1);
        expect(interval).toBeLessThanOrEqual(MAX_POST_LAPSE_INTERVAL_DAYS);
      }
    }
  });

  it('caps the interval of a direction that FSRS would give more than three days', () => {
    // A very stable direction lapses to four or five days on the FSRS curve.
    const veryStable: Memory = { stability: 400, difficulty: 2, interval: 365 };
    expect(onTime(veryStable, 'lapse').interval).toBe(MAX_POST_LAPSE_INTERVAL_DAYS);
  });

  it('does not cap a pass', () => {
    expect(onTime(learned, 'pass').interval).toBeGreaterThan(MAX_POST_LAPSE_INTERVAL_DAYS);
  });
});

describe('nextLapses', () => {
  it('counts a lapse and a failure on a direction that was learned', () => {
    expect(nextLapses(0, learned, 'lapse')).toBe(1);
    expect(nextLapses(3, learned, 'fail')).toBe(4);
  });

  it('does not count a pass', () => {
    expect(nextLapses(3, learned, 'pass')).toBe(3);
  });

  it('does not count a failure on a direction that was never learned', () => {
    // The learner has not forgotten a word they have never recalled.
    expect(nextLapses(0, fresh, 'fail')).toBe(0);
    expect(nextLapses(0, fresh, 'lapse')).toBe(0);
  });
});

describe('isLeech', () => {
  it('is false for a direction that has never lost a retrieval', () => {
    expect(isLeech(undefined)).toBe(false);
    expect(isLeech(0)).toBe(false);
  });

  it('is false below the threshold and true at it', () => {
    expect(isLeech(LEECH_THRESHOLD - 1)).toBe(false);
    expect(isLeech(LEECH_THRESHOLD)).toBe(true);
    expect(isLeech(LEECH_THRESHOLD + 5)).toBe(true);
  });
});

describe('nextMemory — the difficulty range', () => {
  it('does not rise above the maximum', () => {
    let memory = learned;
    for (let i = 0; i < 20; i += 1) memory = onTime(memory, 'fail');
    expect(memory.difficulty).toBeLessThanOrEqual(MAX_DIFFICULTY);
  });

  it('does not fall below the minimum', () => {
    let memory = learned;
    for (let i = 0; i < 20; i += 1) memory = onTime(memory, 'pass');
    expect(memory.difficulty).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
  });
});

describe('difficultyFromEase', () => {
  it('gives the starting ease a difficulty near the middle', () => {
    expect(difficultyFromEase(STARTING_EASE)).toBeCloseTo(3.65, 2);
  });

  it('gives the lowest ease the highest difficulty', () => {
    expect(difficultyFromEase(MIN_EASE)).toBe(MAX_DIFFICULTY);
  });

  it('gives the highest ease the lowest difficulty', () => {
    expect(difficultyFromEase(MAX_EASE)).toBe(MIN_DIFFICULTY);
  });

  it('clamps an ease from outside the range', () => {
    expect(difficultyFromEase(0.5)).toBe(MAX_DIFFICULTY);
    expect(difficultyFromEase(5)).toBe(MIN_DIFFICULTY);
  });
});

describe('currentMemory', () => {
  it('reads the memory that FSRS wrote', () => {
    expect(currentMemory({ bank: 4, stability: 42, difficulty: 6, interval: 40 })).toEqual({
      stability: 42,
      difficulty: 6,
      interval: 40,
    });
  });

  it('seeds the stability of a direction that holds an interval', () => {
    // The interval and the stability are both the days at which recall is 0.9,
    // so the schedule of the direction does not move.
    const memory = currentMemory({ bank: 4, interval: 30, ease: STARTING_EASE });
    expect(memory.stability).toBe(30);
    expect(memory.interval).toBe(30);
  });

  it('seeds the difficulty of a direction that holds an ease', () => {
    expect(currentMemory({ bank: 4, interval: 30, ease: MIN_EASE }).difficulty).toBe(
      MAX_DIFFICULTY,
    );
  });

  it('seeds the interval of a direction that holds only a bank', () => {
    expect(currentMemory({ bank: 3 }).interval).toBe(seedInterval(3));
    expect(currentMemory({ bank: 3 }).stability).toBe(seedInterval(3));
  });

  it('leaves a direction at bank 1 with no memory, so FSRS treats it as new', () => {
    // FSRS rejects one half of a memory state, so a stability of 0 carries no
    // difficulty either.
    expect(currentMemory({ bank: 1 })).toEqual({ stability: 0, difficulty: 0, interval: 0 });
    expect(currentMemory({ bank: 1, ease: STARTING_EASE, interval: 0 })).toEqual({
      stability: 0,
      difficulty: 0,
      interval: 0,
    });
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
