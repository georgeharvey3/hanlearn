import * as actionTypes from './actionTypes';
import { Word } from '../../types/models';
import {
  AddWordAction,
  AddCustomWordAction,
  RemoveWordAction,
  SetWordsAction,
  FetchWordsFailedAction,
  UpdateMeaningAction,
  AppThunk,
} from '../../types/actions';
import * as wordService from '../../services/wordService';

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

export const updateMeaning = (
  wordID: number,
  newMeaning: string
): UpdateMeaningAction => {
  return {
    type: actionTypes.UPDATE_MEANING,
    wordID: wordID,
    newMeaning: newMeaning,
  };
};

/**
 * Fetch all words in the user's word bank from Firestore
 */
export const initWords = (): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) {
      dispatch(fetchWordsFailed());
      return;
    }

    try {
      const words = await wordService.getUserWords(auth.userId);
      dispatch(setWords(words));
    } catch (error) {
      console.error('Failed to fetch words:', error);
      dispatch(fetchWordsFailed());
    }
  };
};

/**
 * Add a word to the user's word bank in Firestore
 */
export const postWord = (word: Word): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.addWordToBank(auth.userId, word);
      dispatch(addWord(word));
    } catch (error) {
      console.error('Failed to add word:', error);
    }
  };
};

/**
 * Add a custom word (not in dictionary) to Firestore
 */
export const postCustomWord = (
  word: { simp: string; meaning: string }
): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      const newWord = await wordService.addCustomWord(
        auth.userId,
        word.simp,
        word.meaning
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
export const postUpdateMeaning = (
  wordID: number,
  newMeaning: string
): AppThunk => {
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
 * Submit test results and update word banks in Firestore
 */
export const finishTest = (
  scores: { word_id: number; score: number }[]
): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      const newDates = await wordService.finishTest(auth.userId, scores);
      console.log('Test finished, new dates:', newDates);
    } catch (error) {
      console.error('Failed to finish test:', error);
    }
  };
};
