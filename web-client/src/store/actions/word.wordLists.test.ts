/**
 * Tests for word list management thunks in word.ts:
 * switchActiveList, postCreateWordList, postRenameWordList, postDeleteWordList.
 * These cover the action paths that had 0% coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore, authenticatedState } from '../../test/utils';
import * as wordActions from './word';
import * as wordService from '../../services/wordService';
import { WordList } from '../../types/models';

vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));
vi.mock('../../services/wordService');
vi.mock('../../services/streakService');
vi.mock('../../services/performanceService', () => ({
  traceAsync: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));
vi.mock('../../services/analyticsService', () => ({
  trackFeatureUsage: vi.fn(),
}));

const mockedWordService = vi.mocked(wordService);

const sampleList: WordList = {
  id: 'list-1',
  name: 'HSK 1',
  createdAt: '2026/01/01',
  order: 1,
};

const sampleWords = [
  {
    id: 1,
    simp: '你好',
    trad: '你好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello',
    level: 1,
    due_date: '2026/03/12',
  },
];

describe('switchActiveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getListStats.mockResolvedValue({});
  });

  it('dispatches SET_ACTIVE_LIST and fetches words for the new list', async () => {
    mockedWordService.getUserWords.mockResolvedValue(sampleWords);
    const store = createTestStore(authenticatedState());

    await store.dispatch(wordActions.switchActiveList('list-1') as any);

    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123', 'list-1');
    expect(store.getState().addWords.activeListId).toBe('list-1');
    expect(store.getState().addWords.words).toEqual(sampleWords);
  });

  it('still dispatches SET_ACTIVE_LIST when there is no userId', async () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login',
      },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });

    await store.dispatch(wordActions.switchActiveList('list-1') as any);

    // Should set active list ID but not call service
    expect(store.getState().addWords.activeListId).toBe('list-1');
    expect(mockedWordService.getUserWords).not.toHaveBeenCalled();
  });

  it('dispatches FETCH_WORDS_FAILED when getUserWords throws', async () => {
    mockedWordService.getUserWords.mockRejectedValue(new Error('Firestore unavailable'));
    const store = createTestStore(authenticatedState());

    await store.dispatch(wordActions.switchActiveList('list-1') as any);

    expect(store.getState().addWords.error).toBe(true);
  });
});

describe('postCreateWordList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getListStats.mockResolvedValue({});
  });

  it('calls createWordList, dispatches ADD_WORD_LIST, and switches to the new list', async () => {
    mockedWordService.createWordList.mockResolvedValue(sampleList);
    mockedWordService.getUserWords.mockResolvedValue([]);
    const store = createTestStore(authenticatedState());

    await store.dispatch(wordActions.postCreateWordList('HSK 1') as any);

    expect(mockedWordService.createWordList).toHaveBeenCalledWith('test-user-123', 'HSK 1');
    const state = store.getState().addWords;
    expect(state.lists.find((l) => l.id === 'list-1')).toBeDefined();
    expect(state.activeListId).toBe('list-1');
  });

  it('does nothing when no userId', async () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login',
      },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });

    await store.dispatch(wordActions.postCreateWordList('New List') as any);

    expect(mockedWordService.createWordList).not.toHaveBeenCalled();
  });

  it('does not update store when createWordList throws', async () => {
    mockedWordService.createWordList.mockRejectedValue(new Error('Permission denied'));
    const store = createTestStore(authenticatedState());
    const listsBeforeCount = store.getState().addWords.lists.length;

    await store.dispatch(wordActions.postCreateWordList('Fail List') as any);

    // State should remain unchanged on error
    expect(store.getState().addWords.lists).toHaveLength(listsBeforeCount);
  });
});

describe('postRenameWordList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls renameWordList and dispatches RENAME_WORD_LIST', async () => {
    mockedWordService.renameWordList.mockResolvedValue(undefined);
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, sampleList],
        activeListId: 'list-1',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
    });

    await store.dispatch(wordActions.postRenameWordList('list-1', 'HSK Level 1') as any);

    expect(mockedWordService.renameWordList).toHaveBeenCalledWith(
      'test-user-123',
      'list-1',
      'HSK Level 1',
    );
    const renamed = store.getState().addWords.lists.find((l) => l.id === 'list-1');
    expect(renamed?.name).toBe('HSK Level 1');
  });

  it('does nothing when no userId', async () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login',
      },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });

    await store.dispatch(wordActions.postRenameWordList('list-1', 'New Name') as any);

    expect(mockedWordService.renameWordList).not.toHaveBeenCalled();
  });

  it('does not update store when renameWordList throws', async () => {
    mockedWordService.renameWordList.mockRejectedValue(new Error('Network error'));
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, sampleList],
        activeListId: 'list-1',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
    });

    await store.dispatch(wordActions.postRenameWordList('list-1', 'New Name') as any);

    // On error, name should remain original
    const list = store.getState().addWords.lists.find((l) => l.id === 'list-1');
    expect(list?.name).toBe('HSK 1');
  });
});

describe('postDeleteWordList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteWordList and dispatches REMOVE_WORD_LIST', async () => {
    mockedWordService.deleteWordList.mockResolvedValue(undefined);
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, sampleList],
        activeListId: 'list-1',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
    });

    await store.dispatch(wordActions.postDeleteWordList('list-1') as any);

    expect(mockedWordService.deleteWordList).toHaveBeenCalledWith('test-user-123', 'list-1');
    const state = store.getState().addWords;
    expect(state.lists.find((l) => l.id === 'list-1')).toBeUndefined();
    // activeListId resets to default because the active list was deleted
    expect(state.activeListId).toBe('default');
  });

  it('does nothing when no userId', async () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login',
      },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });

    await store.dispatch(wordActions.postDeleteWordList('list-1') as any);

    expect(mockedWordService.deleteWordList).not.toHaveBeenCalled();
  });

  it('does not update store when deleteWordList throws', async () => {
    mockedWordService.deleteWordList.mockRejectedValue(new Error('Permission denied'));
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, sampleList],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
    });

    await store.dispatch(wordActions.postDeleteWordList('list-1') as any);

    // On error, list should remain
    expect(store.getState().addWords.lists.find((l) => l.id === 'list-1')).toBeDefined();
  });
});
