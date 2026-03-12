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

    it('disables flashcards when enabling English speech recognition', () => {
      localStorage.setItem('useFlashcards', 'true');
      const result = setAudioSetting('useEnglishSpeechRecognition', true);
      expect(result.useEnglishSpeechRecognition).toBe(true);
      expect(result.useFlashcards).toBe(false);
      expect(localStorage.getItem('useFlashcards')).toBe('false');
    });

    it('disables English speech recognition when enabling flashcards', () => {
      localStorage.setItem('useEnglishSpeechRecognition', 'true');
      const result = setAudioSetting('useFlashcards', true);
      expect(result.useFlashcards).toBe(true);
      expect(result.useEnglishSpeechRecognition).toBe(false);
      expect(localStorage.getItem('useEnglishSpeechRecognition')).toBe('false');
    });

    it('does not trigger mutual exclusivity when disabling', () => {
      localStorage.setItem('useFlashcards', 'true');
      localStorage.setItem('useEnglishSpeechRecognition', 'true');
      const result = setAudioSetting('useEnglishSpeechRecognition', false);
      expect(result.useEnglishSpeechRecognition).toBe(false);
      expect(result.useFlashcards).toBe(true);
    });
  });

  describe('getAudioSettingItems', () => {
    it('returns 6 items', () => {
      const items = getAudioSettingItems(true, true);
      expect(items).toHaveLength(6);
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

    it('does not disable autoRecord or flashcards based on availability', () => {
      const items = getAudioSettingItems(false, false);
      const auto = items.find((i) => i.key === 'useAutoRecord');
      const flash = items.find((i) => i.key === 'useFlashcards');
      expect(auto?.disabled).toBe(false);
      expect(flash?.disabled).toBe(false);
    });
  });
});
