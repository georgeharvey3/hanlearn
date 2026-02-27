/**
 * Tests for wordService.ts — focused on the spaced repetition algorithm in finishTest.
 * Firebase Firestore is mocked at the SDK level since wordService IS the service layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these vars are available when vi.mock factories run (hoisted to top)
const {
  mockBatchUpdate,
  mockBatchCommit,
  mockWriteBatch,
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
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockWriteBatch = vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }));
  return {
    mockBatchUpdate,
    mockBatchCommit,
    mockWriteBatch,
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

import { finishTest } from './wordService';

// Bank intervals defined in wordService (duplicated here for assertion purposes)
const BANK_INTERVALS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 30, 5: 60 };

function makeFakeDoc(bank: number, simp: string, exists = true) {
  return {
    exists: () => exists,
    data: () => ({
      wordId: '1',
      wordData: { simp, trad: simp, pinyin: 'pīn', meaning: 'meaning' },
      amendedMeaning: null,
      bank,
      dueDate: { toDate: () => new Date() },
      addedAt: { toDate: () => new Date() },
    }),
  };
}

describe('finishTest — spaced repetition bank logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
  });

  it('advances bank by 1 when score=4 and bank < 5', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(2);
  });

  it('advances bank from 4 to 5 (max) when score=4', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(5);
  });

  it('does not advance bank beyond 5 when score=4 and already at max', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(5); // stays at 5
  });

  it('resets bank to 1 when score < 4 (score=3)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 3 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(1);
  });

  it('resets bank to 1 from bank 5 when score < 4 (score=0)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 0 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(1);
  });

  it('advances bank from 2 to 3 when score=4 (middle bank)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '学'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(3);
  });

  it('calculates due date using correct interval for new bank', async () => {
    vi.useFakeTimers();
    const baseDate = new Date(2026, 1, 27, 12, 0, 0); // Feb 27, 2026
    vi.setSystemTime(baseDate);

    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    // bank advances 1→2, interval for bank 2 = 3 days
    const expectedDate = new Date(2026, 1, 27, 12, 0, 0);
    expectedDate.setDate(expectedDate.getDate() + BANK_INTERVALS[2]);

    expect(mockTimestampFromDate).toHaveBeenCalledWith(
      expect.objectContaining({ getDate: expect.any(Function) })
    );
    const passedDate: Date = mockTimestampFromDate.mock.calls[0][0];
    expect(passedDate.getDate()).toBe(expectedDate.getDate());
    expect(passedDate.getMonth()).toBe(expectedDate.getMonth());

    vi.useRealTimers();
  });

  it('calculates due date of +1 day after reset to bank 1 (score<4)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 12, 0, 0));

    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 2 }]);

    // bank resets to 1, interval = 1 day
    const passedDate: Date = mockTimestampFromDate.mock.calls[0][0];
    const expected = new Date(2026, 1, 27, 12, 0, 0);
    expected.setDate(expected.getDate() + 1);
    expect(passedDate.getDate()).toBe(expected.getDate());

    vi.useRealTimers();
  });

  it('skips words whose Firestore document does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', false /* exists=false */));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('returns a newDates record keyed by simp with formatted date strings', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 12, 0, 0));

    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好'));

    const newDates = await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    // Result should have the simp as key
    expect(newDates).toHaveProperty('你好');
    // Date format is YYYY/MM/DD
    expect(newDates['你好']).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);

    vi.useRealTimers();
  });

  it('processes multiple words in a single batch', async () => {
    mockGetDoc
      .mockResolvedValueOnce(makeFakeDoc(1, '你好'))
      .mockResolvedValueOnce(makeFakeDoc(3, '谢谢'));

    const scores = [
      { word_id: 1, score: 4 },
      { word_id: 2, score: 2 },
    ];
    await finishTest('user-1', scores);

    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledOnce();

    const firstUpdate = mockBatchUpdate.mock.calls[0][1];
    const secondUpdate = mockBatchUpdate.mock.calls[1][1];

    expect(firstUpdate.bank).toBe(2); // 1 → 2
    expect(secondUpdate.bank).toBe(1); // 3 → 1 (score < 4)
  });

  it('returns empty object when all word documents are missing', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', false));

    const result = await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    expect(result).toEqual({});
  });
});
