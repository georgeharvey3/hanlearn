/**
 * Tests for streakService.ts
 *
 * Split into two sections:
 *  1. calculateStreak — pure function, no Firebase needed
 *  2. recordTestCompletion / getStreakData — Firestore operations mocked at SDK level
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Firebase mocks (used by recordTestCompletion / getStreakData) ─────────────
const {
  mockDoc,
  mockCollection,
  mockGetDoc,
  mockGetDocs,
  mockSetDoc,
  mockQuery,
  mockOrderBy,
  mockIncrement,
  mockTimestampNow,
} = vi.hoisted(() => ({
  mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  mockCollection: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc: vi.fn(),
  mockQuery: vi.fn((_col: unknown, ...args: unknown[]) => ({ query: args })),
  mockOrderBy: vi.fn(),
  mockIncrement: vi.fn((n: number) => ({ increment: n })),
  mockTimestampNow: vi.fn(() => ({ toDate: () => new Date('2026-03-01T10:00:00Z') })),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  query: mockQuery,
  orderBy: mockOrderBy,
  increment: mockIncrement,
  Timestamp: { now: mockTimestampNow },
}));

vi.mock('../firebase/config', () => ({ db: {} }));

import { calculateStreak, recordTestCompletion, getStreakData } from './streakService';

// ─── calculateStreak (pure function) ─────────────────────────────────────────
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

// ─── recordTestCompletion ─────────────────────────────────────────────────────
describe('recordTestCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 10, 0, 0)); // March 1, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a new document with testsCount=1 when no prior completion exists today', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await recordTestCompletion('user-1');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.testsCount).toBe(1);
    expect(payload.completedAt).toBeDefined();
    // No merge option on the initial creation
    expect(mockSetDoc.mock.calls[0][2]).toBeUndefined();
  });

  it('increments testsCount when a completion already exists for today', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockSetDoc.mockResolvedValue(undefined);

    await recordTestCompletion('user-1');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, payload, options] = mockSetDoc.mock.calls[0];
    // increment() was called with 1
    expect(mockIncrement).toHaveBeenCalledWith(1);
    expect(payload.testsCount).toEqual(mockIncrement.mock.results[0].value);
    expect(options).toEqual({ merge: true });
  });

  it('uses the correct Firestore path: users/{userId}/testCompletions/{date}', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await recordTestCompletion('user-42');

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'user-42',
      'testCompletions',
      '2026-03-01'
    );
  });
});

// ─── getStreakData ─────────────────────────────────────────────────────────────
describe('getStreakData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when user has no completions', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await getStreakData('user-1');

    expect(result).toEqual([]);
  });

  it('maps each doc to { date, testsCount } using doc.id as the date', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: '2026-03-01', data: () => ({ testsCount: 3 }) },
        { id: '2026-02-28', data: () => ({ testsCount: 1 }) },
      ],
    });

    const result = await getStreakData('user-1');

    expect(result).toEqual([
      { date: '2026-03-01', testsCount: 3 },
      { date: '2026-02-28', testsCount: 1 },
    ]);
  });

  it('queries the correct collection path', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await getStreakData('user-99');

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'user-99',
      'testCompletions'
    );
  });

  it('orders results by completedAt descending', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await getStreakData('user-1');

    expect(mockOrderBy).toHaveBeenCalledWith('completedAt', 'desc');
  });
});
