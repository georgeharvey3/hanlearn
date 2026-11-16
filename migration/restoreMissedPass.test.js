import { describe, it, expect } from 'vitest';
import { restoreMissedPass, passMemory } from './restoreMissedPass';
import { nextMemory } from '../web-client/src/utils/scheduling';

const DAY = 24 * 60 * 60 * 1000;
const at = new Date('2026-11-16T09:03:00Z');

describe('passMemory', () => {
  it('gives the memory that the app gives a pass', () => {
    for (const [stability, difficulty, elapsed] of [
      [12, 5, 12],
      [40, 3, 55],
      [2.5, 7, 1],
    ]) {
      const memory = { stability, difficulty, interval: Math.round(stability) };
      expect(passMemory(memory, elapsed, at)).toEqual(nextMemory(memory, 'pass', elapsed, at));
    }
  });
});

describe('restoreMissedPass', () => {
  const before = { stability: 20, difficulty: 5, lastReview: new Date(at.getTime() - 21 * DAY) };
  const reviews = [
    { grade: 'lapse', reviewedAt: at, before, toneErrors: 0 },
    { grade: 'lapse', reviewedAt: new Date(at.getTime() + 2 * 60000), before: { ...before }, toneErrors: 1 },
  ];

  it('grades the first wrong review again as a pass', () => {
    const current = { bank: 2, interval: 1, stability: 6, difficulty: 7, lapses: 3, toneErrors: 1 };
    const restored = restoreMissedPass(current, reviews);
    const expected = nextMemory({ stability: 20, difficulty: 5, interval: 20 }, 'pass', 21, at);

    expect(restored.interval).toBe(expected.interval);
    expect(restored.stability).toBe(expected.stability);
    expect(restored.bank).toBeGreaterThanOrEqual(3);
    expect(restored.lastReview).toEqual(at);
    expect(restored.dueDate.getTime()).toBe(at.getTime() + expected.interval * DAY);
    // Two lapses and one tone error came from the wrong grades.
    expect(restored.lapses).toBe(1);
    expect(restored.toneErrors).toBeUndefined();
  });

  it('refuses a day whose first review is a pass', () => {
    expect(() => restoreMissedPass({ bank: 3 }, [{ ...reviews[0], grade: 'pass' }])).toThrow();
  });
});
