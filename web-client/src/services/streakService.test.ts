import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateStreak } from './streakService';

describe('calculateStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty dates array', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 when only today has a completion', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0)); // Feb 26, 2026 10am local
    expect(calculateStreak(['2026-02-26'])).toBe(1);
  });

  it('returns 1 when only yesterday has a completion', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0));
    expect(calculateStreak(['2026-02-25'])).toBe(1);
  });

  it('returns 0 when most recent completion is 2+ days ago', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0));
    expect(calculateStreak(['2026-02-24'])).toBe(0);
  });

  it('returns consecutive streak count', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0));
    // Dates sorted desc: today, yesterday, day before
    expect(calculateStreak(['2026-02-26', '2026-02-25', '2026-02-24'])).toBe(3);
  });

  it('breaks streak on gap', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0));
    // Gap between Feb 25 and Feb 23
    expect(calculateStreak(['2026-02-26', '2026-02-25', '2026-02-23'])).toBe(2);
  });

  it('handles same-day completion correctly (does not double-count)', () => {
    vi.setSystemTime(new Date(2026, 1, 26, 10, 0, 0));
    // Two entries for the same date should not break the streak
    // but since docs are per-date, this shouldn't normally happen
    // Still, duplicate dates should give diff=0 which breaks the streak at that point
    expect(calculateStreak(['2026-02-26', '2026-02-26'])).toBe(1);
  });

  it('parses dates as local time, not UTC (timezone regression)', () => {
    // Simulate a timezone where local midnight is ahead of UTC midnight
    // e.g., UTC+8: local 2026-02-26 00:00 = UTC 2026-02-25 16:00
    // If dates were parsed as UTC, "2026-02-26" would be UTC midnight,
    // and local today would be Feb 26 local midnight (which is later).
    // The fix uses parseLocalDate to avoid this discrepancy.
    vi.setSystemTime(new Date(2026, 1, 26, 0, 30, 0)); // Just after local midnight
    expect(calculateStreak(['2026-02-26'])).toBe(1);
  });

  it('handles month boundary correctly', () => {
    vi.setSystemTime(new Date(2026, 2, 1, 10, 0, 0)); // March 1
    expect(calculateStreak(['2026-03-01', '2026-02-28'])).toBe(2);
  });
});
