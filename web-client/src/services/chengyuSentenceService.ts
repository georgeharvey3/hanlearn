import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Converter } from 'opencc-js';

import { db, functions } from '../firebase/config';

let _toTraditional: ((text: string) => string) | null = null;
function getToTraditional(): (text: string) => string {
  if (!_toTraditional) {
    _toTraditional = Converter({ from: 'cn', to: 'tw' });
  }
  return _toTraditional;
}

export interface ChengyuSentence {
  chinese: string;
  pinyin: string;
  english: string;
}

const LOCAL_CACHE_KEY = 'chengyuSentenceCache';

function getLocalCachedSentence(chengyu: string): ChengyuSentence | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as { chengyu: string; sentence: ChengyuSentence };
    if (cache.chengyu === chengyu) return cache.sentence;
  } catch {
    // Corrupted cache — ignore
  }
  return null;
}

function setLocalCachedSentence(chengyu: string, sentence: ChengyuSentence): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ chengyu, sentence }));
  } catch {
    // Storage full or unavailable — not critical
  }
}

function applyCharSet(sentence: ChengyuSentence, charSet: 'simp' | 'trad'): ChengyuSentence {
  if (charSet === 'trad') {
    return {
      chinese: getToTraditional()(sentence.chinese),
      pinyin: sentence.pinyin,
      english: sentence.english,
    };
  }
  return sentence;
}

async function generateChengyuSentenceViaFunction(
  chengyu: string,
): Promise<ChengyuSentence | null> {
  const callable = httpsCallable<
    { chengyu: string },
    { sentence: ChengyuSentence | null }
  >(functions, 'generateChengyuSentence');
  const result = await callable({ chengyu });
  return result.data.sentence;
}

export async function getChengyuExampleSentence(
  chengyu: string,
  charSet: 'simp' | 'trad',
): Promise<ChengyuSentence | null> {
  // Check localStorage first to avoid any network calls on repeated views
  const localCached = getLocalCachedSentence(chengyu);
  if (localCached) {
    return applyCharSet(localCached, charSet);
  }

  // Check Firestore cache (public read — works without auth)
  const cacheRef = doc(db, 'chengyuSentences', chengyu);

  try {
    const cached = await getDoc(cacheRef);
    if (cached.exists()) {
      const data = cached.data().sentence as ChengyuSentence;
      setLocalCachedSentence(chengyu, data);
      return applyCharSet(data, charSet);
    }
  } catch {
    // Cache read unavailable — fall through to Cloud Function
  }

  // Generate via Cloud Function (requires auth, handles AI + caching server-side)
  let sentence: ChengyuSentence | null;
  try {
    sentence = await generateChengyuSentenceViaFunction(chengyu);
  } catch {
    return null;
  }

  if (sentence) {
    setLocalCachedSentence(chengyu, sentence);
    return applyCharSet(sentence, charSet);
  }

  return sentence;
}
