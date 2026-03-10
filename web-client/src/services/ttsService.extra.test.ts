/**
 * Additional ttsService tests covering:
 * - Cache hit path (speak returns cached blob URL without cloud call)
 * - stop() called before cloud response arrives (stopped flag)
 * - playFromBlobUrl Howl event handlers (onloaderror, onplayerror, onend, onplay)
 * - speakWithNativeFallback onerror when synthesis-failed
 * - speakWithNativeFallback with fallbackVoice, onStart, onEnd callbacks
 * - stopAll() when a Howl is active
 * - prefetch skips if text already cached
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use a regular function (not arrow) so `new MockHowl()` works correctly.
// Use a shared ref object so tests can access the last Howl constructor args/instance.
const { mockCallable, MockHowl, lastHowl } = vi.hoisted(() => {
  const mockCallable = vi.fn();
  const lastHowl: { opts: Record<string, unknown>; instance: { play: unknown; stop: unknown } } = {
    opts: {},
    instance: { play: () => {}, stop: () => {} },
  };
  function MockHowlFn(this: unknown, opts: Record<string, unknown>) {
    const instance = { play: vi.fn(), stop: vi.fn() };
    lastHowl.opts = opts;
    lastHowl.instance = instance;
    return instance;
  }
  const MockHowl = vi.fn(MockHowlFn);
  return { mockCallable, MockHowl, lastHowl };
});

vi.mock('howler', () => ({ Howl: MockHowl }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mockCallable) }));
vi.mock('../firebase/config', () => ({ functions: {} }));

import { speak, stopAll, prefetch } from './ttsService';

type HowlEventOpts = {
  onplay?: () => void;
  onend?: () => void;
  onloaderror?: () => void;
  onplayerror?: () => void;
};

function getLastHowlOpts(): HowlEventOpts {
  return lastHowl.opts as HowlEventOpts;
}

function getLastHowlInstance(): { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } {
  return lastHowl.instance as { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.clearAllMocks();

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
    voice: SpeechSynthesisVoice | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    constructor(public text: string) {}
  } as unknown as typeof SpeechSynthesisUtterance;
});

describe('ttsService (extra coverage)', () => {
  describe('speak — cache hit path', () => {
    it('plays from cache without calling the cloud function on the second call', async () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('fake-mp3') } });

      speak('缓存命中一');
      await vi.waitFor(() => expect(MockHowl).toHaveBeenCalledTimes(1));

      vi.clearAllMocks();

      speak('缓存命中一');

      // Cache hit: Howl created immediately from cache, no cloud call
      expect(mockCallable).not.toHaveBeenCalled();
      expect(MockHowl).toHaveBeenCalledTimes(1);
    });
  });

  describe('speak — stopped before cloud response', () => {
    it('does not create a Howl when stop() is called before cloud function resolves', async () => {
      let resolveCall!: (v: { data: { audioContent: string } }) => void;
      mockCallable.mockReturnValue(
        new Promise<{ data: { audioContent: string } }>((res) => (resolveCall = res)),
      );

      const handle = speak('停止后不播放');
      handle.stop();

      resolveCall({ data: { audioContent: btoa('audio') } });
      await new Promise((r) => setTimeout(r, 0));

      expect(MockHowl).not.toHaveBeenCalled();
    });

    it('does not fall back to native when stop() is called before cloud fails', async () => {
      let rejectCall!: (e: Error) => void;
      mockCallable.mockReturnValue(new Promise<never>((_res, rej) => (rejectCall = rej)));

      const handle = speak('提前停止回退');
      handle.stop();

      rejectCall(new Error('network'));
      await new Promise((r) => setTimeout(r, 0));

      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });
  });

  describe('playFromBlobUrl — Howl event callbacks', () => {
    async function speakAndWaitForHowl(text: string, options: Record<string, unknown> = {}) {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('audio-data') } });
      speak(text, options);
      await vi.waitFor(() => expect(MockHowl).toHaveBeenCalled());
    }

    it('calls onError("Error loading audio") when Howl fires onloaderror', async () => {
      const onError = vi.fn();
      await speakAndWaitForHowl('加载错误触发', { onError });
      getLastHowlOpts().onloaderror?.();
      expect(onError).toHaveBeenCalledWith('Error loading audio');
    });

    it('calls onError("Error playing audio") when Howl fires onplayerror', async () => {
      const onError = vi.fn();
      await speakAndWaitForHowl('播放错误触发', { onError });
      getLastHowlOpts().onplayerror?.();
      expect(onError).toHaveBeenCalledWith('Error playing audio');
    });

    it('calls onEnd when Howl fires onend', async () => {
      const onEnd = vi.fn();
      await speakAndWaitForHowl('结束回调触发', { onEnd });
      getLastHowlOpts().onend?.();
      expect(onEnd).toHaveBeenCalled();
    });

    it('calls onStart when Howl fires onplay', async () => {
      const onStart = vi.fn();
      await speakAndWaitForHowl('开始回调触发', { onStart });
      getLastHowlOpts().onplay?.();
      expect(onStart).toHaveBeenCalled();
    });
  });

  describe('speakWithNativeFallback — callbacks and error handling', () => {
    async function speakAndWaitForNative(text: string, options: Record<string, unknown> = {}) {
      mockCallable.mockRejectedValue(new Error('cloud failed'));
      speak(text, options);
      await vi.waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalled());
      return (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        onerror: ((e: { error: string }) => void) | null;
        onstart: (() => void) | null;
        onend: (() => void) | null;
        voice: SpeechSynthesisVoice | null;
      };
    }

    it('calls onError("Error playing pinyin") when utterance fires synthesis-failed', async () => {
      const onError = vi.fn();
      const utterance = await speakAndWaitForNative('合成失败', { onError });
      utterance.onerror?.({ error: 'synthesis-failed' });
      expect(onError).toHaveBeenCalledWith('Error playing pinyin');
    });

    it('does not call onError for non-synthesis-failed utterance errors', async () => {
      const onError = vi.fn();
      const utterance = await speakAndWaitForNative('其他错误', { onError });
      utterance.onerror?.({ error: 'audio-busy' });
      expect(onError).not.toHaveBeenCalled();
    });

    it('sets voice on utterance when fallbackVoice is provided', async () => {
      const mockVoice = { name: 'Test Voice', lang: 'zh-CN' } as SpeechSynthesisVoice;
      const utterance = await speakAndWaitForNative('备用语音', { fallbackVoice: mockVoice });
      expect(utterance.voice).toBe(mockVoice);
    });

    it('calls onStart when utterance fires onstart', async () => {
      const onStart = vi.fn();
      const utterance = await speakAndWaitForNative('开始', { onStart });
      utterance.onstart?.();
      expect(onStart).toHaveBeenCalled();
    });

    it('calls onEnd when utterance fires onend', async () => {
      const onEnd = vi.fn();
      const utterance = await speakAndWaitForNative('结束', { onEnd });
      utterance.onend?.();
      expect(onEnd).toHaveBeenCalled();
    });
  });

  describe('stopAll — with active Howl', () => {
    it('stops the active Howl instance when stopAll is called', async () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('stopall-data') } });

      speak('停止全部测试');
      await vi.waitFor(() => expect(MockHowl).toHaveBeenCalled());

      const instance = getLastHowlInstance();
      stopAll();

      expect(instance.stop).toHaveBeenCalled();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('prefetch — skip if already cached', () => {
    it('does not call the cloud function when text is already in the cache', async () => {
      mockCallable.mockResolvedValue({ data: { audioContent: btoa('prefetch-cached') } });

      prefetch('预取缓存测试');
      await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));

      vi.clearAllMocks();
      prefetch('预取缓存测试');

      expect(mockCallable).not.toHaveBeenCalled();
    });
  });
});
