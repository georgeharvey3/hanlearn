import * as actionTypes from './actionTypes';
import { Word, WordList } from '../../types/models';
import {
  AddWordAction,
  AddCustomWordAction,
  RemoveWordAction,
  SetWordsAction,
  FetchWordsFailedAction,
  UpdateMeaningAction,
  SetWordListsAction,
  AddWordListAction,
  RemoveWordListAction,
  RenameWordListAction,
  SetActiveListAction,
  SetListStatsAction,
  AppThunk,
} from '../../types/actions';
import { ListStats } from '../../types/store';
import * as wordService from '../../services/wordService';
import { recordTestCompletion } from '../../services/streakService';

export const addWord = (word: Word): AddWordAction => {
  return {
    type: actionTypes.ADD_WORD,
    word: word,
  };
};

export const addCustomWord = (word: Word): AddCustomWordAction => {
  return {
    type: actionTypes.ADD_CUSTOM_WORD,
    word: word,
  };
};

export const removeWord = (wordID: number): RemoveWordAction => {
  return {
    type: actionTypes.REMOVE_WORD,
    wordID: wordID,
  };
};

export const setWords = (words: Word[]): SetWordsAction => {
  return {
    type: actionTypes.SET_WORDS,
    words: words,
  };
};

export const fetchWordsFailed = (): FetchWordsFailedAction => {
  return {
    type: actionTypes.FETCH_WORDS_FAILED,
  };
};

export const updateMeaning = (wordID: number, newMeaning: string): UpdateMeaningAction => {
  return {
    type: actionTypes.UPDATE_MEANING,
    wordID: wordID,
    newMeaning: newMeaning,
  };
};

export const setWordLists = (lists: WordList[]): SetWordListsAction => {
  return {
    type: actionTypes.SET_WORD_LISTS,
    lists,
  };
};

export const addWordList = (list: WordList): AddWordListAction => {
  return {
    type: actionTypes.ADD_WORD_LIST,
    list,
  };
};

export const removeWordList = (listId: string): RemoveWordListAction => {
  return {
    type: actionTypes.REMOVE_WORD_LIST,
    listId,
  };
};

export const renameWordListAction = (listId: string, newName: string): RenameWordListAction => {
  return {
    type: actionTypes.RENAME_WORD_LIST,
    listId,
    newName,
  };
};

export const setActiveList = (listId: string): SetActiveListAction => {
  return {
    type: actionTypes.SET_ACTIVE_LIST,
    listId,
  };
};

export const setListStats = (listStats: Record<string, ListStats>): SetListStatsAction => {
  return {
    type: actionTypes.SET_LIST_STATS,
    listStats,
  };
};

/**
 * Fetch all word lists and words for the active list from Firestore
 */
export const initWords = (): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) {
      dispatch(fetchWordsFailed());
      return;
    }

    try {
      // Backfill listId on legacy words before querying by list
      await wordService.migrateWordsWithoutListId(auth.userId);

      const lists = await wordService.getUserWordLists(auth.userId);
      dispatch(setWordLists(lists));

      const activeListId = addWords.activeListId;
      const [words, stats] = await Promise.all([
        wordService.getUserWords(auth.userId, activeListId),
        wordService.getListStats(auth.userId),
      ]);
      dispatch(setWords(words));
      dispatch(setListStats(stats));
    } catch (error) {
      console.error('Failed to fetch words:', error);
      dispatch(fetchWordsFailed());
    }
  };
};

/**
 * Switch the active list and fetch its words
 */
export const switchActiveList = (listId: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    dispatch(setActiveList(listId));

    if (!auth.userId) return;

    try {
      const words = await wordService.getUserWords(auth.userId, listId);
      dispatch(setWords(words));
    } catch (error) {
      console.error('Failed to fetch words for list:', error);
      dispatch(fetchWordsFailed());
    }
  };
};

/**
 * Create a new word list
 */
export const postCreateWordList = (name: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      const list = await wordService.createWordList(auth.userId, name);
      dispatch(addWordList(list));
      dispatch(switchActiveList(list.id));
    } catch (error) {
      console.error('Failed to create word list:', error);
    }
  };
};

/**
 * Rename a word list
 */
export const postRenameWordList = (listId: string, newName: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.renameWordList(auth.userId, listId, newName);
      dispatch(renameWordListAction(listId, newName));
    } catch (error) {
      console.error('Failed to rename word list:', error);
    }
  };
};

/**
 * Delete a word list and all its words
 */
export const postDeleteWordList = (listId: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.deleteWordList(auth.userId, listId);
      dispatch(removeWordList(listId));
    } catch (error) {
      console.error('Failed to delete word list:', error);
    }
  };
};

/**
 * Add a word to the user's word bank in Firestore
 */
export const postWord = (word: Word): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      await wordService.addWordToBank(auth.userId, word, addWords.activeListId);
      dispatch(addWord({ ...word, listId: addWords.activeListId }));
    } catch (error) {
      console.error('Failed to add word:', error);
    }
  };
};

/**
 * Add a custom word (not in dictionary) to Firestore
 */
export const postCustomWord = (word: {
  text: string;
  meaning: string;
  charSet: 'simp' | 'trad';
}): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      const newWord = await wordService.addCustomWord(
        auth.userId,
        word.text,
        word.meaning,
        word.charSet,
        addWords.activeListId,
      );
      dispatch(addCustomWord(newWord));
    } catch (error) {
      console.error('Failed to add custom word:', error);
    }
  };
};

/**
 * Remove a word from the user's word bank in Firestore
 */
export const deleteWord = (wordID: number): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.removeWordFromBank(auth.userId, wordID);
      dispatch(removeWord(wordID));
    } catch (error) {
      console.error('Failed to delete word:', error);
    }
  };
};

/**
 * Update the meaning for a word in Firestore
 */
export const postUpdateMeaning = (wordID: number, newMeaning: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.updateWordMeaning(auth.userId, wordID, newMeaning);
      dispatch(updateMeaning(wordID, newMeaning));
    } catch (error) {
      console.error('Failed to update meaning:', error);
    }
  };
};

/**
 * Submit test results and update word banks in Firestore.
 * Re-fetches the full word list so Redux state reflects the new bank levels and due dates.
 */
export const finishTest = (scores: { word_id: number; score: number }[]): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      await wordService.finishTest(auth.userId, scores);

      // Re-fetch words and stats so the local store has updated bank levels and due dates
      try {
        const [updatedWords, stats] = await Promise.all([
          wordService.getUserWords(auth.userId, addWords.activeListId),
          wordService.getListStats(auth.userId),
        ]);
        dispatch(setWords(updatedWords));
        dispatch(setListStats(stats));
      } catch (fetchError) {
        console.error('Failed to refresh words after test:', fetchError);
      }

      try {
        await recordTestCompletion(auth.userId);
      } catch (streakError) {
        console.error('Failed to record streak:', streakError);
      }
    } catch (error) {
      console.error('Failed to finish test:', error);
    }
  };
};
