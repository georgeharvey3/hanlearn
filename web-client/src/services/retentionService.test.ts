import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the module factory below, which vitest lifts above the imports,
// can close over them.
const { setSpy, incrementSpy } = vi.hoisted(() => ({
  setSpy: vi.fn(),
  incrementSpy: vi.fn((n: number) => ({ __increment: n })),
}));

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    increment: incrementSpy,
    Timestamp: { fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});

import { addSessionToBatch } from './retentionService';
import type { ReviewOutcome } from '../utils/retention';

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

describe('addSessionToBatch', () => {
  const batch = { set: setSpy } as never;

  beforeEach(() => {
    setSpy.mockClear();
    incrementSpy.mockClear();
  });

  it('writes nothing when the session graded nothing', () => {
    addSessionToBatch(batch, 'user-1', [], new Date(2026, 8, 2));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('writes the counters nested under the direction, as increments', () => {
    addSessionToBatch(batch, 'user-1', [outcome({ direction: 'PC' })], new Date(2026, 8, 2));

    const [ref, data, options] = setSpy.mock.calls[0];
    expect(ref.path).toBe('users/user-1/reviewStats/2026-09-02');
    expect(options).toEqual({ merge: true });
    expect(data.date).toBe('2026-09-02');
    // Nested, not a dotted field path: `set` reads a dotted key as a field name.
    expect(data.directions.PC.attempts).toEqual({ __increment: 1 });
    expect(data.directions.PC.promoted).toEqual({ __increment: 1 });
  });

  it('leaves out a counter the session did not move', () => {
    addSessionToBatch(batch, 'user-1', [outcome({ direction: 'PC' })], new Date(2026, 8, 2));

    const data = setSpy.mock.calls[0][1];
    expect(data.directions.PC).not.toHaveProperty('demoted');
    expect(data.directions.PC).not.toHaveProperty('held');
  });

  it('keys the document by the local date, not by UTC', () => {
    // 11pm local on 2 September: the session belongs to the day it was studied.
    addSessionToBatch(batch, 'user-1', [outcome()], new Date(2026, 8, 2, 23, 30));

    expect(setSpy.mock.calls[0][0].path).toBe('users/user-1/reviewStats/2026-09-02');
  });
});
