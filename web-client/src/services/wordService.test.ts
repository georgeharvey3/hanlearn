/**
 * Tests for wordService.ts — focused on the spaced repetition algorithm in finishTest.
 * Firebase Firestore is mocked at the SDK level since wordService IS the service layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these vars are available when vi.mock factories run (hoisted to top)
const {
  mockBatchUpdate,
  mockBatchSet,
  mockBatchCommit,
  mockWriteBatch,
  mockIncrement,
  mockGetDoc,
  mockGetDocs,
  mockDoc,
  mockCollection,
  mockSetDoc,
  mockDeleteDoc,
  mockUpdateDoc,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockTimestampFromDate,
  mockTimestampNow,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockWriteBatch = vi.fn(() => ({
    update: mockBatchUpdate,
    set: mockBatchSet,
    commit: mockBatchCommit,
  }));
  return {
    mockBatchUpdate,
    mockBatchSet,
    mockBatchCommit,
    mockWriteBatch,
    mockIncrement: vi.fn((n: number) => ({ __increment: n })),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
    mockCollection: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockQuery: vi.fn(),
    mockWhere: vi.fn(),
    mockOrderBy: vi.fn(),
    mockTimestampFromDate: vi.fn((date: Date) => ({ toDate: () => date, _date: date })),
    mockTimestampNow: vi.fn(() => ({ toDate: () => new Date() })),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  updateDoc: mockUpdateDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  increment: mockIncrement,
  Timestamp: {
    fromDate: mockTimestampFromDate,
    now: mockTimestampNow,
  },
  writeBatch: mockWriteBatch,
}));

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('./dictionaryService', () => ({
  searchWord: vi.fn(),
  lookupCharacter: vi.fn(),
  lookupCharacterByTrad: vi.fn(),
}));

import {
  finishTest,
  getUserWords,
  getDueUserWords,
  addWordToList,
  removeWordFromList,
  updateWordMeaning,
  addCustomWord,
} from './wordService';
import { lookupCharacter, lookupCharacterByTrad } from './dictionaryService';
import { DIRECTIONS, DirectionResult } from '../types/models';

/** The interval in days that each bank seeds, for a document without one. */
const SEED_INTERVALS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 30, 5: 60 };

/** A stored direction record, as Firestore holds it. */
function storedDirection(bank: number, date: Date, extra: object = {}) {
  return { bank, dueDate: { toDate: () => date }, ...extra };
}

