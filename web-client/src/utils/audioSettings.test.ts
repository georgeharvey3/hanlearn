import { describe, it, expect, beforeEach } from 'vitest';
import { getAudioSettings, setAudioSetting, getQuizType, setQuizType } from './audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAudioSettings', () => {
    it('returns defaults when localStorage is empty', () => {
      const settings = getAudioSettings();
      expect(settings).toEqual({
        useSound: true,
        useSoundEffects: true,
        useAutoRecord: true,
        meaningQuizType: 'flashcard',
        pinyinQuizType: 'input',
      });
    });

    it('returns false for settings explicitly set to false', () => {
      localStorage.setItem('useSound', 'false');
      localStorage.setItem('useAutoRecord', 'false');
      const settings = getAudioSettings();
      expect(settings.useSound).toBe(false);
      expect(settings.useAutoRecord).toBe(false);
      expect(settings.useSoundEffects).toBe(true);
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

    it('leaves quiz types untouched when changing audio settings', () => {
      setQuizType('meaning', 'input');
      const result = setAudioSetting('useSound', false);
      expect(result.meaningQuizType).toBe('input');
    });
  });

  describe('getQuizType / setQuizType', () => {
    it('round-trips a stored quiz type', () => {
      setQuizType('meaning', 'input');
      setQuizType('pinyin', 'flashcard');
      expect(getQuizType('meaning')).toBe('input');
      expect(getQuizType('pinyin')).toBe('flashcard');
      expect(localStorage.getItem('meaningQuizType')).toBe('input');
      expect(localStorage.getItem('pinyinQuizType')).toBe('flashcard');
    });

    it('ignores invalid stored values and falls back to defaults', () => {
      localStorage.setItem('meaningQuizType', 'bogus');
      localStorage.setItem('pinyinQuizType', 'bogus');
      expect(getQuizType('meaning')).toBe('flashcard');
      expect(getQuizType('pinyin')).toBe('input');
    });

    it('defaults meaning to flashcard and pinyin to input', () => {
      expect(getQuizType('meaning')).toBe('flashcard');
      expect(getQuizType('pinyin')).toBe('input');
    });

    it('maps the legacy text and speech values to input', () => {
      localStorage.setItem('meaningQuizType', 'text');
      localStorage.setItem('pinyinQuizType', 'speech');
      expect(getQuizType('meaning')).toBe('input');
      expect(getQuizType('pinyin')).toBe('input');
    });

    it('maps legacy useFlashcards=false to meaning=input', () => {
      localStorage.setItem('useFlashcards', 'false');
      expect(getQuizType('meaning')).toBe('input');
    });

    it('prefers the new key over legacy settings', () => {
      localStorage.setItem('useFlashcards', 'false');
      setQuizType('meaning', 'flashcard');
      expect(getQuizType('meaning')).toBe('flashcard');
    });
  });
});
