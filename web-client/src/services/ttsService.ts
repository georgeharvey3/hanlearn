import { Howl } from 'howler';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { reportError } from './errorReporting';

const MAX_CACHE_SIZE = 200;

const cache = new Map<string, string>();

const textToSpeechFn = httpsCallable<{ text: string; speed?: number }, { audioContent: string }>(
  functions,
  'textToSpeech',
);

function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      const url = cache.get(firstKey);
      if (url) URL.revokeObjectURL(url);
      cache.delete(firstKey);
    }
  }
}

/**
 * The Cloud calls in flight, by cache key. A play that comes while a prefetch
 * of the same text is in flight waits for that call and makes no second one
 * (#576). A call leaves the map when it settles, so a failed call is not kept.
 */
const pending = new Map<string, Promise<string>>();

function cacheKeyOf(text: string, speed?: number): string {
  // Include speed in cache key so different speeds are cached separately
  return speed !== undefined && speed !== 1.0 ? `${text}::speed=${speed}` : text;
}

function fetchAudio(text: string, speed?: number): Promise<string> {
  const key = cacheKeyOf(text, speed);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const call = textToSpeechFn({ text, speed })
    .then((result) => {
      const blobUrl = base64ToBlobUrl(result.data.audioContent);
      evictIfNeeded();
      cache.set(key, blobUrl);
      return blobUrl;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, call);
  return call;
}

function base64ToBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
}

let currentHowl: Howl | null = null;
let _googleTtsAvailable: boolean | null = null;

export function isGoogleTtsAvailable(): boolean | null {
  return _googleTtsAvailable;
}

export interface TtsHandle {
  play: () => void;
  stop: () => void;
}

interface SpeakOptions {
  speed?: number;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: (error: string) => void;
  fallbackVoice?: SpeechSynthesisVoice;
  fallbackLang?: string;
}

/**
 * How long the native voice has to start before the call counts as failed.
 *
 * iOS Safari speaks only in reply to a tap, and outside one it neither speaks
 * nor fires an error. The fallback runs after a failed Cloud call, so it is
 * often outside a tap, and the caller's spinner then waited forever with its
 * play button disabled (JAVASCRIPT-REACT-6).
 */
export const NATIVE_START_TIMEOUT_MS = 3000;

let nativeStartTimer: ReturnType<typeof setTimeout> | null = null;

function clearNativeStartTimer(): void {
  if (nativeStartTimer !== null) {
    clearTimeout(nativeStartTimer);
    nativeStartTimer = null;
  }
}

function speakWithNativeFallback(text: string, options: SpeakOptions): TtsHandle {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.fallbackLang || 'zh-CN';
  if (options.speed !== undefined) {
    utterance.rate = options.speed;
  }
  if (options.fallbackVoice) {
    utterance.voice = options.fallbackVoice;
  }
  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    clearNativeStartTimer();
    options.onError?.('Error playing pinyin');
  };
  utterance.onstart = () => {
    settled = true;
    clearNativeStartTimer();
    options.onStart?.();
  };
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = (e) => {
    // 'interrupted' and 'canceled' come from our own synth.cancel(), when the
    // next question or the next play stops this one: not a failure.
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    fail();
  };

  return {
    play: () => {
      synth.cancel();
      clearNativeStartTimer();
      synth.speak(utterance);
      nativeStartTimer = setTimeout(() => {
        nativeStartTimer = null;
        if (settled) return;
        synth.cancel();
        fail();
      }, NATIVE_START_TIMEOUT_MS);
    },
    stop: () => {
      settled = true;
      clearNativeStartTimer();
      synth.cancel();
    },
  };
}

function playFromBlobUrl(blobUrl: string, options: SpeakOptions): TtsHandle {
  if (currentHowl) {
    currentHowl.stop();
  }
  const howl = new Howl({
    src: [blobUrl],
    format: ['mp3'],
    onplay: () => options.onStart?.(),
    onend: () => {
      currentHowl = null;
      options.onEnd?.();
    },
    onloaderror: () => {
      currentHowl = null;
      options.onError?.('Error loading audio');
    },
    onplayerror: () => {
      currentHowl = null;
      options.onError?.('Error playing audio');
    },
  });
  currentHowl = howl;

  return {
    play: () => howl.play(),
    stop: () => {
      howl.stop();
      currentHowl = null;
    },
  };
}

export function speak(text: string, options: SpeakOptions = {}): TtsHandle {
  // Check cache first
  const cached = cache.get(cacheKeyOf(text, options.speed));
  if (cached) {
    options.onStart?.();
    const handle = playFromBlobUrl(cached, options);
    handle.play();
    return handle;
  }

  // Attempt Cloud TTS, fall back to native on failure
  let stopped = false;
  let activeHandle: TtsHandle | null = null;

  // One retry: the Cloud call fails now and then with `internal`, and a second
  // try usually succeeds, while the native fallback may not speak at all.
  fetchAudio(text, options.speed)
    .catch((error) => {
      if (stopped) throw error;
      return fetchAudio(text, options.speed);
    })
    .then((blobUrl) => {
      if (stopped) return;

      _googleTtsAvailable = true;

      options.onStart?.();
      const handle = playFromBlobUrl(blobUrl, options);
      activeHandle = handle;
      handle.play();
    })
    .catch((error) => {
      if (stopped) return;

      // The fallback is silent to the user, and it lasts for the rest of the
      // session, so an outage of Google TTS has to raise an event.
      reportError(error, {
        feature: 'tts',
        context: { textLength: text.length, fallback: 'native-speech-synthesis' },
      });

      _googleTtsAvailable = false;
      // Fall back to native SpeechSynthesis
      const handle = speakWithNativeFallback(text, options);
      activeHandle = handle;
      handle.play();
    });

  return {
    play: () => activeHandle?.play(),
    stop: () => {
      stopped = true;
      clearNativeStartTimer();
      activeHandle?.stop();
      if (currentHowl) {
        currentHowl.stop();
        currentHowl = null;
      }
      window.speechSynthesis.cancel();
    },
  };
}

/** Fetch the audio of a text into the cache, with no play. */
export function prefetch(text: string, speed?: number): void {
  if (cache.has(cacheKeyOf(text, speed))) return;

  fetchAudio(text, speed).catch(() => {
    // Prefetch failures are non-critical
  });
}

export function stopAll(): void {
  clearNativeStartTimer();
  if (currentHowl) {
    currentHowl.stop();
    currentHowl = null;
  }
  window.speechSynthesis.cancel();
}