/** Days between the date of the session and a due date the session wrote. */
function daysFrom(now: Date, dueDate: { toDate: () => Date }) {
  return Math.round((dueDate.toDate().getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** All five directions at the same bank and due date. */
function allDirections(bank: number, date = new Date(2026, 0, 1)) {
  return DIRECTIONS.reduce<Record<string, object>>((acc, direction) => {
    acc[direction] = storedDirection(bank, date);
    return acc;
  }, {});
}

function makeFakeDoc(bank: number, simp: string, exists = true, directions?: object) {
  return {
    exists: () => exists,
    data: () => ({
      wordId: '1',
      wordData: { simp, trad: simp, pinyin: 'pīn', meaning: 'meaning' },
      amendedMeaning: null,
      bank,
      dueDate: { toDate: () => new Date(2026, 0, 1) },
      addedAt: { toDate: () => new Date() },
      ...(directions ? { directions } : {}),
    }),
  };
}

/** Ask every direction with the same grade. */
function allAsked(result: DirectionResult) {
  return DIRECTIONS.reduce<Record<string, DirectionResult>>((acc, direction) => {
    acc[direction] = result;
    return acc;
  }, {});
}

describe('finishTest — per-direction scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockBatchCommit,
    });
  });

  // ─── The case in issue #328 ────────────────────────────────────────────────

  it('a failure in one direction does not change the interval of the other four', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { ...allAsked('pass'), CM: 'fail' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    // The four that passed grow from the seven days of bank 3; handwriting
    // fails and comes back the next day.
    expect(update.directions.CM.interval).toBe(0);
    for (const direction of ['MC', 'MP', 'PM', 'PC']) {
      expect(update.directions[direction].interval).toBeGreaterThan(SEED_INTERVALS[3]);
    }
  });

  it('leaves a direction the session did not ask completely untouched', async () => {
    const cmDate = new Date(2026, 5, 1);
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(2, '你好', true, { ...allDirections(2), CM: storedDirection(5, cmDate) }),
    );

    // Handwriting switched off: the session asks the other four only.
    await finishTest('user-1', [
      { word_id: 1, directions: { MC: 'pass', MP: 'pass', PM: 'fail', PC: 'pass' } },
    ]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.CM.bank).toBe(5);
    expect(update.directions.CM.dueDate.toDate()).toEqual(cmDate);
  });

  // ─── Per-direction bank movement ───────────────────────────────────────────

  it('advances an asked direction out of bank 1 on its first pass', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.interval).toBe(3);
    expect(update.directions.MC.bank).toBe(2);
  });

  it('keeps a direction in its band when one pass does not leave it', async () => {
    // Bank 3 covers 7 to 29 days, and one pass from 7 days reaches 27.
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.bank).toBe(3);
  });

  it('does not advance a direction beyond bank 5', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好', true, allDirections(5)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.bank).toBe(5);
  });

  it('does not schedule a direction past one year', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(5, '你好', true, {
        ...allDirections(5),
        MC: storedDirection(5, new Date(2026, 0, 1), { interval: 300, ease: 2.5 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.interval).toBe(365);
  });

  it('cuts the interval of a direction on a lapse', async () => {
    // A lapse did not retrieve the answer, so the schedule asks the direction
    // again within days.
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.interval).toBeGreaterThanOrEqual(1);
    expect(update.directions.MC.interval).toBeLessThan(SEED_INTERVALS[4]);
  });

  it('moves a direction that lapses on its first question off bank 1', async () => {
    // The learner did answer, after one wrong attempt, so the direction is no
    // longer one that has never been answered correctly.
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.interval).toBe(1);
    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.bank).toBe(2);
  });

  it('resets a direction to bank 1 on a failure, from any bank', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好', true, allDirections(5)));

    await finishTest('user-1', [{ word_id: 1, directions: { PC: 'fail' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.PC.interval).toBe(0);
    expect(update.directions.PC.bank).toBe(1);
  });

  it('raises the difficulty of a direction that lapses', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    // The seed difficulty of the starting ease is about 3.6.
    expect(update.directions.MC.difficulty).toBeGreaterThan(4);
    expect(update.directions.MC.stability).toBeLessThan(SEED_INTERVALS[4]);
  });

  it('grows the stability of a direction that passes', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.stability).toBeGreaterThan(SEED_INTERVALS[4]);
    expect(update.directions.MC.difficulty).toBeCloseTo(3.65, 1);
  });

  it('stops writing the ease, which FSRS replaces', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2026, 0, 1), { interval: 30, ease: 2.5 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC).not.toHaveProperty('ease');
  });

  // ─── The elapsed days ──────────────────────────────────────────────────────

  it('gives a late correct answer a longer interval than one on time', async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 1, 27, 12, 0, 0);
    vi.setSystemTime(now);

    // 30 days asked, 60 days elapsed. The memory held for twice as long as the
    // schedule expected, and FSRS reads that as a more stable memory.
    const lastReview = new Date(2025, 11, 29, 12, 0, 0);
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2026, 0, 28), {
          interval: 30,
          ease: 2.5,
          lastReview: { toDate: () => lastReview },
        }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const late = mockBatchUpdate.mock.calls[0][1].directions.MC.interval;

    mockBatchUpdate.mockClear();
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2026, 1, 27), {
          interval: 30,
          ease: 2.5,
          lastReview: { toDate: () => new Date(2026, 0, 28, 12, 0, 0) },
        }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(late).toBeGreaterThan(mockBatchUpdate.mock.calls[0][1].directions.MC.interval);

    vi.useRealTimers();
  });

  it('gives a direction with no last review no delay credit', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2020, 0, 1), { interval: 30, ease: 2.5 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    // The due date is years old, and the review still counts as on time.
    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.interval).toBe(97);
  });

  it('writes the date of the session as the last review of every direction it asked', async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 1, 27, 12, 0, 0);
    vi.setSystemTime(now);

    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好', true, allDirections(2)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass', CM: 'fail' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.lastReview.toDate()).toEqual(now);
    expect(update.directions.CM.lastReview.toDate()).toEqual(now);
    expect(update.directions.MP.lastReview).toBeUndefined();

    vi.useRealTimers();
  });

  it('schedules each direction from the interval it moved to', async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 1, 27, 12, 0, 0);
    vi.setSystemTime(now);

    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好', true, allDirections(2)));

    // MC passes from three days to 13; CM fails and comes back the next day.
    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass', CM: 'fail' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    // The fuzz spreads an interval of 13 days by one day either way.
    expect(daysFrom(now, update.directions.MC.dueDate)).toBeGreaterThanOrEqual(12);
    expect(daysFrom(now, update.directions.MC.dueDate)).toBeLessThanOrEqual(14);
    expect(daysFrom(now, update.directions.CM.dueDate)).toBe(1);

    vi.useRealTimers();
  });

  // ─── Derived fields ────────────────────────────────────────────────────────

  it('writes the lowest bank across the directions to the derived field', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { ...allAsked('pass'), CM: 'fail' } }]);

    // Four directions reach 4, handwriting resets to 1.
    expect(mockBatchUpdate.mock.calls[0][1].bank).toBe(1);
  });

  it('writes the earliest due date across the directions to the derived field', async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 1, 27, 12, 0, 0);
    vi.setSystemTime(now);

    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    // The four pass from 30 days to 97; handwriting fails and comes back the
    // next day, which is then the earliest of the five.
    await finishTest('user-1', [{ word_id: 1, directions: { ...allAsked('pass'), CM: 'fail' } }]);

    expect(daysFrom(now, mockBatchUpdate.mock.calls[0][1].dueDate)).toBe(1);

    vi.useRealTimers();
  });

  it('derives the top-level fields from a direction it did not ask when that one is lowest', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(1, '你好', true, {
        ...allDirections(4),
        CM: storedDirection(1, new Date(2026, 0, 1)),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.bank).toBe(1);
    expect(update.dueDate.toDate()).toEqual(new Date(2026, 0, 1));
  });

  // ─── Documents the migration has not reached ───────────────────────────────

  it('derives the five directions from bank and dueDate on a legacy document', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好')); // no directions map

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.bank).toBe(3); // asked, advanced from the old bank
    expect(update.directions.CM.bank).toBe(2); // untouched, derived from the old bank
    expect(Object.keys(update.directions).sort()).toEqual([...DIRECTIONS].sort());
  });

  it('seeds the memory of a direction that holds a bank and no interval', async () => {
    // Bank 3 is seven days in the table that the interval replaced, and the
    // stability of a seven day interval is seven days.
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.interval).toBe(27);
    expect(update.directions.MC.stability).toBeGreaterThan(SEED_INTERVALS[3]);
  });

  it('seeds the memory of a direction that holds an interval and an ease', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        // The same seven days, written by the calculation that FSRS replaced.
        MC: storedDirection(3, new Date(2026, 0, 1), { interval: 7, ease: 2.5 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.interval).toBe(27);
  });

  // ─── Tone errors ──────────────────────────────────────────────────────────

  it('writes the tone errors of a direction the session collected them in', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好', true, allDirections(2)));

    await finishTest('user-1', [
      { word_id: 1, directions: { PM: 'lapse' }, toneErrors: { PM: 3 } },
    ]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.PM.toneErrors).toBe(3);
  });

  it('adds the tone errors of the session to the count the direction holds', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(2, '你好', true, {
        ...allDirections(2),
        PM: { bank: 2, dueDate: { toDate: () => new Date(2026, 0, 1) }, toneErrors: 4 },
      }),
    );

    await finishTest('user-1', [
      { word_id: 1, directions: { PM: 'lapse' }, toneErrors: { PM: 2 } },
    ]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.PM.toneErrors).toBe(6);
  });

  it('leaves the counter off a direction that has never collected a tone error', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好', true, allDirections(2)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC).not.toHaveProperty('toneErrors');
  });

  it('keeps the tone errors of a direction the session did not ask', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(2, '你好', true, {
        ...allDirections(2),
        PM: { bank: 2, dueDate: { toDate: () => new Date(2026, 0, 1) }, toneErrors: 7 },
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.PM.toneErrors).toBe(7);
  });

  // ─── The demotion and the leech counter ───────────────────────────────────

  it('demotes a lapsed direction rather than resetting it', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好', true, allDirections(5)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    // Some of the 60 days the direction had survives, and the schedule asks it
    // again within three days.
    expect(update.directions.MC.stability).toBeGreaterThan(0);
    expect(update.directions.MC.stability).toBeLessThan(SEED_INTERVALS[5]);
    expect(update.directions.MC.interval).toBeLessThanOrEqual(3);
  });

  it('asks a lapsed direction again within three days, even from a year', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(5, '你好', true, {
        ...allDirections(5),
        MC: storedDirection(5, new Date(2026, 0, 1), {
          stability: 400,
          difficulty: 2,
          interval: 365,
        }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.interval).toBe(3);
    expect(update.directions.MC.stability).toBeLessThanOrEqual(400);
  });

  it('counts a lapse and a failure on a direction that was learned', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse', PC: 'fail' } }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.MC.lapses).toBe(1);
    expect(update.directions.PC.lapses).toBe(1);
  });

  it('adds the failed retrievals of the session to the count the direction holds', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2026, 0, 1), { lapses: 6 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'fail' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.lapses).toBe(7);
  });

  it('does not count a failure on a direction that has never been passed', async () => {
    // A word the learner has just met is not a word they have forgotten.
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'fail' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC).not.toHaveProperty('lapses');
  });

  it('leaves the counter off a direction that passes', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好', true, allDirections(4)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC).not.toHaveProperty('lapses');
  });

  it('keeps the count of a direction that passes after collecting failures', async () => {
    // A pass does not clear the record: a leech stays flagged until the learner
    // does something about it.
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(4, '你好', true, {
        ...allDirections(4),
        MC: storedDirection(4, new Date(2026, 0, 1), { lapses: 8 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.lapses).toBe(8);
  });

  it('keeps the count of a direction the session did not ask', async () => {
    mockGetDoc.mockResolvedValue(
      makeFakeDoc(2, '你好', true, {
        ...allDirections(2),
        PM: storedDirection(2, new Date(2026, 0, 1), { lapses: 9 }),
      }),
    );

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate.mock.calls[0][1].directions.PM.lapses).toBe(9);
  });

  // ─── Batch behavior and the return value ───────────────────────────────────

  it('skips words whose Firestore document does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', false));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('returns a newDates record keyed by simp with formatted date strings', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    const newDates = await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(newDates).toHaveProperty('你好');
    expect(newDates['你好']).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('processes multiple words in a single batch', async () => {
    mockGetDoc
      .mockResolvedValueOnce(makeFakeDoc(1, '你好', true, allDirections(1)))
      .mockResolvedValueOnce(makeFakeDoc(3, '谢谢', true, allDirections(3)));

    await finishTest('user-1', [
      { word_id: 1, directions: { MC: 'pass' } },
      { word_id: 2, directions: { MC: 'fail' } },
    ]);

    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
    expect(mockBatchUpdate.mock.calls[0][1].directions.MC.bank).toBe(2);
    expect(mockBatchUpdate.mock.calls[1][1].directions.MC.bank).toBe(1);
  });

  it('returns empty object when all word documents are missing', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', false));

    const result = await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(result).toEqual({});
  });

  it('writes nothing for a word whose payload asks no direction', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '你好', true, allDirections(2)));

    await finishTest('user-1', [{ word_id: 1, directions: {} }]);

    const update = mockBatchUpdate.mock.calls[0][1];
    for (const direction of DIRECTIONS) {
      expect(update.directions[direction].bank).toBe(2);
    }
  });
});

