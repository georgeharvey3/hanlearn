import { describe, it, expect } from 'vitest';
import { dayKey, lookbackFrom, tallyOutcomes, type ReviewOutcome } from './retention';

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
