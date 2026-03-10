/**
 * Tests for the settings reducer — covers all action cases including
 * SET_VOICE and SET_LANG which were previously untested.
 */
import { describe, it, expect } from 'vitest';
import reducer from './settings';
import type { SettingsState } from '../../types/store';

const initialState: SettingsState = {
  speechAvailable: true,
  synthAvailable: true,
};

describe('settings reducer', () => {
  describe('default / unknown action', () => {
    it('returns initial state when called with undefined state', () => {
      const state = reducer(undefined, { type: '@@INIT' } as any);
      expect(state).toEqual(initialState);
    });

    it('returns existing state for unknown action type', () => {
      const existing: SettingsState = { ...initialState, speechAvailable: false };
      const state = reducer(existing, { type: 'UNKNOWN' } as any);
      expect(state).toEqual(existing);
    });
  });

  describe('SET_SPEECH_AVAILABLE', () => {
    it('sets speechAvailable to false', () => {
      const state = reducer(initialState, { type: 'SET_SPEECH_AVAILABLE', available: false });
      expect(state.speechAvailable).toBe(false);
      expect(state.synthAvailable).toBe(true);
    });

    it('sets speechAvailable to true', () => {
      const base: SettingsState = { ...initialState, speechAvailable: false };
      const state = reducer(base, { type: 'SET_SPEECH_AVAILABLE', available: true });
      expect(state.speechAvailable).toBe(true);
    });
  });

  describe('SET_SYNTH_AVAILABLE', () => {
    it('sets synthAvailable to false', () => {
      const state = reducer(initialState, { type: 'SET_SYNTH_AVAILABLE', available: false });
      expect(state.synthAvailable).toBe(false);
      expect(state.speechAvailable).toBe(true);
    });

    it('sets synthAvailable to true', () => {
      const base: SettingsState = { ...initialState, synthAvailable: false };
      const state = reducer(base, { type: 'SET_SYNTH_AVAILABLE', available: true });
      expect(state.synthAvailable).toBe(true);
    });
  });

  describe('SET_VOICE', () => {
    it('stores the selected voice', () => {
      const mockVoice = { name: 'Google Chinese', lang: 'zh-CN' } as SpeechSynthesisVoice;
      const state = reducer(initialState, { type: 'SET_VOICE', voice: mockVoice });
      expect(state.voice).toBe(mockVoice);
    });

    it('replaces a previously stored voice', () => {
      const firstVoice = { name: 'Voice A', lang: 'zh-CN' } as SpeechSynthesisVoice;
      const secondVoice = { name: 'Voice B', lang: 'zh-TW' } as SpeechSynthesisVoice;
      const withFirst = reducer(initialState, { type: 'SET_VOICE', voice: firstVoice });
      const withSecond = reducer(withFirst, { type: 'SET_VOICE', voice: secondVoice });
      expect(withSecond.voice).toBe(secondVoice);
    });

    it('does not mutate speechAvailable or synthAvailable', () => {
      const mockVoice = { name: 'Test Voice', lang: 'zh-CN' } as SpeechSynthesisVoice;
      const state = reducer(
        { speechAvailable: false, synthAvailable: false },
        { type: 'SET_VOICE', voice: mockVoice },
      );
      expect(state.speechAvailable).toBe(false);
      expect(state.synthAvailable).toBe(false);
    });
  });

  describe('SET_LANG', () => {
    it('stores the selected language code', () => {
      const state = reducer(initialState, { type: 'SET_LANG', lang: 'zh-TW' });
      expect(state.lang).toBe('zh-TW');
    });

    it('replaces a previously stored language', () => {
      const withFirst = reducer(initialState, { type: 'SET_LANG', lang: 'zh-CN' });
      const withSecond = reducer(withFirst, { type: 'SET_LANG', lang: 'zh-TW' });
      expect(withSecond.lang).toBe('zh-TW');
    });

    it('does not mutate speechAvailable or synthAvailable', () => {
      const state = reducer(
        { speechAvailable: false, synthAvailable: false },
        { type: 'SET_LANG', lang: 'zh-CN' },
      );
      expect(state.speechAvailable).toBe(false);
      expect(state.synthAvailable).toBe(false);
    });
  });
});
