/**
 * Tests for wordService.ts — word list CRUD and utility functions.
 * Covers: getUserWordLists, createWordList, deleteWordList, getListStats,
 * the userWords migrations, and the list membership of a word: addWordToList,
 * removeWordFromList and setListsOfWord, and the import of a premade list.
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
  mockArrayUnion,
  mockArrayRemove,
  mockDeleteField,
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
    mockArrayUnion: vi.fn((...items: string[]) => ({ __arrayUnion: items })),
    mockArrayRemove: vi.fn((...items: string[]) => ({ __arrayRemove: items })),
    mockDeleteField: vi.fn(() => ({ __deleteField: true })),
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
  arrayUnion: mockArrayUnion,
  arrayRemove: mockArrayRemove,
  deleteField: mockDeleteField,
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
  migrateWordsToListIds,
  migrateWordsWithoutDirections,
  migrateUserWords,
  addWordToList,
  removeWordFromList,
  setListsOfWord,
  getHeldWords,
  addPremadeList,
} from './wordService';
import { DIRECTIONS } from '../types/models';

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

/** A userWords document in the lists given, as Firestore holds it. */
function makeWordDocInLists(id: string, membership: object, dueDaysFromNow = 0) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDaysFromNow);
  return {
    id,
    ref: `users/u1/userWords/${id}`,
    exists: () => true,
    data: () => ({
      wordId: id,
      wordData: { simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' },
      amendedMeaning: null,
      bank: 1,
      dueDate: { toDate: () => dueDate },
      ...membership,
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
      makeFakeSnapshot([makeListDoc('hsk1', 'HSK 1', 1), makeListDoc('hsk2', 'HSK 2', 2)]),
    );

    const lists = await getUserWordLists('user-1');

    // The "default" list is always prepended since it's not in the snapshot
    expect(lists[0].id).toBe('default');
    expect(lists[0].name).toBe('General');
    expect(lists[1]).toMatchObject({ id: 'hsk1', name: 'HSK 1', order: 1 });
    expect(lists[2]).toMatchObject({ id: 'hsk2', name: 'HSK 2', order: 2 });
  });

  it('does not duplicate "default" list when it is already in Firestore', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeListDoc('default', 'General', 0)]));

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
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeListDoc('hsk1', 'HSK 1', 3)]));
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

  it('deletes the words in no other list and takes the list off the others', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeWordDocInLists('w1', { listIds: ['list-1'] }),
        makeWordDocInLists('w2', { listIds: ['list-1', 'default'] }),
      ]),
    );

    await deleteWordList('user-1', 'list-1');

    const deleted = mockBatchDelete.mock.calls.map(([ref]) => ref.path ?? ref);
    expect(deleted).toContain('users/u1/userWords/w1');
    expect(deleted).toContain('users/user-1/wordLists/list-1');
    expect(deleted).not.toContain('users/u1/userWords/w2');
    expect(mockBatchUpdate).toHaveBeenCalledWith('users/u1/userWords/w2', {
      listIds: { __arrayRemove: ['list-1'] },
    });
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('keeps a shared word with its schedule', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([makeWordDocInLists('w2', { listIds: ['list-1', 'hsk1'] })]),
    );

    await deleteWordList('user-1', 'list-1');

    const update = mockBatchUpdate.mock.calls[0][1];
    expect(Object.keys(update)).toEqual(['listIds']);
  });

  it('deletes the list document even when there are no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    await deleteWordList('user-1', 'empty-list');

    // Only the list doc itself is deleted
    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('writes in batches of 500 or fewer, with the list document in the last', async () => {
    const docs = Array.from({ length: 700 }, (_, i) =>
      makeWordDocInLists(`w${i}`, { listIds: ['list-1'] }),
    );
    mockGetDocs.mockResolvedValue(makeFakeSnapshot(docs));
    const batches: string[][] = [];
    mockWriteBatch.mockImplementation((() => {
      const ops: string[] = [];
      batches.push(ops);
      return {
        update: (ref: string) => ops.push(ref),
        delete: (ref: { path?: string } | string) =>
          ops.push(typeof ref === 'string' ? ref : (ref.path ?? '')),
        commit: mockBatchCommit,
      };
    }) as any);

    await deleteWordList('user-1', 'list-1');

    expect(batches.every((ops) => ops.length <= 500)).toBe(true);
    expect(batches.flat()).toHaveLength(701);
    expect(batches[batches.length - 1]).toContain('users/user-1/wordLists/list-1');
  });
});

