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

// Level intervals defined in wordService (duplicated here for assertion purposes)
const LEVEL_INTERVALS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 30, 5: 60 };

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

describe('finishTest — spaced repetition level logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
  });

  it('advances level by 1 when score=4 and level < 5', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(2);
  });

  it('advances level from 4 to 5 (max) when score=4', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(5);
  });

  it('does not advance level beyond 5 when score=4 and already at max', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(5); // stays at 5
  });

  it('resets level to 1 when score < 4 (score=3)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(3, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 3 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(1);
  });

  it('resets level to 1 from level 5 when score < 4 (score=0)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(5, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 0 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(1);
  });

  it('advances level from 2 to 3 when score=4 (middle level)', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(2, '学'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    const updateCall = mockBatchUpdate.mock.calls[0][1];
    expect(updateCall.bank).toBe(3);
  });

  it('calculates due date using correct interval for new level', async () => {
    vi.useFakeTimers();
    const baseDate = new Date(2026, 1, 27, 12, 0, 0); // Feb 27, 2026
    vi.setSystemTime(baseDate);

    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    // level advances 1→2, interval for level 2 = 3 days
    const expectedDate = new Date(2026, 1, 27, 12, 0, 0);
    expectedDate.setDate(expectedDate.getDate() + LEVEL_INTERVALS[2]);

    expect(mockTimestampFromDate).toHaveBeenCalledWith(
      expect.objectContaining({ getDate: expect.any(Function) }),
    );
    const passedDate: Date = mockTimestampFromDate.mock.calls[0][0];
    expect(passedDate.getDate()).toBe(expectedDate.getDate());
    expect(passedDate.getMonth()).toBe(expectedDate.getMonth());

    vi.useRealTimers();
  });

  it('calculates due date of +1 day after reset to level 1 (score<4)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 12, 0, 0));

    mockGetDoc.mockResolvedValue(makeFakeDoc(4, '你好'));

    await finishTest('user-1', [{ word_id: 1, score: 2 }]);

    // level resets to 1, interval = 1 day
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

    expect(firstUpdate.bank).toBe(2); // 1 -> 2
    expect(secondUpdate.bank).toBe(1); // 3 -> 1 (score < 4)
  });

  it('returns empty object when all word documents are missing', async () => {
    mockGetDoc.mockResolvedValue(makeFakeDoc(1, '你好', false));

    const result = await finishTest('user-1', [{ word_id: 1, score: 4 }]);

    expect(result).toEqual({});
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
