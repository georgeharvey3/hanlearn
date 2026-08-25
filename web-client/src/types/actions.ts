import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { RootState, Notification } from './store';
import { Word, WordList } from './models';
import { ListStats } from './store';

// Action type constants
export const ActionTypes = {
  ADD_WORD: 'ADD_WORD',
  ADD_CUSTOM_WORD: 'ADD_CUSTOM_WORD',
  REMOVE_WORD: 'REMOVE_WORD',
  CLEAR_WORDS: 'CLEAR_WORDS',
  SET_WORDS: 'SET_WORDS',
  FETCH_WORDS: 'FETCH_WORDS',
  FETCH_WORDS_FAILED: 'FETCH_WORDS_FAILED',
  POST_WORD: 'POST_WORD',
  DELETE_WORD: 'DELETE_WORD',
  UPDATE_MEANING: 'UPDATE_MEANING',
  MOVE_WORD: 'MOVE_WORD',
  SET_WORD_LISTS: 'SET_WORD_LISTS',
  ADD_WORD_LIST: 'ADD_WORD_LIST',
  REMOVE_WORD_LIST: 'REMOVE_WORD_LIST',
  RENAME_WORD_LIST: 'RENAME_WORD_LIST',
  SET_ACTIVE_LIST: 'SET_ACTIVE_LIST',
  SET_LIST_STATS: 'SET_LIST_STATS',
  AUTH_START: 'AUTH_START',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAIL: 'AUTH_FAIL',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_INITIALIZED: 'AUTH_INITIALIZED',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  OPEN_AUTH_MODAL: 'OPEN_AUTH_MODAL',
  CLOSE_AUTH_MODAL: 'CLOSE_AUTH_MODAL',
  SET_AUTH_MODAL_MODE: 'SET_AUTH_MODAL_MODE',
  PASSWORD_RESET_SENT: 'PASSWORD_RESET_SENT',
  SET_SPEECH_AVAILABLE: 'SET_SPEECH_AVAILABLE',
  SET_SYNTH_AVAILABLE: 'SET_SYNTH_AVAILABLE',
  SET_VOICE: 'SET_VOICE',
  SET_LANG: 'SET_LANG',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  DISMISS_NOTIFICATION: 'DISMISS_NOTIFICATION',
} as const;

export type ActionType = (typeof ActionTypes)[keyof typeof ActionTypes];

// Word actions
export interface AddWordAction {
  type: typeof ActionTypes.ADD_WORD;
  word: Word;
}

export interface AddCustomWordAction {
  type: typeof ActionTypes.ADD_CUSTOM_WORD;
  word: Word;
}

export interface RemoveWordAction {
  type: typeof ActionTypes.REMOVE_WORD;
  wordID: number;
}

export interface ClearWordsAction {
  type: typeof ActionTypes.CLEAR_WORDS;
}

export interface SetWordsAction {
  type: typeof ActionTypes.SET_WORDS;
  words: Word[];
}

export interface FetchWordsAction {
  type: typeof ActionTypes.FETCH_WORDS;
}

export interface FetchWordsFailedAction {
  type: typeof ActionTypes.FETCH_WORDS_FAILED;
}

export interface UpdateMeaningAction {
  type: typeof ActionTypes.UPDATE_MEANING;
  wordID: number;
  newMeaning: string;
}

export interface MoveWordAction {
  type: typeof ActionTypes.MOVE_WORD;
  wordID: number;
  newListId: string;
}

export interface SetWordListsAction {
  type: typeof ActionTypes.SET_WORD_LISTS;
  lists: WordList[];
}

export interface AddWordListAction {
  type: typeof ActionTypes.ADD_WORD_LIST;
  list: WordList;
}

export interface RemoveWordListAction {
  type: typeof ActionTypes.REMOVE_WORD_LIST;
  listId: string;
}

export interface RenameWordListAction {
  type: typeof ActionTypes.RENAME_WORD_LIST;
  listId: string;
  newName: string;
}

export interface SetActiveListAction {
  type: typeof ActionTypes.SET_ACTIVE_LIST;
  listId: string;
}

export interface SetListStatsAction {
  type: typeof ActionTypes.SET_LIST_STATS;
  listStats: Record<string, ListStats>;
}

// Auth actions
export interface AuthStartAction {
  type: typeof ActionTypes.AUTH_START;
}

export interface AuthSuccessAction {
  type: typeof ActionTypes.AUTH_SUCCESS;
  userId: string;
}

export interface AuthFailAction {
  type: typeof ActionTypes.AUTH_FAIL;
  error: string;
}

export interface AuthLogoutAction {
  type: typeof ActionTypes.AUTH_LOGOUT;
}

export interface AuthInitializedAction {
  type: typeof ActionTypes.AUTH_INITIALIZED;
}

export interface RegisterSuccessAction {
  type: typeof ActionTypes.REGISTER_SUCCESS;
}

export interface OpenAuthModalAction {
  type: typeof ActionTypes.OPEN_AUTH_MODAL;
  mode: 'login' | 'register' | 'forgot-password';
}

export interface CloseAuthModalAction {
  type: typeof ActionTypes.CLOSE_AUTH_MODAL;
}

export interface SetAuthModalModeAction {
  type: typeof ActionTypes.SET_AUTH_MODAL_MODE;
  mode: 'login' | 'register' | 'forgot-password';
}

export interface PasswordResetSentAction {
  type: typeof ActionTypes.PASSWORD_RESET_SENT;
}

// Settings actions
export interface SetSpeechAvailableAction {
  type: typeof ActionTypes.SET_SPEECH_AVAILABLE;
  available: boolean;
}

export interface SetSynthAvailableAction {
  type: typeof ActionTypes.SET_SYNTH_AVAILABLE;
  available: boolean;
}

export interface SetVoiceAction {
  type: typeof ActionTypes.SET_VOICE;
  voice: SpeechSynthesisVoice;
}

export interface SetLangAction {
  type: typeof ActionTypes.SET_LANG;
  lang: string;
}

// Union types for each reducer
export type WordAction =
  | AddWordAction
  | AddCustomWordAction
  | RemoveWordAction
  | ClearWordsAction
  | SetWordsAction
  | FetchWordsAction
  | FetchWordsFailedAction
  | UpdateMeaningAction
  | MoveWordAction
  | SetWordListsAction
  | AddWordListAction
  | RemoveWordListAction
  | RenameWordListAction
  | SetActiveListAction
  | SetListStatsAction;

export type AuthAction =
  | AuthStartAction
  | AuthSuccessAction
  | AuthFailAction
  | AuthLogoutAction
  | AuthInitializedAction
  | RegisterSuccessAction
  | OpenAuthModalAction
  | CloseAuthModalAction
  | SetAuthModalModeAction
  | PasswordResetSentAction;

export type SettingsAction =
  | SetSpeechAvailableAction
  | SetSynthAvailableAction
  | SetVoiceAction
  | SetLangAction;

// Notification actions
export interface ShowNotificationAction {
  type: typeof ActionTypes.SHOW_NOTIFICATION;
  notification: Notification;
}

export interface DismissNotificationAction {
  type: typeof ActionTypes.DISMISS_NOTIFICATION;
  id: string;
}

export type NotificationAction = ShowNotificationAction | DismissNotificationAction;

// Combined action type
export type AppAction = WordAction | AuthAction | SettingsAction | NotificationAction;

// Thunk types
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, AppAction>;

export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;