// ─── getListStats ─────────────────────────────────────────────────────────────

describe('getListStats', () => {
  beforeEach(() => vi.clearAllMocks());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const wordDoc = (id: string, membership: object, dueDate: Date) => ({
    id,
    data: () => ({ ...membership, dueDate: { toDate: () => new Date(dueDate) } }),
  });

  it('returns correct total and due counts per list', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        wordDoc('w1', { listIds: ['default'] }, yesterday),
        wordDoc('w2', { listIds: ['default'] }, tomorrow),
        wordDoc('w3', { listIds: ['list-1'] }, yesterday),
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].total).toBe(2);
    expect(stats['default'].due).toBe(1); // only yesterday's word is due
    expect(stats['list-1'].total).toBe(1);
    expect(stats['list-1'].due).toBe(1);
  });

  it('counts a word in each list that holds it, and one time for all lists', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        wordDoc('w1', { listIds: ['default', 'hsk1'] }, yesterday),
        wordDoc('w2', { listIds: ['hsk1'] }, tomorrow),
      ]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default']).toEqual({ due: 1, total: 1 });
    expect(stats['hsk1']).toEqual({ due: 1, total: 2 });
    expect(stats['__all__']).toEqual({ due: 1, total: 2 });
  });

  it('reads a word that the backfill has not reached from its listId', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([wordDoc('w1', { listId: 'hsk1' }, yesterday)]));

    const stats = await getListStats('user-1');

    expect(stats['hsk1']).toEqual({ due: 1, total: 1 });
  });

  it('treats words without a list as belonging to "default"', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([wordDoc('w1', {}, yesterday)]));

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
      makeFakeSnapshot([wordDoc('w1', { listIds: ['default'] }, todayMidnight)]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].due).toBe(1);
  });

  it('does not count a word due tomorrow', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([wordDoc('w1', { listIds: ['default'] }, tomorrow)]),
    );

    const stats = await getListStats('user-1');

    expect(stats['default'].due).toBe(0);
    expect(stats['default'].total).toBe(1);
  });
});

// ─── migrateWordsToListIds ────────────────────────────────────────────────────

