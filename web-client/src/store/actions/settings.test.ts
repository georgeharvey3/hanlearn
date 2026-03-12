/**
 * Tests for settings action creators — covers all four creators including
 * setVoice and setLang which were previously untested.
 */
import { describe, it, expect } from 'vitest';
import { setSpeechAvailable, setSynthAvailable, setVoice, setLang } from './settings';

describe('settings action creators', () => {
  describe('setSpeechAvailable', () => {
    it('creates SET_SPEECH_AVAILABLE action with available=true', () => {
      const action = setSpeechAvailable(true);
      expect(action.type).toBe('SET_SPEECH_AVAILABLE');
      expect(action.available).toBe(true);
    });

    it('creates SET_SPEECH_AVAILABLE action with available=false', () => {
      const action = setSpeechAvailable(false);
      expect(action.type).toBe('SET_SPEECH_AVAILABLE');
      expect(action.available).toBe(false);
    });
  });

  describe('setSynthAvailable', () => {
    it('creates SET_SYNTH_AVAILABLE action with available=true', () => {
      const action = setSynthAvailable(true);
      expect(action.type).toBe('SET_SYNTH_AVAILABLE');
      expect(action.available).toBe(true);
    });

    it('creates SET_SYNTH_AVAILABLE action with available=false', () => {
      const action = setSynthAvailable(false);
      expect(action.type).toBe('SET_SYNTH_AVAILABLE');
      expect(action.available).toBe(false);
    });
  });

  describe('setVoice', () => {
    it('creates SET_VOICE action with the provided voice', () => {
      const mockVoice = {
        name: 'Google 普通话（中国大陆）',
        lang: 'zh-CN',
      } as SpeechSynthesisVoice;
      const action = setVoice(mockVoice);
      expect(action.type).toBe('SET_VOICE');
      expect(action.voice).toBe(mockVoice);
    });

    it('preserves the exact voice object reference', () => {
      const mockVoice = { name: 'Voice A', lang: 'zh-TW' } as SpeechSynthesisVoice;
      const action = setVoice(mockVoice);
      expect(action.voice).toBe(mockVoice);
    });
  });

  describe('setLang', () => {
    it('creates SET_LANG action with zh-CN', () => {
      const action = setLang('zh-CN');
      expect(action.type).toBe('SET_LANG');
      expect(action.lang).toBe('zh-CN');
    });

    it('creates SET_LANG action with zh-TW', () => {
      const action = setLang('zh-TW');
      expect(action.type).toBe('SET_LANG');
      expect(action.lang).toBe('zh-TW');
    });
  });
});
