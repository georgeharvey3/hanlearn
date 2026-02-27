import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import reducer from './addWords';
import * as actionTypes from '../actions/actionTypes';
import { AddWordsState } from '../../types/store';
import { Word } from '../../types/models';

const initialState: AddWordsState = {
  words: [],
  error: false,
  loading: false,
};

const sampleWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello',
};

function formatToday(date: Date): string {
  const day = date.getDate() >= 10
    ? date.getDate().toString()
    : '0' + date.getDate().toString();
  const month = date.getMonth() >= 9
    ? (date.getMonth() + 1).toString()
    : '0' + (date.getMonth() + 1).toString();
  return date.getFullYear() + '/' + month + '/' + day;
}

describe('addWords reducer', () => {
  it('returns initial state for unknown action', () => {
    const state = reducer(undefined, { type: 'UNKNOWN' } as any);
    expect(state).toEqual(initialState);
  });

  describe('ADD_WORD', () => {
    it('adds a word with due_date set to today and bank 1', () => {
      const state = reducer(initialState, {
        type: actionTypes.ADD_WORD,
        word: sampleWord,
      });

      expect(state.words).toHaveLength(1);
      expect(state.words[0].simp).toBe('你好');
      expect(state.words[0].bank).toBe(1);
      expect(state.words[0].due_date).toBe(formatToday(new Date()));
    });

    it('sets due_date to tomorrow when more than 9 words exist', () => {
      const wordsArray: Word[] = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        simp: `字${i}`,
        trad: `字${i}`,
        pinyin: `zì${i}`,
        meaning: `char${i}`,
      }));

      const stateWith10 = { ...initialState, words: wordsArray };
      const state = reducer(stateWith10, {
        type: actionTypes.ADD_WORD,
        word: sampleWord,
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(state.words[0].due_date).toBe(formatToday(tomorrow));
    });

    it('prepends the new word to the beginning of the list', () => {
      const existingWord: Word = {
        id: 2,
        simp: '谢谢',
        trad: '謝謝',
        pinyin: 'xiè xie',
        meaning: 'thank you',
      };

      const stateWithWord = { ...initialState, words: [existingWord] };
      const state = reducer(stateWithWord, {
        type: actionTypes.ADD_WORD,
        word: sampleWord,
      });

      expect(state.words).toHaveLength(2);
      expect(state.words[0].simp).toBe('你好');
      expect(state.words[1].simp).toBe('谢谢');
    });
  });

  describe('ADD_CUSTOM_WORD', () => {
    it('adds a custom word with due_date today and bank 1', () => {
      const state = reducer(initialState, {
        type: actionTypes.ADD_CUSTOM_WORD,
        word: sampleWord,
      });

      expect(state.words).toHaveLength(1);
      expect(state.words[0].bank).toBe(1);
      expect(state.words[0].due_date).toBe(formatToday(new Date()));
    });

    it('sets due_date to tomorrow when more than 9 words exist (regression)', () => {
      const wordsArray: Word[] = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        simp: `字${i}`,
        trad: `字${i}`,
        pinyin: `zì${i}`,
        meaning: `char${i}`,
      }));

      const stateWith10 = { ...initialState, words: wordsArray };
      const state = reducer(stateWith10, {
        type: actionTypes.ADD_CUSTOM_WORD,
        word: sampleWord,
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(state.words[0].due_date).toBe(formatToday(tomorrow));
    });
  });

  describe('REMOVE_WORD', () => {
    it('removes the word with the matching id', () => {
      const stateWithWords = {
        ...initialState,
        words: [
          sampleWord,
          { id: 2, simp: '谢谢', trad: '謝謝', pinyin: 'xiè xie', meaning: 'thank you' },
        ],
      };

      const state = reducer(stateWithWords, {
        type: actionTypes.REMOVE_WORD,
        wordID: 1,
      });

      expect(state.words).toHaveLength(1);
      expect(state.words[0].id).toBe(2);
    });

    it('returns same state when removing non-existent id', () => {
      const stateWithWord = { ...initialState, words: [sampleWord] };
      const state = reducer(stateWithWord, {
        type: actionTypes.REMOVE_WORD,
        wordID: 999,
      });

      expect(state.words).toHaveLength(1);
    });
  });

  describe('UPDATE_MEANING', () => {
    it('updates the meaning of a matching word', () => {
      const stateWithWord = { ...initialState, words: [sampleWord] };
      const state = reducer(stateWithWord, {
        type: actionTypes.UPDATE_MEANING,
        wordID: 1,
        newMeaning: 'hi there',
      });

      expect(state.words[0].meaning).toBe('hi there');
    });

    it('does not modify other words', () => {
      const word2: Word = {
        id: 2,
        simp: '谢谢',
        trad: '謝謝',
        pinyin: 'xiè xie',
        meaning: 'thank you',
      };
      const stateWithWords = { ...initialState, words: [sampleWord, word2] };
      const state = reducer(stateWithWords, {
        type: actionTypes.UPDATE_MEANING,
        wordID: 1,
        newMeaning: 'hi',
      });

      expect(state.words[0].meaning).toBe('hi');
      expect(state.words[1].meaning).toBe('thank you');
    });
  });

  describe('CLEAR_WORDS', () => {
    it('clears all words', () => {
      const stateWithWords = { ...initialState, words: [sampleWord] };
      const state = reducer(stateWithWords, {
        type: actionTypes.CLEAR_WORDS,
      } as any);

      expect(state.words).toEqual([]);
    });
  });

  describe('SET_WORDS', () => {
    it('sets words and clears error/loading', () => {
      const loadingState = { ...initialState, loading: true, error: true };
      const words = [sampleWord];
      const state = reducer(loadingState, {
        type: actionTypes.SET_WORDS,
        words,
      });

      expect(state.words).toEqual(words);
      expect(state.error).toBe(false);
      expect(state.loading).toBe(false);
    });
  });

  describe('FETCH_WORDS', () => {
    it('sets loading to true', () => {
      const state = reducer(initialState, {
        type: actionTypes.FETCH_WORDS,
      } as any);

      expect(state.loading).toBe(true);
    });
  });

  describe('FETCH_WORDS_FAILED', () => {
    it('sets error true and loading false', () => {
      const loadingState = { ...initialState, loading: true };
      const state = reducer(loadingState, {
        type: actionTypes.FETCH_WORDS_FAILED,
      });

      expect(state.error).toBe(true);
      expect(state.loading).toBe(false);
    });
  });
});