describe('finishTest — the review counts it records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockBatchCommit,
    });
  });

  /** The rollup document the session wrote, as a plain object of counts. */
  function rollup() {
    const [, data] = mockBatchSet.mock.calls[0];
    const directions: Record<string, Record<string, number>> = {};
    for (const [direction, counters] of Object.entries(
      data.directions as Record<string, Record<string, { __increment: number }>>,
    )) {
      directions[direction] = Object.fromEntries(
        Object.entries(counters).map(([field, value]) => [field, value.__increment]),
      );
    }
    return directions;
  }

  it('writes the rollup in the same batch as the reschedules', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: allAsked('pass') }]);

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockBatchSet.mock.calls[0][0].path).toContain('users/user-1/reviewStats/');
    expect(mockBatchSet.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('counts a correct first attempt on a learned direction as a review pass', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(rollup().MC).toMatchObject({ attempts: 1, reviews: 1, reviewPasses: 1 });
  });

  it('does not count a first meeting as a review', async () => {
    // Bank 1 seeds an interval of 0, so the direction has never been recalled.
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(rollup().MC.attempts).toBe(1);
    expect(rollup().MC.reviews).toBeUndefined();
  });

  it('counts a wrong first attempt as a review that did not pass', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'lapse' } }]);

    expect(rollup().MC).toMatchObject({ attempts: 1, reviews: 1 });
    expect(rollup().MC.reviewPasses).toBeUndefined();
  });

  it('records a pass that lengthened the interval inside its bank as held', async () => {
    // A pass at bank 3 grows the interval, but bank 3 runs from 7 to 29 days,
    // so the direction has not moved up a band and the promotion rate must not
    // claim that it did.
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(rollup().MC.held).toBe(1);
    expect(rollup().MC.promoted).toBeUndefined();
  });

  it('records a pass that crossed into the next bank as a promotion', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', true, allDirections(1)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(rollup().MC.promoted).toBe(1);
  });

  it('records a failure that reset the interval as a demotion', async () => {
    // A failure takes the interval to 0, which is bank 1.
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { CM: 'fail' } }]);

    expect(rollup().CM.demoted).toBe(1);
  });

  it('leaves out a direction the session did not ask', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [{ word_id: 1, directions: { MC: 'pass' } }]);

    expect(Object.keys(rollup())).toEqual(['MC']);
  });

  it('adds up the questions of every word in the session', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好', true, allDirections(3)));

    await finishTest('user-1', [
      { word_id: 1, directions: { MC: 'pass' } },
      { word_id: 2, directions: { MC: 'pass' } },
      { word_id: 3, directions: { MC: 'fail' } },
    ]);

    expect(rollup().MC).toMatchObject({ attempts: 3, reviews: 3, reviewPasses: 2 });
  });

  it('writes no rollup when the session graded nothing', async () => {
    await finishTest('user-1', []);

    expect(mockBatchSet).not.toHaveBeenCalled();
  });
});

