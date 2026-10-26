import * as Sentry from '@sentry/react';
import * as actionTypes from './actionTypes';
import { Word, WordDirectionResults, WordList } from '../../types/models';
import {
  AddWordAction,
  AddCustomWordAction,
  RemoveWordAction,
  SetWordsAction,
  FetchWordsFailedAction,
  UpdateMeaningAction,
  AddExistingWordAction,
  SetListsOfWordAction,
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
import { loadPremadeEntries, PremadeList } from '../../services/premadeListService';
import { recordTestCompletion } from '../../services/streakService';
import { recordLevelSnapshot } from '../../services/retentionService';
import { levelCounts } from '../../utils/dashboard';
import { traceAsync } from '../../services/performanceService';
import { trackFeatureUsage } from '../../services/analyticsService';
import { showNotification } from './notifications';
import { ALL_LISTS_ID, DEFAULT_LIST_ID, writeActiveList } from '../../utils/activeList';
import { copy } from '../../copy';

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

export const addExistingWord = (word: Word): AddExistingWordAction => {
  return {
    type: actionTypes.ADD_EXISTING_WORD,
    word,
  };
};

export const setListsOfWordAction = (wordID: number, listIds: string[]): SetListsOfWordAction => {
  return {
    type: actionTypes.SET_LISTS_OF_WORD,
    wordID,
    listIds,
  };
};

/**
 * Read the list stats again. A word can be in more than one list, so a change
 * to one word can move the counts of lists the store does not hold.
 */
const refreshListStats = (): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;
    try {
      dispatch(setListStats(await wordService.getListStats(auth.userId)));
    } catch (error) {
      console.error('Failed to refresh list stats:', error);
      Sentry.captureException(error);
    }
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
    const { auth } = getState();
    if (!auth.userId) {
      dispatch(fetchWordsFailed());
      return;
    }

    dispatch({ type: actionTypes.FETCH_WORDS });

    try {
      // Backfill listIds and the per-direction scheduling map on legacy words
      // before querying by list. Both run in one pass over the collection.
      await wordService.migrateUserWords(auth.userId);

      const lists = await wordService.getUserWordLists(auth.userId);
      dispatch(setWordLists(lists));

      // Read the state again: setWordLists falls back to General when the
      // remembered list is gone.
      const activeListId = getState().addWords.activeListId;
      writeActiveList(activeListId);
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
      writeActiveList(getState().addWords.activeListId);
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
    writeActiveList(listId);

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
 * Add a premade list: make a word list from it and make that the active list.
 * Resolves to whether the list was added.
 */
export const postAddPremadeList = (premade: PremadeList): AppThunk<Promise<boolean>> => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return false;

    try {
      const entries = await loadPremadeEntries(premade.id);
      const { list } = await wordService.addPremadeList(auth.userId, premade.name, entries);
      dispatch(addWordList(list));
      await dispatch(switchActiveList(list.id));
      await dispatch(refreshListStats());
      dispatch(showNotification(copy.premadeLists.toastAdded(premade.name)));
      trackFeatureUsage('premade_list_added');
      return true;
    } catch (error) {
      console.error('Failed to add premade list:', error);
      Sentry.captureException(error);
      dispatch(showNotification(copy.premadeLists.toastFailed, 'error'));
      return false;
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
 * Delete a word list. Its words that are in no other list go with it; the
 * others stay in their other lists.
 */
export const postDeleteWordList = (listId: string): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      await wordService.deleteWordList(auth.userId, listId);
      dispatch(removeWordList(listId));
      // Deleting the active list moves the learner to General. The store held
      // the words of the deleted list, so it loads the words of General.
      if (addWords.activeListId === listId) {
        await dispatch(switchActiveList(getState().addWords.activeListId));
      }
      await dispatch(refreshListStats());
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
      const targetListId =
        addWords.activeListId === ALL_LISTS_ID ? DEFAULT_LIST_ID : addWords.activeListId;
      const existingWord = await wordService.addWordToList(auth.userId, word, targetListId);
      if (existingWord) dispatch(addExistingWord(existingWord));
      else dispatch(addWord({ ...word, listIds: [targetListId] }));
      dispatch(showNotification(copy.wordBank.toastAdded(word.simp)));
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
      dispatch(showNotification(copy.wordBank.toastAdded(word.text)));
    } catch (error) {
      console.error('Failed to add custom word:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to add word', 'error'));
    }
  };
};

/**
 * Take a word out of the active list. A word that leaves its last list is
 * deleted with its schedule. In the all-lists view, the word is deleted from
 * every list.
 */
export const deleteWord = (wordID: number): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      const { activeListId, lists } = addWords;
      const allLists = activeListId === ALL_LISTS_ID;
      const deleted = await wordService.removeWordFromList(
        auth.userId,
        wordID,
        allLists ? undefined : activeListId,
      );
      dispatch(removeWord(wordID));
      await dispatch(refreshListStats());
      const listName = lists.find((l) => l.id === activeListId)?.name ?? '';
      dispatch(
        showNotification(
          deleted ? copy.wordBank.toastDeleted : copy.wordBank.toastRemovedFrom(listName),
        ),
      );
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
 * Set the lists that hold a word. The schedule does not change. Refreshes list
 * stats so the counts reflect the new lists.
 */
export const postListsOfWord = (wordID: number, listIds: string[]): AppThunk => {
  return async (dispatch, getState) => {
    const { auth } = getState();
    if (!auth.userId) return;

    try {
      await wordService.setListsOfWord(auth.userId, wordID, listIds);
      dispatch(setListsOfWordAction(wordID, listIds));
      await dispatch(refreshListStats());
      dispatch(showNotification(copy.wordBank.toastListsSaved));
    } catch (error) {
      console.error('Failed to set the lists of a word:', error);
      Sentry.captureException(error);
      dispatch(showNotification(copy.wordBank.listsFailed, 'error'));
    }
  };
};

/**
 * Submit the results of a session and reschedule the directions it asked.
 * Re-fetches the full word list so Redux state reflects the new levels and due dates.
 */
export const finishTest = (results: WordDirectionResults[]): AppThunk => {
  return async (dispatch, getState) => {
    const { auth, addWords } = getState();
    if (!auth.userId) return;

    try {
      await traceAsync('finish_test', async () => {
        await wordService.finishTest(auth.userId!, results);

        // Re-fetch words and stats so the local store has updated levels and
        // due dates. Every list is fetched, because the level snapshot counts
        // the whole collection; the store keeps the active list's words.
        try {
          const [allWords, stats] = await Promise.all([
            wordService.getUserWords(auth.userId!),
            wordService.getListStats(auth.userId!),
          ]);
          const updatedWords =
            addWords.activeListId === ALL_LISTS_ID
              ? allWords
              : allWords.filter((word) => word.listIds?.includes(addWords.activeListId));
          dispatch(setWords(updatedWords));
          dispatch(setListStats(stats));

          try {
            await recordLevelSnapshot(auth.userId!, levelCounts(allWords), new Date());
          } catch (snapshotError) {
            console.error('Failed to record level snapshot:', snapshotError);
            Sentry.captureException(snapshotError);
          }
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
      trackFeatureUsage('test_completed', { word_count: String(results.length) });
    } catch (error) {
      console.error('Failed to finish test:', error);
      Sentry.captureException(error);
      dispatch(showNotification('Failed to save test results', 'error'));
    }
  };
};
