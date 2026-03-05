/**
 * Static dictionary service that loads CC-CEDICT from a JSON file.
 *
 * This eliminates Firestore costs by serving the dictionary as a static file.
 * The dictionary is lazily loaded on first use and indexed in memory.
 */

import { Word } from '../types/models';

interface DictionaryEntry {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

// In-memory dictionary state
let dictionaryLoaded = false;
let loadingPromise: Promise<void> | null = null;
let entries: DictionaryEntry[] = [];
const simpIndex: Map<string, DictionaryEntry[]> = new Map();
const tradIndex: Map<string, DictionaryEntry[]> = new Map();

/**
 * Load the dictionary from the static JSON file.
 * This is called lazily on first search.
 */
async function loadDictionary(): Promise<void> {
  if (dictionaryLoaded) return;

  // Prevent multiple simultaneous loads
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('Loading dictionary...');
    try {
      const response = await fetch('/dictionary.json');

      if (!response.ok) {
        throw new Error(`Failed to load dictionary: ${response.status}`);
      }

      entries = await response.json();

      // Build indexes for fast lookups
      for (const entry of entries) {
        // Index by simplified character
        if (!simpIndex.has(entry.simp)) {
          simpIndex.set(entry.simp, []);
        }
        simpIndex.get(entry.simp)!.push(entry);

        // Index by traditional character
        if (!tradIndex.has(entry.trad)) {
          tradIndex.set(entry.trad, []);
        }
        tradIndex.get(entry.trad)!.push(entry);
      }

      dictionaryLoaded = true;
      console.log(`Dictionary loaded: ${entries.length} entries`);
    } catch (error) {
      // Reset so subsequent calls can retry instead of returning the rejected promise forever
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Search for words by exact character match.
 * Tries the selected charSet index first, falls back to the other index
 * so searches work regardless of whether the user typed simplified or traditional.
 */
export async function searchWord(character: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  await loadDictionary();

  const primaryIndex = charSet === 'simp' ? simpIndex : tradIndex;
  const fallbackIndex = charSet === 'simp' ? tradIndex : simpIndex;

  let results = primaryIndex.get(character) || [];
  if (results.length === 0) {
    results = fallbackIndex.get(character) || [];
  }

  return results.map((entry) => ({
    id: entry.id,
    simp: entry.simp,
    trad: entry.trad,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
  }));
}

/**
 * Look up a single simplified character to get its pinyin and traditional form.
 * Used when constructing custom words character by character.
 */
export async function lookupCharacter(
  char: string,
): Promise<{ pinyin: string; trad: string } | null> {
  await loadDictionary();

  const results = simpIndex.get(char);
  if (!results || results.length === 0) {
    return null;
  }

  const entry = results[0];
  return {
    pinyin: entry.pinyin,
    trad: entry.trad,
  };
}

/**
 * Look up a single traditional character to get its pinyin and simplified form.
 * Used when constructing custom words from traditional character input.
 */
export async function lookupCharacterByTrad(
  char: string,
): Promise<{ pinyin: string; simp: string } | null> {
  await loadDictionary();

  const results = tradIndex.get(char);
  if (!results || results.length === 0) {
    return null;
  }

  const entry = results[0];
  return {
    pinyin: entry.pinyin,
    simp: entry.simp,
  };
}

/**
 * Convert a Chinese text string to the target character set.
 * Converts character by character using dictionary lookups.
 * Characters not found in the dictionary pass through unchanged.
 */
export async function convertText(text: string, toCharSet: 'simp' | 'trad'): Promise<string> {
  await loadDictionary();

  const fromIndex = toCharSet === 'trad' ? simpIndex : tradIndex;
  let result = '';

  for (const char of text) {
    const entries = fromIndex.get(char);
    if (entries && entries.length > 0) {
      result += toCharSet === 'trad' ? entries[0].trad : entries[0].simp;
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Check if the dictionary is loaded.
 */
export function isDictionaryLoaded(): boolean {
  return dictionaryLoaded;
}

/**
 * Preload the dictionary (optional, for faster first search).
 */
export async function preloadDictionary(): Promise<void> {
  await loadDictionary();
}
