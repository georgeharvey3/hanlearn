/**
 * Additional tests for word action thunks — covers error paths that were
 * previously untested: deleteWord failure, postUpdateMeaning failure,
 * finishTest outer failure, postWord failure, postCustomWord failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore, authenticatedState } from '../../test/utils';
import * as wordActions from './word';
import * as wordService from '../../services/wordService';
import * as streakService from '../../services/streakService';
import { Word } from '../../types/models';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/wordService');
vi.mock('../../services/streakService');

const mockedWordService = vi.mocked(wordService);

const sampleWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello',
};

describe('word action thunks — error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteWord', () => {
    it('logs error and does not dispatch REMOVE_WORD when removeWordFromBank fails', async () => {
      mockedWordService.removeWordFromBank.mockRejectedValue(new Error('Firestore unavailable'));
      const store = createTestStore({
        ...authenticatedState(),
        addWords: { words: [sampleWord], error: false, loading: false },
      });

      // Should not throw
      await store.dispatch(wordActions.deleteWord(1) as any);

      // Word should still be in the store since the service call failed
      expect(store.getState().addWords.words).toHaveLength(1);
      expect(mockedWordService.removeWordFromBank).toHaveBeenCalledWith('test-user-123', 1);
    });
  });

  describe('postUpdateMeaning', () => {
    it('logs error and does not dispatch UPDATE_MEANING when updateWordMeaning fails', async () => {
      mockedWordService.updateWordMeaning.mockRejectedValue(new Error('Permission denied'));
      const store = createTestStore({
        ...authenticatedState(),
        addWords: { words: [sampleWord], error: false, loading: false },
      });

      await store.dispatch(wordActions.postUpdateMeaning(1, 'new meaning') as any);

      // Meaning should be unchanged since update failed
      expect(store.getState().addWords.words[0].meaning).toBe('hello');
      expect(mockedWordService.updateWordMeaning).toHaveBeenCalledWith(
        'test-user-123',
        1,
        'new meaning',
      );
    });
  });

  describe('finishTest', () => {
    const scores = [{ word_id: 1, score: 3 }];

    it('catches outer error when wordService.finishTest itself throws', async () => {
      mockedWordService.finishTest.mockRejectedValue(new Error('Test submission failed'));
      const store = createTestStore(authenticatedState());

      // Should not throw — outer catch handles it
      await store.dispatch(wordActions.finishTest(scores) as any);

      expect(mockedWordService.finishTest).toHaveBeenCalled();
      // getUserWords should NOT be called since finishTest threw before reaching it
      expect(mockedWordService.getUserWords).not.toHaveBeenCalled();
    });
  });

  describe('postWord', () => {
    it('logs error and does not dispatch ADD_WORD when addWordToBank fails', async () => {
      mockedWordService.addWordToBank.mockRejectedValue(new Error('Write failed'));
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.postWord(sampleWord) as any);

      expect(store.getState().addWords.words).toHaveLength(0);
      expect(mockedWordService.addWordToBank).toHaveBeenCalledWith('test-user-123', sampleWord);
    });
  });

  describe('postCustomWord', () => {
    it('logs error and does not dispatch ADD_CUSTOM_WORD when addCustomWord fails', async () => {
      mockedWordService.addCustomWord.mockRejectedValue(new Error('Custom word failed'));
      const store = createTestStore(authenticatedState());

      await store.dispatch(
        wordActions.postCustomWord({ text: '学习', meaning: 'to study', charSet: 'simp' }) as any,
      );

      expect(store.getState().addWords.words).toHaveLength(0);
      expect(mockedWordService.addCustomWord).toHaveBeenCalled();
    });
  });

  describe('action creators — direct calls', () => {
    it('addWord creates the correct action shape', () => {
      const action = wordActions.addWord(sampleWord);
      expect(action.type).toBe('ADD_WORD');
      expect(action.word).toBe(sampleWord);
    });

    it('addCustomWord creates the correct action shape', () => {
      const action = wordActions.addCustomWord(sampleWord);
      expect(action.type).toBe('ADD_CUSTOM_WORD');
      expect(action.word).toBe(sampleWord);
    });

    it('removeWord creates the correct action shape', () => {
      const action = wordActions.removeWord(42);
      expect(action.type).toBe('REMOVE_WORD');
      expect(action.wordID).toBe(42);
    });

    it('updateMeaning creates the correct action shape', () => {
      const action = wordActions.updateMeaning(7, 'updated definition');
      expect(action.type).toBe('UPDATE_MEANING');
      expect(action.wordID).toBe(7);
      expect(action.newMeaning).toBe('updated definition');
    });
  });
});
