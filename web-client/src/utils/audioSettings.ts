export type QuizType = 'input' | 'flashcard';

export type QuizCategory = 'meaning' | 'pinyin';

const quizTypeKey = (category: QuizCategory): string =>
  category === 'meaning' ? 'meaningQuizType' : 'pinyinQuizType';

export const getQuizType = (category: QuizCategory): QuizType => {
  const stored = localStorage.getItem(quizTypeKey(category));
  if (stored === 'flashcard') return 'flashcard';
  // 'text' and 'speech' are legacy values from when input mode was split in two
  if (stored === 'input' || stored === 'text' || stored === 'speech') return 'input';

  // Fall back to the legacy boolean setting so preferences saved before the
  // per-answer-type quiz setting existed (and e2e fixtures) carry over.
  if (category === 'meaning' && localStorage.getItem('useFlashcards') !== 'false') {
    return 'flashcard';
  }
  return 'input';
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

export type AudioSessionType = 'playback' | 'ambient';

// iOS mutes the 'ambient' category with the silent switch, and Web Audio gets
// it by default. 'playback' plays through the switch but pauses other apps'
// audio, so it is used only while a sound setting is on.
export const audioSessionType = (
  settings: Pick<AudioSettings, 'useSound' | 'useSoundEffects'>,
): AudioSessionType => (settings.useSound || settings.useSoundEffects ? 'playback' : 'ambient');

// navigator.audioSession is Safari 17+ only, and lib.dom does not declare it.
interface AudioSessionNavigator {
  audioSession?: { type: AudioSessionType };
}

export const applyAudioSession = (): void => {
  const { audioSession } = navigator as AudioSessionNavigator;
  if (!audioSession) return;
  audioSession.type = audioSessionType(getAudioSettings());
};

export const setAudioSetting = (key: AudioSettingKey, value: boolean): AudioSettings => {
  localStorage.setItem(key, String(value));
  applyAudioSession();

  return getAudioSettings();
};
