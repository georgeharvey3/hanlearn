export type QuizType = 'text' | 'speech' | 'flashcard';

export type QuizCategory = 'meaning' | 'pinyin';

const quizTypeKey = (category: QuizCategory): string =>
  category === 'meaning' ? 'meaningQuizType' : 'pinyinQuizType';

const isQuizType = (value: string | null): value is QuizType =>
  value === 'text' || value === 'speech' || value === 'flashcard';

export const getQuizType = (category: QuizCategory): QuizType => {
  const stored = localStorage.getItem(quizTypeKey(category));
  if (isQuizType(stored)) {
    return stored;
  }

  // Fall back to the legacy boolean settings so preferences saved before the
  // per-answer-type quiz setting existed (and e2e fixtures) carry over.
  if (category === 'meaning') {
    if (localStorage.getItem('useFlashcards') !== 'false') return 'flashcard';
    return localStorage.getItem('useEnglishSpeechRecognition') !== 'false' ? 'speech' : 'text';
  }
  return localStorage.getItem('useChineseSpeechRecognition') !== 'false' ? 'speech' : 'text';
};

export const setQuizType = (category: QuizCategory, value: QuizType): void => {
  localStorage.setItem(quizTypeKey(category), value);
};

export interface AudioSettings {
  useSound: boolean;
  useSoundEffects: boolean;
  useAutoRecord: boolean;
  meaningQuizType: QuizType;
  pinyinQuizType: QuizType;
}

export type AudioSettingKey = 'useSound' | 'useSoundEffects' | 'useAutoRecord';

export const getAudioSettings = (): AudioSettings => ({
  useSound: localStorage.getItem('useSound') !== 'false',
  useSoundEffects: localStorage.getItem('useSoundEffects') !== 'false',
  useAutoRecord: localStorage.getItem('useAutoRecord') !== 'false',
  meaningQuizType: getQuizType('meaning'),
  pinyinQuizType: getQuizType('pinyin'),
});

export const setAudioSetting = (key: AudioSettingKey, value: boolean): AudioSettings => {
  localStorage.setItem(key, String(value));

  return getAudioSettings();
};

export interface AudioSettingItem {
  key: AudioSettingKey;
  label: string;
  disabled: boolean;
}

export const getAudioSettingItems = (
  speechAvailable: boolean,
  synthAvailable: boolean,
): AudioSettingItem[] => [
  {
    key: 'useSound',
    label: 'Text-to-speech',
    disabled: !synthAvailable,
  },
  {
    key: 'useSoundEffects',
    label: 'Sound effects',
    disabled: false,
  },
  {
    key: 'useAutoRecord',
    label: 'Auto-start microphone',
    disabled: false,
  },
];
