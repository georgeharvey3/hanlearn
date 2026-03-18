import { Howl } from 'howler';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

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
  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = (e) => {
    if (e.error === 'synthesis-failed') {
      options.onError?.('Error playing pinyin');
    }
  };

  return {
    play: () => {
      synth.cancel();
      synth.speak(utterance);
    },
    stop: () => {
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
  // Include speed in cache key so different speeds are cached separately
  const cacheKey =
    options.speed !== undefined && options.speed !== 1.0 ? `${text}::speed=${options.speed}` : text;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    const handle = playFromBlobUrl(cached, options);
    handle.play();
    return handle;
  }

  // Attempt Cloud TTS, fall back to native on failure
  let stopped = false;
  let activeHandle: TtsHandle | null = null;

  textToSpeechFn({ text, speed: options.speed })
    .then((result) => {
      if (stopped) return;

      _googleTtsAvailable = true;
      const blobUrl = base64ToBlobUrl(result.data.audioContent);
      evictIfNeeded();
      cache.set(cacheKey, blobUrl);

      const handle = playFromBlobUrl(blobUrl, options);
      activeHandle = handle;
      handle.play();
    })
    .catch(() => {
      if (stopped) return;

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
      activeHandle?.stop();
      if (currentHowl) {
        currentHowl.stop();
        currentHowl = null;
      }
      window.speechSynthesis.cancel();
    },
  };
}

export function prefetch(text: string): void {
  if (cache.has(text)) return;

  textToSpeechFn({ text })
    .then((result) => {
      const blobUrl = base64ToBlobUrl(result.data.audioContent);
      evictIfNeeded();
      cache.set(text, blobUrl);
    })
    .catch(() => {
      // Prefetch failures are non-critical
    });
}

export function stopAll(): void {
  if (currentHowl) {
    currentHowl.stop();
    currentHowl = null;
  }
  window.speechSynthesis.cancel();
}
