/**
 * Dictionary service that delegates lookups to Cloud Functions.
 *
 * The dictionary (~124K CC-CEDICT entries) is loaded server-side in the
 * Cloud Function's memory, so the client never downloads the full 16 MB file.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { Word } from '../types/models';

/**
 * Search for words by exact character match.
 */
export async function searchWord(character: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const fn = httpsCallable<{ character: string; charSet: string }, Word[]>(
    functions,
    'dictionarySearchWord',
  );
  const result = await fn({ character, charSet });
  return result.data;
}

/**
 * Look up a single simplified character to get its pinyin and traditional form.
 */
export async function lookupCharacter(
  char: string,
): Promise<{ pinyin: string; trad: string } | null> {
  const fn = httpsCallable<{ char: string }, { pinyin: string; trad: string } | null>(
    functions,
    'dictionaryLookupCharacter',
  );
  const result = await fn({ char });
  return result.data;
}

/**
 * Look up a single traditional character to get its pinyin and simplified form.
 */
export async function lookupCharacterByTrad(
  char: string,
): Promise<{ pinyin: string; simp: string } | null> {
  const fn = httpsCallable<{ char: string }, { pinyin: string; simp: string } | null>(
    functions,
    'dictionaryLookupCharacterByTrad',
  );
  const result = await fn({ char });
  return result.data;
}

/**
 * Convert a Chinese text string to the target character set.
 */
export async function convertText(text: string, toCharSet: 'simp' | 'trad'): Promise<string> {
  const fn = httpsCallable<{ text: string; toCharSet: string }, string>(
    functions,
    'dictionaryConvertText',
  );
  const result = await fn({ text, toCharSet });
  return result.data;
}

/**
 * Decompose a Chinese text string into dictionary-matched substrings
 * using greedy forward maximum matching.
 */
export async function substringMatch(text: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const fn = httpsCallable<{ text: string; charSet: string }, Word[]>(
    functions,
    'dictionarySubstringMatch',
  );
  const result = await fn({ text, charSet });
  return result.data;
}

/**
 * Check if the dictionary is loaded.
 * With Cloud Functions, the dictionary is always available server-side.
 */
export function isDictionaryLoaded(): boolean {
  return true;
}

/**
 * Preload the dictionary (no-op with Cloud Functions).
 */
export async function preloadDictionary(): Promise<void> {
  // No-op — dictionary is loaded server-side
}
