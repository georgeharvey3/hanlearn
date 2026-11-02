/**
 * Dictionary service that delegates lookups to Cloud Functions.
 *
 * The dictionary (~124K CC-CEDICT entries) is loaded server-side in the
 * Cloud Function's memory, so the client never downloads the full 16 MB file.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { Word } from '../types/models';
import { searchInputSchema } from '../validation/schemas';
import { traceAsync } from './performanceService';
import { retryTransient } from '../utils/retry';
import { AlternativeDirection } from '../utils/alternativeAnswers';

/**
 * Search for words by exact character match.
 */
export async function searchWord(character: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const parsed = searchInputSchema.safeParse(character);
  if (!parsed.success || parsed.data.length === 0) return [];

  return traceAsync('dictionary_search', async () => {
    const fn = httpsCallable<{ character: string; charSet: string }, Word[]>(
      functions,
      'dictionarySearchWord',
    );
    const result = await retryTransient(() => fn({ character: parsed.data, charSet }));
    return result.data;
  });
}

/**
 * The search of the Add Words screen: hanzi, pinyin or English, ranked on the
 * server, at most 30 entries.
 */
export async function searchDictionary(query: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const parsed = searchInputSchema.safeParse(query);
  if (!parsed.success || parsed.data.length === 0) return [];

  return traceAsync('dictionary_search', async () => {
    const fn = httpsCallable<{ query: string; charSet: string }, Word[]>(
      functions,
      'dictionarySearch',
    );
    const result = await retryTransient(() => fn({ query: parsed.data, charSet }));
    return result.data;
  });
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
  const parsed = searchInputSchema.safeParse(text);
  if (!parsed.success || parsed.data.length === 0) return '';

  const fn = httpsCallable<{ text: string; toCharSet: string }, string>(
    functions,
    'dictionaryConvertText',
  );
  const result = await fn({ text: parsed.data, toCharSet });
  return result.data;
}

/**
 * Decompose a Chinese text string into dictionary-matched substrings
 * using greedy forward maximum matching.
 */
export async function substringMatch(text: string, charSet: 'simp' | 'trad'): Promise<Word[]> {
  const parsed = searchInputSchema.safeParse(text);
  if (!parsed.success || parsed.data.length === 0) return [];

  return traceAsync('dictionary_substring_match', async () => {
    const fn = httpsCallable<{ text: string; charSet: string }, Word[]>(
      functions,
      'dictionarySubstringMatch',
    );
    const result = await retryTransient(() => fn({ text: parsed.data, charSet }));
    return result.data;
  });
}

/**
 * The alternative answers of the question values of one session, in the order
 * sent: for each value, the answers of every entry of CC-CEDICT that fits it.
 */
export async function fetchAlternatives(
  charSet: 'simp' | 'trad',
  questions: { direction: AlternativeDirection; value: string | string[] }[],
): Promise<string[][]> {
  return traceAsync('dictionary_alternatives', async () => {
    const fn = httpsCallable<{ charSet: string; questions: typeof questions }, string[][]>(
      functions,
      'dictionaryAlternatives',
    );
    const result = await retryTransient(() => fn({ charSet, questions }));
    return result.data;
  });
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
