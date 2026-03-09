import * as actionTypes from '../actions/actionTypes';
import { Word } from '../../types/models';
import { AddWordsState } from '../../types/store';
import { WordAction } from '../../types/actions';

const DEFAULT_LIST = { id: 'default', name: 'General', createdAt: '', order: 0 };

const initialState: AddWordsState = {
  lists: [DEFAULT_LIST],
  activeListId: 'default',
  words: [],
  error: false,
  loading: false,
};

const reducer = (state = initialState, action: WordAction): AddWordsState => {
  switch (action.type) {
    case actionTypes.ADD_WORD: {
      const word = { ...action.word };
      const today = new Date();
      if (state.words.length > 9) {
        today.setDate(today.getDate() + 1);
      }
      const todayDay =
        today.getDate() >= 10 ? today.getDate().toString() : '0' + today.getDate().toString();
      const todayMonth =
        today.getMonth() >= 9
          ? (today.getMonth() + 1).toString()
          : '0' + (today.getMonth() + 1).toString();
      const todayYear = today.getFullYear().toString();
      const todayString = todayYear + '/' + todayMonth + '/' + todayDay;
      word.due_date = todayString;
      word.bank = 1;

      return {
        ...state,
        words: [word].concat(state.words),
      };
    }
    case actionTypes.ADD_CUSTOM_WORD: {
      const customWord = { ...action.word };
      const todayCustom = new Date();
      if (state.words.length > 9) {
        todayCustom.setDate(todayCustom.getDate() + 1);
      }

      const todayDayCustom =
        todayCustom.getDate() >= 10
          ? todayCustom.getDate().toString()
          : '0' + todayCustom.getDate().toString();
      const todayMonthCustom =
        todayCustom.getMonth() >= 9
          ? (todayCustom.getMonth() + 1).toString()
          : '0' + (todayCustom.getMonth() + 1).toString();
      const todayYearCustom = todayCustom.getFullYear().toString();
      const todayStringCustom = todayYearCustom + '/' + todayMonthCustom + '/' + todayDayCustom;
      customWord.due_date = todayStringCustom;
      customWord.bank = 1;

      return {
        ...state,
        words: [customWord].concat(state.words),
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

    default:
      return state;
  }
};

export default reducer;
