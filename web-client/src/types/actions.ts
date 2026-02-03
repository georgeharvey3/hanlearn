import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { RootState } from './store';
import { Word } from './models';

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
  AUTH_START: 'AUTH_START',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAIL: 'AUTH_FAIL',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_INITIALIZED: 'AUTH_INITIALIZED',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  SET_SPEECH_AVAILABLE: 'SET_SPEECH_AVAILABLE',
  SET_SYNTH_AVAILABLE: 'SET_SYNTH_AVAILABLE',
  SET_VOICE: 'SET_VOICE',
  SET_LANG: 'SET_LANG',
} as const;

export type ActionType = typeof ActionTypes[keyof typeof ActionTypes];

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
  | UpdateMeaningAction;

export type AuthAction =
  | AuthStartAction
  | AuthSuccessAction
  | AuthFailAction
  | AuthLogoutAction
  | AuthInitializedAction
  | RegisterSuccessAction;

export type SettingsAction =
  | SetSpeechAvailableAction
  | SetSynthAvailableAction
  | SetVoiceAction
  | SetLangAction;

// Combined action type
export type AppAction = WordAction | AuthAction | SettingsAction;

// Thunk types
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  AnyAction
>;

export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>;
