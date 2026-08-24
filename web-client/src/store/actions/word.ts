import * as Sentry from '@sentry/react';
import * as actionTypes from './actionTypes';
import { Word, WordList } from '../../types/models';
import {
  AddWordAction,
  AddCustomWordAction,
  RemoveWordAction,
  SetWordsAction,
  FetchWordsFailedAction,
  UpdateMeaningAction,
  MoveWordAction,
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
import { traceAsync } from '../../services/performanceService';
import { trackFeatureUsage } from '../../services/analyticsService';
import { showNotification } from './notifications';

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

export const moveWordAction = (wordID: number, newListId: string): MoveWordAction => {
  return {
    type: actionTypes.MOVE_WORD,
    wordID,
    newListId,
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

    dispatch({ type: actionTypes.FETCH_WORDS });

    try {
      // Backfill listId on legacy words before querying by list
      await wordService.migrateWordsWithoutListId(auth.userId);

      const lists = await wordService.getUserWordLists(auth.userId);
      dispatch(setWordLists(lists));

      const activeListId = addWords.activeListId;
      const [words, stats] = await Promise.all([
        wordService.getUserWords(
          auth.userId,
          activeListId === '__all__' ? undefined : activeListId,
        ),
        wordService.getListStats(auth.userId),
      ]);
      dispatch(setWords(words));
      dispatch(setListStats(stats));
    } catch (error) {
      console.error('Failed to fetch words:', error);
      Sentry.captureException(error);
      dispatch(fetchWordsFailed());
    }
  };
};

/**
 * Fetch word lists and per-list stats without loading the words themselves.
 * Used by screens that show the list selector but read their own data,
 * such as the Dashboard.
 */
export const initWordLists = (): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      const [lists, stats] = await Promise.all([
        wordService.getUserWordLists(auth.userId),
        wordService.getListStats(auth.userId),
      ]);
      dispatch(setWordLists(lists));
      dispatch(setListStats(stats));
    } catch (error) {
      console.error('Failed to fetch word lists:', error);
      Sentry.captureException(error);
    }
  };
};

/**
 * Switch the active list and fetch its words.
 * Pass '__all__' to fetch words across all lists (cross-list mode).
 */
export const switchActiveList = (listId: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    dispatch(setActiveList(listId));

    if (!auth.userId) return;

    dispatch({ type: actionTypes.FETCH_WORDS });

    try {
      const words = await wordService.getUserWords(
        auth.userId,
        listId === '__all__' ? undefined : listId,
      );
      dispatch(setWords(words));
    } catch (error) {
      console.error('Failed to fetch words for list:', error);
      Sentry.captureException(error);
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
      dispatch(showNotification(`List "${name}" created`));
    } catch (error) {
      console.error('Failed to create word list:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to create list', 'error'));
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
      dispatch(showNotification(`List renamed to "${newName}"`));
    } catch (error) {
      console.error('Failed to rename word list:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to rename list', 'error'));
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
      dispatch(showNotification('List deleted'));
    } catch (error) {
      console.error('Failed to delete word list:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to delete list', 'error'));
    }
  };
};

/**
 * Add a word to the user's word list in Firestore
 */
export const postWord = (word: Word): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      // '__all__' is a virtual list for cross-list mode; words must belong to a real list
      const targetListId = addWords.activeListId === '__all__' ? 'default' : addWords.activeListId;
      await wordService.addWordToList(auth.userId, word, targetListId);
      dispatch(addWord({ ...word, listId: targetListId }));
      dispatch(showNotification(`"${word.simp}" added to your list`));
      trackFeatureUsage('word_added');
    } catch (error) {
      console.error('Failed to add word:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to add word', 'error'));
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
      const targetListId = addWords.activeListId === '__all__' ? 'default' : addWords.activeListId;
      const newWord = await wordService.addCustomWord(
        auth.userId,
        word.text,
        word.meaning,
        word.charSet,
        targetListId,
      );
      dispatch(addCustomWord(newWord));
      dispatch(showNotification(`"${word.text}" added to your list`));
    } catch (error) {
      console.error('Failed to add custom word:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to add word', 'error'));
    }
  };
};

/**
 * Remove a word from the user's word list in Firestore
 */
export const deleteWord = (wordID: number): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.removeWordFromList(auth.userId, wordID);
      dispatch(removeWord(wordID));
      dispatch(showNotification('Word removed'));
    } catch (error) {
      console.error('Failed to delete word:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to remove word', 'error'));
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
      dispatch(showNotification('Meaning updated'));
    } catch (error) {
      console.error('Failed to update meaning:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to update meaning', 'error'));
    }
  };
};

/**
 * Move a word to a different list. Refreshes list stats so due-count
 * badges reflect the new distribution.
 */
export const postMoveWord = (wordID: number, newListId: string, wordLabel?: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    const targetList = addWords.lists.find((l) => l.id === newListId);

    try {
      await wordService.moveWordToList(auth.userId, wordID, newListId);
      dispatch(moveWordAction(wordID, newListId));

      try {
        const stats = await wordService.getListStats(auth.userId);
        dispatch(setListStats(stats));
      } catch (statsError) {
        console.error('Failed to refresh list stats after move:', statsError);
        Sentry.captureException(statsError);
      }

      const destination = targetList?.name ?? 'list';
      const subject = wordLabel ? `"${wordLabel}"` : 'Word';
      dispatch(showNotification(`${subject} moved to ${destination}`));
    } catch (error) {
      console.error('Failed to move word:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to move word', 'error'));
    }
  };
};

/**
 * Submit test results and update word levels in Firestore.
 * Re-fetches the full word list so Redux state reflects the new levels and due dates.
 */
export const finishTest = (scores: { word_id: number; score: number }[]): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      await traceAsync('finish_test', async () => {
        await wordService.finishTest(auth.userId!, scores);

        // Re-fetch words and stats so the local store has updated levels and due dates
        try {
          const [updatedWords, stats] = await Promise.all([
            wordService.getUserWords(
              auth.userId!,
              addWords.activeListId === '__all__' ? undefined : addWords.activeListId,
            ),
            wordService.getListStats(auth.userId!),
          ]);
          dispatch(setWords(updatedWords));
          dispatch(setListStats(stats));
        } catch (fetchError) {
          console.error('Failed to refresh words after test:', fetchError);
          Sentry.captureException(fetchError);
        }

        try {
          await recordTestCompletion(auth.userId!);
        } catch (streakError) {
          console.error('Failed to record streak:', streakError);
          Sentry.captureException(streakError);
        }
      });

      dispatch(showNotification('Test complete — results saved'));
      trackFeatureUsage('test_completed', { word_count: String(scores.length) });
    } catch (error) {
      console.error('Failed to finish test:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to save test results', 'error'));
    }
  };
};
