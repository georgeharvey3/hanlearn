import { Word, WordList } from './models';

// Individual slice states
export interface AddWordsState {
  lists: WordList[];
  activeListId: string;
  words: Word[];
  error: boolean;
  loading: boolean;
}

export interface AuthState {
  userId: string | null;
  loading: boolean;
  error: string | null;
  newSignUp: boolean;
  initialized: boolean;
  modalOpen: boolean;
  modalMode: 'login' | 'register' | 'forgot-password';
  resetEmailSent: boolean;
}

export interface SettingsState {
  speechAvailable: boolean;
  synthAvailable: boolean;
  voice?: SpeechSynthesisVoice;
  lang?: string;
}

// Root state combining all slices
export interface RootState {
  addWords: AddWordsState;
  auth: AuthState;
  settings: SettingsState;
}
