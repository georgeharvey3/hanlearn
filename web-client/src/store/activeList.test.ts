/**
 * The app remembers the active list on the device (issue #382).
 *
 * A reload is a new store: each test writes to localStorage, builds a store,
 * and reads `addWords.activeListId`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore, authenticatedState } from '../test/utils';
import * as wordActions from './actions/word';
import * as wordService from '../services/wordService';
import { WordList } from '../types/models';
import { ACTIVE_LIST_KEY } from '../utils/activeList';

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));
vi.mock('../services/wordService');
vi.mock('../services/streakService');
vi.mock('../services/performanceService', () => ({
  traceAsync: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));
vi.mock('../services/analyticsService', () => ({
  trackFeatureUsage: vi.fn(),
}));

const mockedWordService = vi.mocked(wordService);

const generalList: WordList = { id: 'default', name: 'General', createdAt: '', order: 0 };
const hskList: WordList = { id: 'list-1', name: 'HSK 1', createdAt: '2026/01/01', order: 1 };

/** A store as the app builds it on load: signed in, with no word state yet. */
const reloadStore = () => createTestStore({ auth: authenticatedState().auth });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockedWordService.migrateUserWords.mockResolvedValue(undefined as never);
  mockedWordService.getUserWordLists.mockResolvedValue([generalList, hskList]);
  mockedWordService.getUserWords.mockResolvedValue([]);
  mockedWordService.getListStats.mockResolvedValue({});
});

describe('the active list on load', () => {
  it('opens on the stored list', () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-1');

    expect(reloadStore().getState().addWords.activeListId).toBe('list-1');
  });

  it('opens on General when nothing is stored', () => {
    expect(reloadStore().getState().addWords.activeListId).toBe('default');
  });

  it('opens on General when the stored value is empty', () => {
    localStorage.setItem(ACTIVE_LIST_KEY, '');

    expect(reloadStore().getState().addWords.activeListId).toBe('default');
  });

  it('opens on General when the browser blocks storage', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    try {
      expect(reloadStore().getState().addWords.activeListId).toBe('default');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('remembering a list switch', () => {
  it('stores the list the learner switches to', async () => {
    const store = reloadStore();

    await store.dispatch(wordActions.switchActiveList('list-1') as any);

    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('list-1');
    expect(reloadStore().getState().addWords.activeListId).toBe('list-1');
  });

  it('stores All lists like any other list', async () => {
    await reloadStore().dispatch(wordActions.switchActiveList('__all__') as any);

    expect(reloadStore().getState().addWords.activeListId).toBe('__all__');
  });

  it('stores a list the learner creates', async () => {
    const created: WordList = { id: 'list-2', name: 'Travel', createdAt: '', order: 2 };
    mockedWordService.createWordList.mockResolvedValue(created);

    await reloadStore().dispatch(wordActions.postCreateWordList('Travel') as any);

    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('list-2');
  });

  it('stores General when the learner deletes the active list', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-1');
    mockedWordService.deleteWordList.mockResolvedValue(undefined as never);
    const store = reloadStore();

    await store.dispatch(wordActions.postDeleteWordList('list-1') as any);

    expect(store.getState().addWords.activeListId).toBe('default');
    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('default');
  });

  it('keeps the stored list when the learner deletes a different list', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-1');
    mockedWordService.deleteWordList.mockResolvedValue(undefined as never);

    await reloadStore().dispatch(wordActions.postDeleteWordList('list-9') as any);

    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('list-1');
  });
});

describe('a stored list that no longer exists', () => {
  it('falls back to General when the words load', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-gone');
    const store = reloadStore();

    await store.dispatch(wordActions.initWords() as any);

    expect(store.getState().addWords.activeListId).toBe('default');
    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('default');
    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123', 'default');
  });

  it('falls back to General when only the lists load, as on the Dashboard', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-gone');
    const store = reloadStore();

    await store.dispatch(wordActions.initWordLists() as any);

    expect(store.getState().addWords.activeListId).toBe('default');
    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('default');
  });

  it('keeps a stored list that still exists', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, 'list-1');
    const store = reloadStore();

    await store.dispatch(wordActions.initWords() as any);

    expect(store.getState().addWords.activeListId).toBe('list-1');
    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123', 'list-1');
  });

  it('keeps All lists, which is not a list of its own', async () => {
    localStorage.setItem(ACTIVE_LIST_KEY, '__all__');
    const store = reloadStore();

    await store.dispatch(wordActions.initWords() as any);

    expect(store.getState().addWords.activeListId).toBe('__all__');
    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe('__all__');
    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123', undefined);
  });
});
