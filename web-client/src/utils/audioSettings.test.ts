import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAudioSettings, setAudioSetting, getAudioSettingItems } from './audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAudioSettings', () => {
    it('returns all true by default (no localStorage values)', () => {
      const settings = getAudioSettings();
      expect(settings).toEqual({
        useSound: true,
        useSoundEffects: true,
        useChineseSpeechRecognition: true,
        useEnglishSpeechRecognition: true,
        useAutoRecord: true,
        useFlashcards: true,
      });
    });

    it('returns false for settings explicitly set to false', () => {
      localStorage.setItem('useSound', 'false');
      localStorage.setItem('useAutoRecord', 'false');
      const settings = getAudioSettings();
      expect(settings.useSound).toBe(false);
      expect(settings.useAutoRecord).toBe(false);
      expect(settings.useChineseSpeechRecognition).toBe(true);
    });

    it('returns true for settings set to true', () => {
      localStorage.setItem('useSound', 'true');
      const settings = getAudioSettings();
      expect(settings.useSound).toBe(true);
    });
  });

  describe('setAudioSetting', () => {
    it('writes value to localStorage and returns updated settings', () => {
      const result = setAudioSetting('useSound', false);
      expect(localStorage.getItem('useSound')).toBe('false');
      expect(result.useSound).toBe(false);
    });

    it('leaves speech recognition settings untouched when changing flashcards', () => {
      localStorage.setItem('useEnglishSpeechRecognition', 'true');
      localStorage.setItem('useChineseSpeechRecognition', 'true');
      const result = setAudioSetting('useFlashcards', true);
      expect(result.useFlashcards).toBe(true);
      expect(result.useEnglishSpeechRecognition).toBe(true);
      expect(result.useChineseSpeechRecognition).toBe(true);
    });

    it('leaves flashcards untouched when changing English speech recognition', () => {
      localStorage.setItem('useFlashcards', 'true');
      const result = setAudioSetting('useEnglishSpeechRecognition', true);
      expect(result.useEnglishSpeechRecognition).toBe(true);
      expect(result.useFlashcards).toBe(true);
      expect(localStorage.getItem('useFlashcards')).toBe('true');
    });
  });

  describe('getAudioSettingItems', () => {
    it('returns 5 items (quiz type is rendered separately)', () => {
      const items = getAudioSettingItems(true, true);
      expect(items).toHaveLength(5);
      expect(items.find((i) => i.key === 'useFlashcards')).toBeUndefined();
    });

    it('disables sound when synthAvailable is false', () => {
      const items = getAudioSettingItems(true, false);
      const sound = items.find((i) => i.key === 'useSound');
      expect(sound?.disabled).toBe(true);
    });

    it('disables speech recognition when speechAvailable is false', () => {
      const items = getAudioSettingItems(false, true);
      const chinese = items.find((i) => i.key === 'useChineseSpeechRecognition');
      const english = items.find((i) => i.key === 'useEnglishSpeechRecognition');
      expect(chinese?.disabled).toBe(true);
      expect(english?.disabled).toBe(true);
    });

    it('does not disable autoRecord based on availability', () => {
      const items = getAudioSettingItems(false, false);
      const auto = items.find((i) => i.key === 'useAutoRecord');
      expect(auto?.disabled).toBe(false);
    });
  });
});