describe('migrateWordsToListIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  it('converts listId to a one-item listIds and removes listId', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([{ id: 'w1', ref: 'ref1', data: () => ({ listId: 'hsk1' }) }]),
    );

    const count = await migrateWordsToListIds('user-1');

    expect(count).toBe(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith('ref1', {
      listIds: ['hsk1'],
      listId: { __deleteField: true },
    });
  });

  it('gives a word with neither field the General list', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([{ id: 'w1', ref: 'ref1', data: () => ({}) }]));

    await migrateWordsToListIds('user-1');

    expect(mockBatchUpdate).toHaveBeenCalledWith('ref1', {
      listIds: ['default'],
      listId: { __deleteField: true },
    });
  });

  it('writes nothing on a second run', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        { id: 'w1', ref: 'ref1', data: () => ({ listIds: ['default'] }) },
        { id: 'w2', ref: 'ref2', data: () => ({ listIds: ['list-1', 'default'] }) },
      ]),
    );

    const count = await migrateWordsToListIds('user-1');

    expect(count).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('returns 0 when user has no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    const count = await migrateWordsToListIds('user-1');

    expect(count).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

// ─── migrateWordsWithoutDirections ────────────────────────────────────────────

/** A userWords document as Firestore holds it, with or without a directions map. */
function makeMigrationDoc(id: string, data: object) {
  return { id, ref: `ref-${id}`, data: () => data };
}

function fullDirections(bank: number, dueDate: object) {
  return DIRECTIONS.reduce<Record<string, object>>((acc, direction) => {
    acc[direction] = { bank, dueDate };
    return acc;
  }, {});
}

describe('migrateWordsWithoutDirections', () => {
  const dueDate = { toDate: () => new Date(2026, 2, 5) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  it('copies bank and dueDate into all five directions of a legacy document', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([makeMigrationDoc('w1', { bank: 3, dueDate, listIds: ['default'] })]),
    );

    const count = await migrateWordsWithoutDirections('user-1');

    expect(count).toBe(1);
    const [ref, update] = mockBatchUpdate.mock.calls[0];
    expect(ref).toBe('ref-w1');
    expect(Object.keys(update.directions).sort()).toEqual([...DIRECTIONS].sort());
    for (const direction of DIRECTIONS) {
      expect(update.directions[direction]).toEqual({ bank: 3, dueDate });
    }
  });

  it('does not write a document that already has the full map', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeMigrationDoc('w1', {
          bank: 1,
          dueDate,
          listIds: ['default'],
          directions: fullDirections(1, dueDate),
        }),
      ]),
    );

    const count = await migrateWordsWithoutDirections('user-1');

    expect(count).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('completes a partial map without overwriting the entries it holds', async () => {
    const cmDueDate = { toDate: () => new Date(2026, 5, 1) };
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeMigrationDoc('w1', {
          bank: 2,
          dueDate,
          listIds: ['default'],
          directions: { CM: { bank: 5, dueDate: cmDueDate } },
        }),
      ]),
    );

    const count = await migrateWordsWithoutDirections('user-1');

    expect(count).toBe(1);
    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.directions.CM).toEqual({ bank: 5, dueDate: cmDueDate });
    expect(update.directions.MC).toEqual({ bank: 2, dueDate });
  });

  it('leaves the lists alone', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeMigrationDoc('w1', { bank: 1, dueDate })]));

    await migrateWordsWithoutDirections('user-1');

    expect(mockBatchUpdate.mock.calls[0][1]).not.toHaveProperty('listIds');
  });

  it('returns 0 when the user has no words', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));

    expect(await migrateWordsWithoutDirections('user-1')).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

// ─── migrateUserWords ─────────────────────────────────────────────────────────

describe('migrateUserWords', () => {
  const dueDate = { toDate: () => new Date(2026, 2, 5) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  it('reads the collection once and writes both backfills in one update', async () => {
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([makeMigrationDoc('w1', { bank: 1, dueDate })]));

    const count = await migrateUserWords('user-1');

    expect(count).toBe(1);
    expect(mockGetDocs).toHaveBeenCalledOnce();
    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    const update = mockBatchUpdate.mock.calls[0][1];
    expect(update.listIds).toEqual(['default']);
    expect(Object.keys(update.directions)).toHaveLength(5);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('writes only the field a document is missing', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeMigrationDoc('w1', { bank: 1, dueDate, directions: fullDirections(1, dueDate) }),
        makeMigrationDoc('w2', { bank: 1, dueDate, listIds: ['list-1'] }),
      ]),
    );

    const count = await migrateUserWords('user-1');

    expect(count).toBe(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith('ref-w1', {
      listIds: ['default'],
      listId: { __deleteField: true },
    });
    const w2Update = mockBatchUpdate.mock.calls[1][1];
    expect(w2Update).not.toHaveProperty('listIds');
    expect(w2Update.directions).toBeDefined();
  });

  it('is a no-op on a fully migrated collection', async () => {
    mockGetDocs.mockResolvedValue(
      makeFakeSnapshot([
        makeMigrationDoc('w1', {
          bank: 1,
          dueDate,
          listIds: ['default'],
          directions: fullDirections(1, dueDate),
        }),
      ]),
    );

    expect(await migrateUserWords('user-1')).toBe(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

// ─── addWordToList ────────────────────────────────────────────────────────────

describe('addWordToList', () => {
  const word = { id: 42, simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue(makeFakeSnapshot([]));
  });

  it('creates a word that the learner does not have in the list', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const existingWord = await addWordToList('user-1', word, 'hsk1');

    expect(existingWord).toBeNull();
    expect(mockSetDoc).toHaveBeenCalledOnce();
    expect(mockSetDoc.mock.calls[0][1]).toMatchObject({ bank: 1, listIds: ['hsk1'] });
  });

  it('puts a word that the learner has into a second list', async () => {
    mockGetDoc.mockResolvedValue(makeWordDocInLists('42', { listIds: ['default'] }));

    await addWordToList('user-1', word, 'hsk1');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ listIds: { __arrayUnion: ['hsk1'] } });
  });

  it('does not write the schedule of a word that the learner has', async () => {
    mockGetDoc.mockResolvedValue(makeWordDocInLists('42', { listIds: ['default'] }, 30));

    const existingWord = await addWordToList('user-1', word, 'hsk1');

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(existingWord?.listIds).toEqual(['default', 'hsk1']);
    expect(existingWord?.due_date).toBeDefined();
  });
});