// ─── Helper to make fake getDocs snapshot ────────────────────────────────────
function makeFakeSnapshot(docs: Array<{ id: string; data: object }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
    size: docs.length,
  };
}

function makeWordDoc(
  overrides: Partial<{
    id: string;
    simp: string;
    trad: string;
    pinyin: string;
    meaning: string;
    amendedMeaning: string | null;
    bank: number;
    directions: object;
  }> = {},
) {
  const {
    id = '42',
    simp = '学习',
    trad = '學習',
    pinyin = 'xué xí',
    meaning = 'to study',
    amendedMeaning = null,
    bank = 2,
    directions,
  } = overrides;
  return {
    id,
    data: {
      wordId: id,
      wordData: { simp, trad, pinyin, meaning },
      amendedMeaning,
      bank,
      dueDate: { toDate: () => new Date(2026, 2, 5) },
      addedAt: { toDate: () => new Date(2026, 1, 1) },
      ...(directions ? { directions } : {}),
    },
  };
}

// ─── getUserWords ─────────────────────────────────────────────────────────────
describe('getUserWords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped Word objects sorted by due date', async () => {
    const doc1 = makeWordDoc({
      id: '1',
      simp: '你好',
      trad: '你好',
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
      bank: 1,
    });
    const doc2 = makeWordDoc({
      id: '2',
      simp: '谢谢',
      trad: '謝謝',
      pinyin: 'xiè xiè',
      meaning: 'thank you',
      bank: 3,
    });
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([doc1, doc2]));

    const words = await getUserWords('user-1');

    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({
      id: 1,
      simp: '你好',
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
      level: 1,
    });
    expect(words[1]).toMatchObject({ id: 2, simp: '谢谢', level: 3 });
  });

  it('uses amendedMeaning when present', async () => {
    const doc = makeWordDoc({ amendedMeaning: 'custom meaning' });
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([doc]));

    const words = await getUserWords('user-1');

    expect(words[0].meaning).toBe('custom meaning');
    expect(words[0].ammended_meaning).toBe('custom meaning');
  });

  it('falls back to wordData.meaning when amendedMeaning is null', async () => {
    const doc = makeWordDoc({ meaning: 'original', amendedMeaning: null });
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([doc]));

    const words = await getUserWords('user-1');

    expect(words[0].meaning).toBe('original');
    expect(words[0].ammended_meaning).toBeUndefined();
  });

  it('returns empty array when user has no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const words = await getUserWords('user-1');

    expect(words).toEqual([]);
  });

  it('includes due_date as formatted YYYY/MM/DD string', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeWordDoc()]));

    const words = await getUserWords('user-1');

    expect(words[0].due_date).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});

