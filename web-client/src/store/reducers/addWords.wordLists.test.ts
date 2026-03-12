/**
 * Tests for the word list actions in the addWords reducer.
 * Covers SET_WORD_LISTS, ADD_WORD_LIST, REMOVE_WORD_LIST, RENAME_WORD_LIST,
 * SET_ACTIVE_LIST, and SET_LIST_STATS — the lines previously at 0% coverage.
 */
import { describe, it, expect } from 'vitest';
import reducer from './addWords';
import * as actionTypes from '../actions/actionTypes';
import { AddWordsState } from '../../types/store';
import { WordList } from '../../types/models';

const initialState: AddWordsState = {
  lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
  activeListId: 'default',
  words: [],
  listStats: {},
  error: false,
  loading: false,
};

const extraList: WordList = {
  id: 'list-1',
  name: 'HSK 1',
  createdAt: '2026/01/01',
  order: 1,
};

const anotherList: WordList = {
  id: 'list-2',
  name: 'Travel',
  createdAt: '2026/01/15',
  order: 2,
};

describe('addWords reducer — word list actions', () => {
  describe('SET_WORD_LISTS', () => {
    it('replaces the lists array with the provided lists', () => {
      const newLists = [{ id: 'default', name: 'General', createdAt: '', order: 0 }, extraList];

      const state = reducer(initialState, {
        type: actionTypes.SET_WORD_LISTS,
        lists: newLists,
      });

      expect(state.lists).toEqual(newLists);
    });

    it('does not affect other state slices', () => {
      const newLists = [extraList];
      const stateWithWords = {
        ...initialState,
        words: [{ id: 1, simp: '你好', trad: '你好', pinyin: 'nǐ hǎo', meaning: 'hello' }],
      };

      const state = reducer(stateWithWords, {
        type: actionTypes.SET_WORD_LISTS,
        lists: newLists,
      });

      expect(state.words).toHaveLength(1);
      expect(state.activeListId).toBe('default');
    });

    it('can set an empty lists array', () => {
      const state = reducer(initialState, {
        type: actionTypes.SET_WORD_LISTS,
        lists: [],
      });

      expect(state.lists).toEqual([]);
    });
  });

  describe('ADD_WORD_LIST', () => {
    it('appends the new list to the existing lists', () => {
      const state = reducer(initialState, {
        type: actionTypes.ADD_WORD_LIST,
        list: extraList,
      });

      expect(state.lists).toHaveLength(2);
      expect(state.lists[1]).toEqual(extraList);
    });

    it('keeps the default list in place when adding a new list', () => {
      const state = reducer(initialState, {
        type: actionTypes.ADD_WORD_LIST,
        list: extraList,
      });

      expect(state.lists[0].id).toBe('default');
      expect(state.lists[1].id).toBe('list-1');
    });

    it('can append multiple lists independently', () => {
      const stateAfterFirst = reducer(initialState, {
        type: actionTypes.ADD_WORD_LIST,
        list: extraList,
      });
      const stateAfterSecond = reducer(stateAfterFirst, {
        type: actionTypes.ADD_WORD_LIST,
        list: anotherList,
      });

      expect(stateAfterSecond.lists).toHaveLength(3);
      expect(stateAfterSecond.lists[2].id).toBe('list-2');
    });
  });

  describe('REMOVE_WORD_LIST', () => {
    const stateWithMultipleLists: AddWordsState = {
      ...initialState,
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, extraList, anotherList],
      activeListId: 'list-1',
    };

    it('removes the list with the matching id', () => {
      const state = reducer(stateWithMultipleLists, {
        type: actionTypes.REMOVE_WORD_LIST,
        listId: 'list-1',
      });

      expect(state.lists).toHaveLength(2);
      expect(state.lists.find((l) => l.id === 'list-1')).toBeUndefined();
    });

    it('resets activeListId to "default" when the active list is deleted', () => {
      const state = reducer(stateWithMultipleLists, {
        type: actionTypes.REMOVE_WORD_LIST,
        listId: 'list-1',
      });

      expect(state.activeListId).toBe('default');
    });

    it('keeps activeListId unchanged when a non-active list is deleted', () => {
      const state = reducer(stateWithMultipleLists, {
        type: actionTypes.REMOVE_WORD_LIST,
        listId: 'list-2',
      });

      // active was list-1, deleting list-2 should not change the active list
      expect(state.activeListId).toBe('list-1');
    });

    it('leaves other lists intact', () => {
      const state = reducer(stateWithMultipleLists, {
        type: actionTypes.REMOVE_WORD_LIST,
        listId: 'list-1',
      });

      expect(state.lists.find((l) => l.id === 'list-2')).toBeDefined();
      expect(state.lists.find((l) => l.id === 'default')).toBeDefined();
    });
  });

  describe('RENAME_WORD_LIST', () => {
    const stateWithList: AddWordsState = {
      ...initialState,
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }, extraList],
    };

    it('renames the list with the matching id', () => {
      const state = reducer(stateWithList, {
        type: actionTypes.RENAME_WORD_LIST,
        listId: 'list-1',
        newName: 'HSK Level 1',
      });

      const renamed = state.lists.find((l) => l.id === 'list-1');
      expect(renamed?.name).toBe('HSK Level 1');
    });

    it('does not modify other lists', () => {
      const state = reducer(stateWithList, {
        type: actionTypes.RENAME_WORD_LIST,
        listId: 'list-1',
        newName: 'Renamed',
      });

      const defaultList = state.lists.find((l) => l.id === 'default');
      expect(defaultList?.name).toBe('General');
    });

    it('preserves all other list fields when renaming', () => {
      const state = reducer(stateWithList, {
        type: actionTypes.RENAME_WORD_LIST,
        listId: 'list-1',
        newName: 'New Name',
      });

      const renamed = state.lists.find((l) => l.id === 'list-1');
      expect(renamed?.id).toBe('list-1');
      expect(renamed?.order).toBe(extraList.order);
      expect(renamed?.createdAt).toBe(extraList.createdAt);
    });
  });

  describe('SET_ACTIVE_LIST', () => {
    it('updates activeListId to the given list id', () => {
      const stateWithList: AddWordsState = {
        ...initialState,
        lists: [initialState.lists[0], extraList],
      };

      const state = reducer(stateWithList, {
        type: actionTypes.SET_ACTIVE_LIST,
        listId: 'list-1',
      });

      expect(state.activeListId).toBe('list-1');
    });

    it('can switch back to default', () => {
      const stateOnList1: AddWordsState = {
        ...initialState,
        activeListId: 'list-1',
      };

      const state = reducer(stateOnList1, {
        type: actionTypes.SET_ACTIVE_LIST,
        listId: 'default',
      });

      expect(state.activeListId).toBe('default');
    });

    it('does not affect words or lists', () => {
      const state = reducer(initialState, {
        type: actionTypes.SET_ACTIVE_LIST,
        listId: 'list-1',
      });

      expect(state.words).toEqual([]);
      expect(state.lists).toEqual(initialState.lists);
    });
  });

  describe('SET_LIST_STATS', () => {
    it('sets listStats to the provided record', () => {
      const stats = {
        default: { due: 3, total: 10 },
        'list-1': { due: 0, total: 5 },
      };

      const state = reducer(initialState, {
        type: actionTypes.SET_LIST_STATS,
        listStats: stats,
      });

      expect(state.listStats).toEqual(stats);
    });

    it('overwrites existing listStats', () => {
      const stateWithStats: AddWordsState = {
        ...initialState,
        listStats: { default: { due: 5, total: 20 } },
      };

      const newStats = { default: { due: 2, total: 20 } };

      const state = reducer(stateWithStats, {
        type: actionTypes.SET_LIST_STATS,
        listStats: newStats,
      });

      expect(state.listStats.default.due).toBe(2);
    });

    it('can set empty stats', () => {
      const stateWithStats: AddWordsState = {
        ...initialState,
        listStats: { default: { due: 5, total: 20 } },
      };

      const state = reducer(stateWithStats, {
        type: actionTypes.SET_LIST_STATS,
        listStats: {},
      });

      expect(state.listStats).toEqual({});
    });
  });
});