// ─── removeWordFromList ───────────────────────────────────────────────────────

describe('removeWordFromList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('takes the word out of one of its two lists', async () => {
    mockGetDoc.mockResolvedValue(makeWordDocInLists('42', { listIds: ['default', 'hsk1'] }));

    const deleted = await removeWordFromList('user-1', 42, 'hsk1');

    expect(deleted).toBe(false);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ listIds: { __arrayRemove: ['hsk1'] } });
  });

  it('deletes the word when it leaves its last list', async () => {
    mockGetDoc.mockResolvedValue(makeWordDocInLists('42', { listIds: ['hsk1'] }));

    const deleted = await removeWordFromList('user-1', 42, 'hsk1');

    expect(deleted).toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledOnce();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('deletes the word from every list when no list is given', async () => {
    const deleted = await removeWordFromList('user-1', 42);

    expect(deleted).toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledOnce();
  });
});

// ─── setListsOfWord ───────────────────────────────────────────────────────────

describe('setListsOfWord', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the lists of the word', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await setListsOfWord('user-1', 42, ['default', 'hsk1']);

    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ listIds: ['default', 'hsk1'] });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-1', 'userWords', '42');
  });

  it('refuses an empty set', async () => {
    await expect(setListsOfWord('user-1', 42, [])).rejects.toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

// ─── Premade lists ────────────────────────────────────────────────────────────

/** Dictionary entries as a premade list carries them, with IDs from `first`. */
function entries(count: number, first = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: first + i,
    simp: '字',
    trad: '字',
    pinyin: 'zi4',
    meaning: 'character',
  }));
}

/** The learner's words with the IDs given, as one read of userWords returns them. */
function heldWords(ids: number[], membership: object = { listIds: ['default'] }) {
  return makeFakeSnapshot(ids.map((id) => makeWordDocInLists(String(id), membership)));
}

describe('getHeldWords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the words of the list that the learner has, across all lists', async () => {
    mockGetDocs.mockResolvedValue(heldWords([2, 3, 99]));

    const held = await getHeldWords('user-1', [1, 2, 3, 4]);

    expect(held.map((w) => w.id)).toEqual([2, 3]);
    expect(held[0].due_date).toBeTruthy();
  });
});