// ─── mapDocumentToWord — the directions map ───────────────────────────────────
describe('the directions map on a read word', () => {
  beforeEach(() => vi.clearAllMocks());

  it('derives all five directions from bank and dueDate on a legacy document', async () => {
    // A document written before the map existed carries neither key.
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeWordDoc({ bank: 3 })]));

    const [word] = await getUserWords('user-1');

    expect(Object.keys(word.directions!).sort()).toEqual([...DIRECTIONS].sort());
    for (const direction of DIRECTIONS) {
      expect(word.directions![direction]).toEqual({ level: 3, dueDate: '2026/03/05' });
    }
  });

  it('reads the stored map on a migrated document', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeWordDoc({
          bank: 1,
          directions: {
            MC: storedDirection(4, new Date(2026, 3, 1)),
            MP: storedDirection(3, new Date(2026, 2, 20)),
            PM: storedDirection(2, new Date(2026, 2, 10)),
            PC: storedDirection(2, new Date(2026, 2, 10)),
            CM: storedDirection(1, new Date(2026, 2, 5)),
          },
        }),
      ]),
    );

    const [word] = await getUserWords('user-1');

    expect(word.directions!.MC).toEqual({ level: 4, dueDate: '2026/04/01' });
    expect(word.directions!.CM).toEqual({ level: 1, dueDate: '2026/03/05' });
  });

  it('fills the missing entries of a partial map from bank and dueDate', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeWordDoc({ bank: 2, directions: { CM: storedDirection(5, new Date(2026, 5, 1)) } }),
      ]),
    );

    const [word] = await getUserWords('user-1');

    expect(word.directions!.CM).toEqual({ level: 5, dueDate: '2026/06/01' });
    expect(word.directions!.MC).toEqual({ level: 2, dueDate: '2026/03/05' });
    expect(word.directions!.PC).toEqual({ level: 2, dueDate: '2026/03/05' });
  });

  it('is present on due words too, which are read without due_date', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeWordDoc({ bank: 1 })]));

    const [word] = await getDueUserWords('user-1');

    expect(word.due_date).toBeUndefined();
    expect(word.directions!.MC).toEqual({ level: 1, dueDate: '2026/03/05' });
  });

  it('leaves the derived top-level level unchanged', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeWordDoc({ bank: 3 })]));

    const [word] = await getUserWords('user-1');

    expect(word.level).toBe(3);
  });
});

