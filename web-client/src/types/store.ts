import { Word } from './models';

// Individual slice states
export interface AddWordsState {
  words: Word[];
  error: boolean;
  loading: boolean;
}

export interface AuthState {
  token: string | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  newSignUp: boolean;
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
