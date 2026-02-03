import { Word } from './models';

// Individual slice states
export interface AddWordsState {
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
