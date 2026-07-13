export interface AudioSettings {
  useSound: boolean;
  useSoundEffects: boolean;
  useChineseSpeechRecognition: boolean;
  useEnglishSpeechRecognition: boolean;
  useAutoRecord: boolean;
  useFlashcards: boolean;
}

export const getAudioSettings = (): AudioSettings => ({
  useSound: localStorage.getItem('useSound') !== 'false',
  useSoundEffects: localStorage.getItem('useSoundEffects') !== 'false',
  useChineseSpeechRecognition: localStorage.getItem('useChineseSpeechRecognition') !== 'false',
  useEnglishSpeechRecognition: localStorage.getItem('useEnglishSpeechRecognition') !== 'false',
  useAutoRecord: localStorage.getItem('useAutoRecord') !== 'false',
  useFlashcards: localStorage.getItem('useFlashcards') !== 'false',
});

export const setAudioSetting = (key: keyof AudioSettings, value: boolean): AudioSettings => {
  localStorage.setItem(key, String(value));

  return getAudioSettings();
};

export interface AudioSettingItem {
  key: keyof AudioSettings;
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
    key: 'useChineseSpeechRecognition',
    label: 'Chinese speech recognition',
    disabled: !speechAvailable,
  },
  {
    key: 'useEnglishSpeechRecognition',
    label: 'English speech recognition',
    disabled: !speechAvailable,
  },
  {
    key: 'useAutoRecord',
    label: 'Automatic recording',
    disabled: false,
  },
];
