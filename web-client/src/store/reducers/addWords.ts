import * as actionTypes from '../actions/actionTypes';
import { Word } from '../../types/models';
import { AddWordsState } from '../../types/store';
import { WordAction } from '../../types/actions';
import { makeDirections } from '../../utils/directions';

const DEFAULT_LIST = { id: 'default', name: 'General', createdAt: '', order: 0 };

/**
 * Compute the initial due date string (YYYY/MM/DD) for a newly added word.
 * If the list already has more than 9 words, the word is due tomorrow to avoid
 * flooding a new study session.
 */
function formatInitialDueDate(wordCount: number): string {
  const date = new Date();
  if (wordCount > 9) {
    date.setDate(date.getDate() + 1);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}/${month}/${day}`;
}

/**
 * Insert a word into the list maintaining ascending due_date sort order.
 * Words without a due_date are placed at the end.
 */
function insertSorted(words: Word[], newWord: Word): Word[] {
  const newDueDate = newWord.due_date ?? '';
  const index = words.findIndex((w) => (w.due_date ?? '') > newDueDate);
  if (index === -1) {
    return [...words, newWord];
  }
  const result = [...words];
  result.splice(index, 0, newWord);
  return result;
}

const initialState: AddWordsState = {
  lists: [DEFAULT_LIST],
  activeListId: 'default',
  words: [],
  listStats: {},
  error: false,
  loading: false,
};

const reducer = (state = initialState, action: WordAction): AddWordsState => {
  switch (action.type) {
    case actionTypes.ADD_WORD: {
      const dueDate = formatInitialDueDate(state.words.length);
      const word = {
        ...action.word,
        due_date: dueDate,
        level: 1,
        // Match what addWordToList writes, so the optimistic word has the same
        // shape as the one the next read brings back.
        directions: makeDirections(1, dueDate),
      };
      return {
        ...state,
        words: insertSorted(state.words, word),
      };
    }
    case actionTypes.ADD_CUSTOM_WORD: {
      const customDueDate = formatInitialDueDate(state.words.length);
      const customWord = {
        ...action.word,
        due_date: customDueDate,
        level: 1,
        directions: makeDirections(1, customDueDate),
      };
      return {
        ...state,
        words: insertSorted(state.words, customWord),
      };
    }

    case actionTypes.REMOVE_WORD: {
      const newWords = state.words.filter((word) => word.id !== action.wordID);
      return {
        ...state,
        words: newWords,
      };
    }
    case actionTypes.UPDATE_MEANING: {
      const newWordsMeaning = state.words.map((word) =>
        word.id === action.wordID ? { ...word, meaning: action.newMeaning } : word,
      );
      return {
        ...state,
        words: newWordsMeaning,
      };
    }
    case actionTypes.MOVE_WORD: {
      // In cross-list view, keep the word but update its listId.
      // In a specific list view, remove the word once it leaves the active list.
      const newWords =
        state.activeListId === '__all__'
          ? state.words.map((word) =>
              word.id === action.wordID ? { ...word, listId: action.newListId } : word,
            )
          : state.words.filter((word) => word.id !== action.wordID);
      return {
        ...state,
        words: newWords,
      };
    }
    case actionTypes.CLEAR_WORDS:
      return {
        ...state,
        words: [],
      };
    case actionTypes.FETCH_WORDS:
      return {
        ...state,
        loading: true,
      };
    case actionTypes.SET_WORDS:
      return {
        ...state,
        words: action.words,
        error: false,
        loading: false,
      };
    case actionTypes.FETCH_WORDS_FAILED:
      return {
        ...state,
        error: true,
        loading: false,
      };

    // Word list actions
    case actionTypes.SET_WORD_LISTS:
      return {
        ...state,
        lists: action.lists,
      };
    case actionTypes.ADD_WORD_LIST:
      return {
        ...state,
        lists: [...state.lists, action.list],
      };
    case actionTypes.REMOVE_WORD_LIST: {
      const newLists = state.lists.filter((list) => list.id !== action.listId);
      // If the active list was deleted, switch to default
      const newActiveListId = state.activeListId === action.listId ? 'default' : state.activeListId;
      return {
        ...state,
        lists: newLists,
        activeListId: newActiveListId,
      };
    }
    case actionTypes.RENAME_WORD_LIST:
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.listId ? { ...list, name: action.newName } : list,
        ),
      };
    case actionTypes.SET_ACTIVE_LIST:
      return {
        ...state,
        activeListId: action.listId,
      };
    case actionTypes.SET_LIST_STATS:
      return {
        ...state,
        listStats: action.listStats,
      };

    default:
      return state;
  }
};

export default reducer;