// ─── getDueUserWords ──────────────────────────────────────────────────────────
describe('getDueUserWords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped Word objects without due_date field', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([makeWordDoc({ id: '5', simp: '水', bank: 2 })]),
    );

    const words = await getDueUserWords('user-1');

    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ id: 5, simp: '水', level: 2 });
    expect(words[0].due_date).toBeUndefined();
  });

  it('uses where query with dueDate <= end of today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 22, 10, 0, 0)); // 10am

    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    await getDueUserWords('user-1');

    expect(mockWhere).toHaveBeenCalledWith('dueDate', '<=', expect.anything());
    expect(mockQuery).toHaveBeenCalled();

    // Verify the timestamp is set to end of day, not the current time
    const timestampArg: Date = mockTimestampFromDate.mock.calls[0][0];
    expect(timestampArg.getHours()).toBe(23);
    expect(timestampArg.getMinutes()).toBe(59);
    expect(timestampArg.getSeconds()).toBe(59);

    vi.useRealTimers();
  });

  it('returns empty array when no words are due', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const words = await getDueUserWords('user-1');

    expect(words).toEqual([]);
  });
});

// ─── addWordToList ────────────────────────────────────────────────────────────
describe('addWordToList', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleWord = { id: 99, simp: '书', trad: '書', pinyin: 'shū', meaning: 'book' };

  it('calls setDoc with bank=1 and correct word data', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([])); // 0 existing words
    mockSetDoc.mockResolvedValue(undefined);

    await addWordToList('user-1', sampleWord);

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const setDocArg = mockSetDoc.mock.calls[0][1];
    expect(setDocArg.bank).toBe(1);
    expect(setDocArg.wordData.simp).toBe('书');
    expect(setDocArg.amendedMeaning).toBeNull();
  });

  it('writes all five directions at bank 1 and the same due date', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));
    mockSetDoc.mockResolvedValue(undefined);

    await addWordToList('user-1', sampleWord);

    const setDocArg = mockSetDoc.mock.calls[0][1];
    expect(Object.keys(setDocArg.directions).sort()).toEqual([...DIRECTIONS].sort());
    for (const direction of DIRECTIONS) {
      expect(setDocArg.directions[direction].bank).toBe(1);
      // The derived top-level dueDate is the same Timestamp instance.
      expect(setDocArg.directions[direction].dueDate).toBe(setDocArg.dueDate);
    }
  });

  it('sets due date to today when word count <= 9', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28));
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot(Array.from({ length: 5 }, (_, i) => makeWordDoc({ id: String(i) }))),
    );
    mockSetDoc.mockResolvedValue(undefined);

    await addWordToList('user-1', sampleWord);

    const setDocArg = mockSetDoc.mock.calls[0][1];
    const dueDateArg: Date = mockTimestampFromDate.mock.calls[0][0];
    expect(dueDateArg.getDate()).toBe(new Date(2026, 1, 28).getDate());

    vi.useRealTimers();
  });

  it('sets due date to tomorrow when word count > 9', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28));
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot(Array.from({ length: 10 }, (_, i) => makeWordDoc({ id: String(i) }))),
    );
    mockSetDoc.mockResolvedValue(undefined);

    await addWordToList('user-1', sampleWord);

    const dueDateArg: Date = mockTimestampFromDate.mock.calls[0][0];
    const expectedTomorrow = new Date(2026, 1, 29);
    expect(dueDateArg.getDate()).toBe(expectedTomorrow.getDate());

    vi.useRealTimers();
  });
});

