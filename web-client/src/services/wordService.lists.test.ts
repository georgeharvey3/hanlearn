/**
 * Tests for wordService.ts — word list CRUD and utility functions.
 * Covers: getUserWordLists, createWordList, deleteWordList, getListStats,
 * migrateWordsWithoutListId, moveWordToList.
 *
 * Firebase Firestore is mocked at the SDK level since wordService IS the service layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockBatchUpdate,
  mockBatchDelete,
  mockBatchCommit,
  mockWriteBatch,
  mockGetDoc,
  mockGetDocs,
  mockDoc,
  mockCollection,
  mockSetDoc,
  mockDeleteDoc,
  mockUpdateDoc,
  mockAddDoc,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockTimestampFromDate,
  mockTimestampNow,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockWriteBatch = vi.fn(() => ({
    update: mockBatchUpdate,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }));
  return {
    mockBatchUpdate,
    mockBatchDelete,
    mockBatchCommit,
    mockWriteBatch,
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/'), ref: 'ref' })),
    mockCollection: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockAddDoc: vi.fn(),
    mockQuery: vi.fn((ref) => ref),
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
  addDoc: mockAddDoc,
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
  getUserWordLists,
  createWordList,
  deleteWordList,
  getListStats,
  migrateWordsWithoutListId,
  moveWordToList,
} from './wordService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeListDoc(id: string, name: string, order: number, createdAt?: object) {
  return {
    id,
    ref: `users/u1/wordLists/${id}`,
    data: () => ({
      name,
      order,
      createdAt: createdAt ?? { toDate: () => new Date(2026, 0, 1), _isTimestamp: true },
    }),
  };
}

function makeWordDocWithList(id: string, listId: string | undefined, dueDaysFromNow = 0) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDaysFromNow);
  return {
    id,
    ref: `users/u1/userWords/${id}`,
    data: () => ({
      wordId: id,
      wordData: { simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' },
      amendedMeaning: null,
      bank: 1,
      listId,
      dueDate: { toDate: () => dueDate },
    }),
  };
}

function makeFakeSnapshot(docs: object[]) {
  return {
    docs,
    size: docs.length,
  };
}

// ─── getUserWordLists ─────────────────────────────────────────────────────────

describe('getUserWordLists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns lists from Firestore sorted by order', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeListDoc('hsk1', 'HSK 1', 1),
        makeListDoc('hsk2', 'HSK 2', 2),
      ]),
    );

    const lists = await getUserWordLists('user-1');

    // The "default" list is always prepended since it's not in the snapshot
    expect(lists[0].id).toBe('default');
    expect(lists[0].name).toBe('General');
    expect(lists[1]).toMatchObject({ id: 'hsk1', name: 'HSK 1', order: 1 });
    expect(lists[2]).toMatchObject({ id: 'hsk2', name: 'HSK 2', order: 2 });
  });

  it('does not duplicate "default" list when it is already in Firestore', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([makeListDoc('default', 'General', 0)]),
    );

    const lists = await getUserWordLists('user-1');

    const defaultLists = lists.filter((l) => l.id === 'default');
    expect(defaultLists).toHaveLength(1);
  });

  it('always prepends default list when Firestore snapshot is empty', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const lists = await getUserWordLists('user-1');

    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ id: 'default', name: 'General' });
  });

  it('handles missing createdAt gracefully (returns empty string)', async () => {
    const docWithNoCreatedAt = {
      id: 'list-1',
      ref: 'ref',
      data: () => ({ name: 'My List', order: 1, createdAt: null }),
    };
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([docWithNoCreatedAt]));

    const lists = await getUserWordLists('user-1');

    const myList = lists.find((l) => l.id === 'list-1');
    expect(myList?.createdAt).toBe('');
  });
});

// ─── createWordList ───────────────────────────────────────────────────────────

describe('createWordList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a new list doc with order = maxOrder + 1', async () => {
    // Existing list has order = 3
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([makeListDoc('hsk1', 'HSK 1', 3)]),
    );
    mockAddDoc.mockResolvedValue({ id: 'new-list-id' });

    await createWordList('user-1', 'New List');

    expect(mockAddDoc).toHaveBeenCalledOnce();
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.name).toBe('New List');
    expect(docData.order).toBe(4); // 3 + 1
  });

  it('uses order = 1 when there are no existing lists', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));
    mockAddDoc.mockResolvedValue({ id: 'first-list' });

    await createWordList('user-1', 'First List');

    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.order).toBe(1);
  });

  it('returns a WordList with the new doc id and formatted createdAt date', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));
    mockAddDoc.mockResolvedValue({ id: 'created-id' });

    const result = await createWordList('user-1', 'My New List');

    expect(result.id).toBe('created-id');
    expect(result.name).toBe('My New List');
    expect(result.createdAt).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(result.order).toBe(1);
  });

  it('picks the highest order value across all existing lists', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeListDoc('a', 'A', 5),
        makeListDoc('b', 'B', 2),
        makeListDoc('c', 'C', 8),
      ]),
    );
    mockAddDoc.mockResolvedValue({ id: 'next-list' });

    await createWordList('user-1', 'Next List');

    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.order).toBe(9); // max(5, 2, 8) + 1
  });
});

// ─── deleteWordList ───────────────────────────────────────────────────────────

describe('deleteWordList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  it('throws an error when attempting to delete the default list', async () => {
    await expect(deleteWordList('user-1', 'default')).rejects.toThrow(
      'Cannot delete the default word list',
    );
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('deletes all words in the list and the list document via a batch', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeWordDocWithList('w1', 'list-1'),
        makeWordDocWithList('w2', 'list-1'),
      ]),
    );

    await deleteWordList('user-1', 'list-1');

    // 2 words + 1 list doc = 3 batch.delete calls
    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('deletes the list document even when there are no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    await deleteWordList('user-1', 'empty-list');

    // Only the list doc itself is deleted
    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('uses where query to find words by listId', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    await deleteWordList('user-1', 'list-abc');

    expect(mockWhere).toHaveBeenCalledWith('listId', '==', 'list-abc');
  });
});

// ─── getListStats ─────────────────────────────────────────────────────────────

describe('getListStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct total and due counts per list', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        {
          id: 'w1',
          data: () => ({
            listId: 'default',
            dueDate: { toDate: () => yesterday },
          }),
        },
        {
          id: 'w2',
          data: () => ({
            listId: 'default',
            dueDate: { toDate: () => tomorrow },
          }),
        },
        {
          id: 'w3',
          data: () => ({
            listId: 'list-1',
            dueDate: { toDate: () => yesterday },
          }),
        },
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].total).toBe(2);
    expect(stats['default'].due).toBe(1); // only yesterday's word is due
    expect(stats['list-1'].total).toBe(1);
    expect(stats['list-1'].due).toBe(1);
  });

  it('treats words without listId as belonging to "default"', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        {
          id: 'w1',
          data: () => ({
            // no listId field — legacy word
            dueDate: { toDate: () => yesterday },
          }),
        },
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].total).toBe(1);
    expect(stats['default'].due).toBe(1);
  });

  it('returns empty stats object when user has no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const stats = await getListStats('user-1');

    expect(stats).toEqual({});
  });

  it('counts a word due today as due', async () => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        {
          id: 'w1',
          data: () => ({
            listId: 'default',
            dueDate: { toDate: () => todayMidnight },
          }),
        },
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].due).toBe(1);
  });

  it('does not count a word due tomorrow', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        {
          id: 'w1',
          data: () => ({
            listId: 'default',
            dueDate: { toDate: () => tomorrow },
          }),
        },
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].due).toBe(0);
    expect(stats['default'].total).toBe(1);
  });
});

// ─── migrateWordsWithoutListId ────────────────────────────────────────────────

describe('migrateWordsWithoutListId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  it('returns 0 and does not write when all words already have listId', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        { id: 'w1', ref: 'ref1', data: () => ({ listId: 'default' }) },
        { id: 'w2', ref: 'ref2', data: () => ({ listId: 'list-1' }) },
      ]),
    );

    const count = await migrateWordsWithoutListId('user-1');

    expect(count).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('updates words missing listId and returns the count', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        { id: 'w1', ref: 'ref1', data: () => ({ listId: 'default' }) },
        { id: 'w2', ref: 'ref2', data: () => ({}) }, // no listId
        { id: 'w3', ref: 'ref3', data: () => ({}) }, // no listId
      ]),
    );

    const count = await migrateWordsWithoutListId('user-1');

    expect(count).toBe(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith('ref2', { listId: 'default' });
    expect(mockBatchUpdate).toHaveBeenCalledWith('ref3', { listId: 'default' });
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('returns 0 when user has no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const count = await migrateWordsWithoutListId('user-1');

    expect(count).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

// ─── moveWordToList ───────────────────────────────────────────────────────────

describe('moveWordToList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateDoc with the new listId', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await moveWordToList('user-1', 42, 'new-list');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ listId: 'new-list' });
  });

  it('uses the correct Firestore document path', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await moveWordToList('user-2', 99, 'list-abc');

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'user-2',
      'userWords',
      '99',
    );
  });
});
