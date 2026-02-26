import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore, authenticatedState } from '../../test/utils';
import * as wordActions from './word';
import * as wordService from '../../services/wordService';
import * as streakService from '../../services/streakService';
import { Word } from '../../types/models';

vi.mock('../../services/wordService');
vi.mock('../../services/streakService');

const mockedWordService = vi.mocked(wordService);
const mockedStreakService = vi.mocked(streakService);

const sampleWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello',
};

const sampleWords: Word[] = [
  sampleWord,
  {
    id: 2,
    simp: '谢谢',
    trad: '謝謝',
    pinyin: 'xiè xie',
    meaning: 'thank you',
    bank: 2,
    due_date: '2026/03/01',
  },
];

describe('word action thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initWords', () => {
    it('fetches words and dispatches SET_WORDS on success', async () => {
      mockedWordService.getUserWords.mockResolvedValue(sampleWords);
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.initWords() as any);

      expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123');
      expect(store.getState().addWords.words).toEqual(sampleWords);
      expect(store.getState().addWords.error).toBe(false);
    });

    it('dispatches FETCH_WORDS_FAILED when no userId', async () => {
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
        addWords: { words: [], error: false, loading: false },
        settings: { speechAvailable: false, synthAvailable: false },
      });

      await store.dispatch(wordActions.initWords() as any);

      expect(mockedWordService.getUserWords).not.toHaveBeenCalled();
      expect(store.getState().addWords.error).toBe(true);
    });

    it('dispatches FETCH_WORDS_FAILED on service error', async () => {
      mockedWordService.getUserWords.mockRejectedValue(new Error('Network error'));
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.initWords() as any);

      expect(store.getState().addWords.error).toBe(true);
    });
  });

  describe('postWord', () => {
    it('calls addWordToBank and dispatches ADD_WORD', async () => {
      mockedWordService.addWordToBank.mockResolvedValue(undefined);
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.postWord(sampleWord) as any);

      expect(mockedWordService.addWordToBank).toHaveBeenCalledWith(
        'test-user-123',
        sampleWord
      );
      expect(store.getState().addWords.words).toHaveLength(1);
      expect(store.getState().addWords.words[0].simp).toBe('你好');
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
        addWords: { words: [], error: false, loading: false },
        settings: { speechAvailable: false, synthAvailable: false },
      });

      await store.dispatch(wordActions.postWord(sampleWord) as any);

      expect(mockedWordService.addWordToBank).not.toHaveBeenCalled();
      expect(store.getState().addWords.words).toHaveLength(0);
    });
  });

  describe('deleteWord', () => {
    it('calls removeWordFromBank and dispatches REMOVE_WORD', async () => {
      mockedWordService.removeWordFromBank.mockResolvedValue(undefined);
      const store = createTestStore({
        ...authenticatedState(),
        addWords: { words: [sampleWord], error: false, loading: false },
      });

      await store.dispatch(wordActions.deleteWord(1) as any);

      expect(mockedWordService.removeWordFromBank).toHaveBeenCalledWith(
        'test-user-123',
        1
      );
      expect(store.getState().addWords.words).toHaveLength(0);
    });
  });

  describe('postUpdateMeaning', () => {
    it('calls updateWordMeaning and dispatches UPDATE_MEANING', async () => {
      mockedWordService.updateWordMeaning.mockResolvedValue(undefined);
      const store = createTestStore({
        ...authenticatedState(),
        addWords: { words: [sampleWord], error: false, loading: false },
      });

      await store.dispatch(wordActions.postUpdateMeaning(1, 'hi there') as any);

      expect(mockedWordService.updateWordMeaning).toHaveBeenCalledWith(
        'test-user-123',
        1,
        'hi there'
      );
      expect(store.getState().addWords.words[0].meaning).toBe('hi there');
    });
  });

  describe('finishTest', () => {
    const scores = [
      { word_id: 1, score: 4 },
      { word_id: 2, score: 2 },
    ];

    it('calls wordService.finishTest, re-fetches words, and records streak', async () => {
      const updatedWords = [
        { ...sampleWord, bank: 2, due_date: '2026/03/05' },
      ];
      mockedWordService.finishTest.mockResolvedValue({ '你好': '2026/03/05' });
      mockedWordService.getUserWords.mockResolvedValue(updatedWords);
      mockedStreakService.recordTestCompletion.mockResolvedValue(undefined);
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.finishTest(scores) as any);

      expect(mockedWordService.finishTest).toHaveBeenCalledWith(
        'test-user-123',
        scores
      );
      expect(mockedWordService.getUserWords).toHaveBeenCalledWith(
        'test-user-123'
      );
      // Verify the store was updated with refreshed words
      expect(store.getState().addWords.words).toEqual(updatedWords);
      expect(mockedStreakService.recordTestCompletion).toHaveBeenCalledWith(
        'test-user-123'
      );
    });

    it('still succeeds if streak recording fails', async () => {
      mockedWordService.finishTest.mockResolvedValue({ '你好': '2026/03/05' });
      mockedWordService.getUserWords.mockResolvedValue(sampleWords);
      mockedStreakService.recordTestCompletion.mockRejectedValue(
        new Error('streak error')
      );
      const store = createTestStore(authenticatedState());

      // Should not throw
      await store.dispatch(wordActions.finishTest(scores) as any);

      expect(mockedWordService.finishTest).toHaveBeenCalled();
      expect(mockedStreakService.recordTestCompletion).toHaveBeenCalled();
    });

    it('still records streak if word refresh fails', async () => {
      mockedWordService.finishTest.mockResolvedValue({ '你好': '2026/03/05' });
      mockedWordService.getUserWords.mockRejectedValue(new Error('fetch failed'));
      mockedStreakService.recordTestCompletion.mockResolvedValue(undefined);
      const store = createTestStore(authenticatedState());

      await store.dispatch(wordActions.finishTest(scores) as any);

      expect(mockedWordService.finishTest).toHaveBeenCalled();
      expect(mockedWordService.getUserWords).toHaveBeenCalled();
      expect(mockedStreakService.recordTestCompletion).toHaveBeenCalled();
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
        addWords: { words: [], error: false, loading: false },
        settings: { speechAvailable: false, synthAvailable: false },
      });

      await store.dispatch(wordActions.finishTest(scores) as any);

      expect(mockedWordService.finishTest).not.toHaveBeenCalled();
    });
  });

  describe('postCustomWord', () => {
    it('calls addCustomWord and dispatches ADD_CUSTOM_WORD', async () => {
      const customWord: Word = {
        id: -1000,
        simp: '学习',
        trad: '學習',
        pinyin: 'xué xí',
        meaning: 'to study',
      };
      mockedWordService.addCustomWord.mockResolvedValue(customWord);
      const store = createTestStore(authenticatedState());

      await store.dispatch(
        wordActions.postCustomWord({
          text: '学习',
          meaning: 'to study',
          charSet: 'simp',
        }) as any
      );

      expect(mockedWordService.addCustomWord).toHaveBeenCalledWith(
        'test-user-123',
        '学习',
        'to study',
        'simp'
      );
      expect(store.getState().addWords.words).toHaveLength(1);
      expect(store.getState().addWords.words[0].simp).toBe('学习');
    });
  });
});
