import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockCallable, MockHowl } = vi.hoisted(() => {
  const mockCallable = vi.fn();
  const MockHowl = vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    stop: vi.fn(),
  }));
  return { mockCallable, MockHowl };
});

vi.mock('howler', () => ({
  Howl: MockHowl,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../firebase/config', () => ({
  functions: {},
}));

import { speak, stopAll, prefetch } from './ttsService';

beforeEach(() => {
  vi.clearAllMocks();

  // jsdom doesn't have URL.createObjectURL/revokeObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as SpeechSynthesis;
  global.SpeechSynthesisUtterance = class {
    lang = '';
    voice = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    constructor(public text: string) {}
  } as unknown as typeof SpeechSynthesisUtterance;
});

describe('ttsService', () => {
  describe('speak', () => {
    it('returns a handle with play and stop methods', () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('fake-audio') } });
      const handle = speak('handle-test');
      expect(handle).toHaveProperty('play');
      expect(handle).toHaveProperty('stop');
    });

    it('falls back to native SpeechSynthesis when cloud function fails', async () => {
      mockCallable.mockRejectedValue(new Error('Network error'));

      speak('fallback-test', { fallbackLang: 'zh-CN' });

      await vi.waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
      });
    });

    it('creates a Howl instance when cloud function succeeds', async () => {
      const fakeAudio = btoa('fake-mp3-data');
      mockCallable.mockResolvedValue({ data: { audioContent: fakeAudio } });

      speak('howl-create-test');

      await vi.waitFor(() => {
        expect(MockHowl).toHaveBeenCalled();
      });

      // Verify the Howl was created with an MP3 source
      const howlCall = MockHowl.mock.calls[0][0];
      expect(howlCall.format).toEqual(['mp3']);
    });

    it('calls stop on the handle to cancel playback', () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('data') } });
      const handle = speak('stop-test');
      handle.stop();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('passes speed option to the cloud function', () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('data') } });
      speak('speed-test', { speed: 0.8 });
      expect(mockCallable).toHaveBeenCalledWith({ text: 'speed-test', speed: 0.8 });
    });
  });

  describe('stopAll', () => {
    it('cancels native speech synthesis', () => {
      stopAll();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('prefetch', () => {
    it('calls the cloud function without creating Howl', async () => {
      const fakeAudio = btoa('fake-mp3-data');
      mockCallable.mockResolvedValue({ data: { audioContent: fakeAudio } });

      prefetch('预取');

      await vi.waitFor(() => {
        expect(mockCallable).toHaveBeenCalledWith({ text: '预取' });
      });
      // Prefetch should not create a Howl (no playback)
      expect(MockHowl).not.toHaveBeenCalled();
    });

    it('silently ignores errors', async () => {
      mockCallable.mockRejectedValue(new Error('Network error'));
      expect(() => prefetch('失败')).not.toThrow();
    });
  });
});