// ─── removeWordFromList ───────────────────────────────────────────────────────
describe('removeWordFromList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteDoc with the correct document reference', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);

    await removeWordFromList('user-1', 42);

    expect(mockDeleteDoc).toHaveBeenCalledOnce();
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-1', 'userWords', '42');
  });
});

// ─── updateWordMeaning ────────────────────────────────────────────────────────
describe('updateWordMeaning', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateDoc with amendedMeaning', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateWordMeaning('user-1', 42, 'new meaning');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ amendedMeaning: 'new meaning' });
  });

  it('passes the correct document path', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateWordMeaning('user-2', 7, 'meaning');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-2', 'userWords', '7');
  });
});

// ─── addCustomWord ────────────────────────────────────────────────────────────
describe('addCustomWord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // addWordToList (called internally) needs getDocs + setDoc
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('assembles simp/trad/pinyin by looking up each character (charSet=simp)', async () => {
    vi.mocked(lookupCharacter)
      .mockResolvedValueOnce({ pinyin: 'nǐ', trad: '你' })
      .mockResolvedValueOnce({ pinyin: 'hǎo', trad: '好' });

    const word = await addCustomWord('user-1', '你好', 'hello', 'simp');

    expect(word.simp).toBe('你好');
    expect(word.trad).toBe('你好');
    expect(word.pinyin).toBe('nǐ hǎo');
    expect(word.meaning).toBe('hello');
  });

  it('assembles simp/trad/pinyin by looking up each character (charSet=trad)', async () => {
    vi.mocked(lookupCharacterByTrad)
      .mockResolvedValueOnce({ pinyin: 'xué', simp: '学' })
      .mockResolvedValueOnce({ pinyin: 'xí', simp: '习' });

    const word = await addCustomWord('user-1', '學習', 'to study', 'trad');

    expect(word.simp).toBe('学习');
    expect(word.trad).toBe('學習');
    expect(word.pinyin).toBe('xué xí');
    expect(word.meaning).toBe('to study');
  });

  it('falls back to the raw char for simp/trad when lookupCharacter returns null', async () => {
    vi.mocked(lookupCharacter).mockResolvedValue(null);

    const word = await addCustomWord('user-1', '好', 'good', 'simp');

    expect(word.simp).toBe('好');
    expect(word.trad).toBe('好');
    expect(word.pinyin).toBe('');
  });

  it('falls back to the raw char when lookupCharacterByTrad returns null (charSet=trad)', async () => {
    vi.mocked(lookupCharacterByTrad).mockResolvedValue(null);

    const word = await addCustomWord('user-1', '習', 'to practice', 'trad');

    expect(word.simp).toBe('習');
    expect(word.trad).toBe('習');
    expect(word.pinyin).toBe('');
  });

  it('handles multi-char word where some chars are found and some are not', async () => {
    vi.mocked(lookupCharacter)
      .mockResolvedValueOnce({ pinyin: 'nǐ', trad: '你' })
      .mockResolvedValueOnce(null); // second char not found

    const word = await addCustomWord('user-1', '你X', 'hello X', 'simp');

    expect(word.simp).toBe('你X');
    expect(word.trad).toBe('你X');
    expect(word.pinyin).toBe('nǐ'); // only pinyin from the found char
  });

  it('returns a word with a negative id (avoids collision with dictionary IDs)', async () => {
    vi.mocked(lookupCharacter).mockResolvedValue(null);

    const word = await addCustomWord('user-1', '好', 'good', 'simp');

    expect(word.id).toBeLessThan(0);
  });

  it('calls setDoc (via addWordToList) with the constructed word data', async () => {
    vi.mocked(lookupCharacter).mockResolvedValue({ pinyin: 'shū', trad: '書' });

    await addCustomWord('user-1', '书', 'book', 'simp');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const setDocArg = mockSetDoc.mock.calls[0][1];
    expect(setDocArg.wordData.simp).toBe('书');
    expect(setDocArg.wordData.trad).toBe('書');
    expect(setDocArg.wordData.meaning).toBe('book');
  });

  it('uses trad char as trad fallback when lookupCharacter has no trad field', async () => {
    // lookupCharacter returns trad: undefined-ish — simulate with empty string fallback
    vi.mocked(lookupCharacter).mockResolvedValue({ pinyin: 'hǎo', trad: '' });

    const word = await addCustomWord('user-1', '好', 'good', 'simp');

    // trad falls back to the original char when trad is falsy
    expect(word.trad).toBe('好');
  });
});