describe('addPremadeList', () => {
  /** Every write of every batch, by batch, as [kind, path, data]. */
  let batches: [string, string, any][][];

  beforeEach(() => {
    vi.clearAllMocks();
    batches = [];
    mockAddDoc.mockResolvedValue({ id: 'hsk-list' });
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockImplementation((() => {
      const ops: [string, string, any][] = [];
      batches.push(ops);
      const write = (kind: string) => (ref: { path: string }, data?: unknown) =>
        ops.push([kind, ref.path, data]);
      return {
        set: write('set'),
        update: write('update'),
        delete: write('delete'),
        commit: mockBatchCommit,
      };
    }) as any);
  });

  /** The userWords reads return `held`; the read of the lists returns none. */
  function givenHeld(snapshot: ReturnType<typeof makeFakeSnapshot>) {
    mockGetDocs.mockImplementation(async (ref: unknown) =>
      ref === 'userWords' ? snapshot : makeFakeSnapshot([]),
    );
    mockCollection.mockImplementation((_db: unknown, ...path: string[]) => path[path.length - 1]);
  }

  it('makes a list with the name of the premade list', async () => {
    givenHeld(heldWords([]));

    const result = await addPremadeList('user-1', 'HSK 1', entries(2));

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ name: 'HSK 1' });
    expect(result.list).toMatchObject({ id: 'hsk-list', name: 'HSK 1' });
  });

  it('creates each new word as a new word in the list, due like a word added by hand', async () => {
    // A learner with more than 9 words gets a new word due tomorrow.
    givenHeld(heldWords([101, 102, 103, 104, 105, 106, 107, 108, 109, 110]));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await addPremadeList('user-1', 'HSK 1', entries(1));

    const [kind, path, data] = batches.flat()[0];
    expect(kind).toBe('set');
    expect(path).toBe('users/user-1/userWords/1');
    expect(data).toMatchObject({
      wordData: { simp: '字', trad: '字', pinyin: 'zi4', meaning: 'character' },
      bank: 1,
      listIds: ['hsk-list'],
    });
    expect(data.dueDate.toDate().toDateString()).toBe(tomorrow.toDateString());
    expect(data.directions.MC).toMatchObject({ bank: 1 });
  });

  it('cuts a meaning longer than the rules allow at its last whole sense', async () => {
    givenHeld(heldWords([]));
    // 点 in CC-CEDICT has 545 characters of senses.
    const sense = 'a sense of ten words, more or less, to fill';
    const long = { ...entries(1)[0], meaning: Array(15).fill(sense).join('/') };

    await addPremadeList('user-1', 'HSK 1', [long]);

    const meaning: string = batches.flat()[0][2].wordData.meaning;
    expect(meaning.length).toBeLessThanOrEqual(500);
    expect(meaning).toBe(Array(11).fill(sense).join('/'));
  });

  it('puts a word that the learner has into the list, and writes nothing of its schedule', async () => {
    givenHeld(heldWords([1]));

    await addPremadeList('user-1', 'HSK 1', entries(1));

    expect(batches.flat()).toEqual([
      ['update', 'users/user-1/userWords/1', { listIds: { __arrayUnion: ['hsk-list'] } }],
    ]);
  });

  it('keeps the list of a word that the backfill has not reached', async () => {
    givenHeld(heldWords([1], { listId: 'own-list' }));

    await addPremadeList('user-1', 'HSK 1', entries(1));

    expect(batches.flat()[0][2]).toEqual({ listIds: ['own-list', 'hsk-list'] });
  });

  it('returns how many words it created and how many the learner had', async () => {
    givenHeld(heldWords([2, 3]));

    const result = await addPremadeList('user-1', 'HSK 1', entries(5));

    expect(result).toMatchObject({ added: 3, held: 2 });
  });

  it('writes in batches of 500 or fewer', async () => {
    givenHeld(heldWords([]));

    await addPremadeList('user-1', 'HSK 7–9', entries(1200));

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((ops) => ops.length <= 500)).toBe(true);
    expect(batches.flat()).toHaveLength(1200);
  });

  it('deletes the new list when a batch fails, and rejects', async () => {
    givenHeld(heldWords([]));
    mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));

    await expect(addPremadeList('user-1', 'HSK 7–9', entries(1200))).rejects.toThrow('offline');

    const deletes = batches.flat().filter(([kind]) => kind === 'delete');
    expect(deletes.map(([, path]) => path)).toContain('users/user-1/wordLists/hsk-list');
  });
});
