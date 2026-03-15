import { searchWord } from './dictionaryService';

const LOCAL_CACHE_KEY = 'chengyuCharMeaningsCache';

interface CharMeaningCache {
  key: string;
  results: { char: string; meaning: string }[];
}

function getLocalCachedMeanings(
  chars: string[],
  charSet: string,
): { char: string; meaning: string }[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as CharMeaningCache;
    const key = `${chars.join('')}:${charSet}`;
    if (cache.key === key) return cache.results;
  } catch {
    // Corrupted cache — ignore
  }
  return null;
}

function setLocalCachedMeanings(
  chars: string[],
  charSet: string,
  results: { char: string; meaning: string }[],
): void {
  try {
    const key = `${chars.join('')}:${charSet}`;
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ key, results }));
  } catch {
    // Storage full or unavailable — not critical
  }
}

/**
 * Look up meanings for each character in a chengyu.
 * Results are cached in localStorage to avoid repeated Cloud Function calls.
 */
export async function lookupCharacterMeanings(
  chars: string[],
  charSet: 'simp' | 'trad' = 'simp',
): Promise<{ char: string; meaning: string }[]> {
  const cached = getLocalCachedMeanings(chars, charSet);
  if (cached) return cached;

  const results = await Promise.all(
    chars.map(async (char) => {
      try {
        const wordResults = await searchWord(char, charSet);
        // Get the first meaning if available
        const meaning = wordResults.length > 0 ? wordResults[0].meaning : '';
        return { char, meaning };
      } catch (error) {
        console.error(`Failed to lookup character ${char}:`, error);
        return { char, meaning: '' };
      }
    }),
  );

  // Only cache if we got at least some meanings
  if (results.some((r) => r.meaning !== '')) {
    setLocalCachedMeanings(chars, charSet, results);
  }

  return results;
}
