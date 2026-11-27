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
import { SearchMode } from '../utils/searchMode';
import { CharSet } from '../utils/charSet';

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

interface SearchRequest {
  query: string;
  charSet: CharSet;
  mode: SearchMode;
}

const searchCallable = () => httpsCallable<SearchRequest, Word[]>(functions, 'dictionarySearch');

/** The number of searches kept in memory. */
export const SEARCH_CACHE_SIZE = 50;

// The answers of the recent searches, oldest first. The dictionary changes
// only with a deploy, so an answer stays good for the life of the page. Back
// from the word page finds its search here and draws it at once.
const searchCache = new Map<string, Word[]>();

const cacheKey = (query: string, charSet: CharSet, mode: SearchMode) =>
  JSON.stringify([query, charSet, mode]);

/** The kept answer of a search, or undefined when it is not kept. */
export function cachedSearch(
  query: string,
  charSet: CharSet,
  mode: SearchMode,
): Word[] | undefined {
  const parsed = searchInputSchema.safeParse(query);
  if (!parsed.success) return undefined;
  return searchCache.get(cacheKey(parsed.data, charSet, mode));
}

/**
 * The search of the Add Words screen: hanzi, pinyin or English, ranked on the
 * server, at most 30 entries. The search mode decides how a Latin query reads:
 * pinyin in Chinese mode, English in English mode (#577).
 */
export async function searchDictionary(
  query: string,
  charSet: CharSet,
  mode: SearchMode,
): Promise<Word[]> {
  const parsed = searchInputSchema.safeParse(query);
  if (!parsed.success || parsed.data.length === 0) return [];

  const key = cacheKey(parsed.data, charSet, mode);
  const kept = searchCache.get(key);
  if (kept) return kept;

  const found = await traceAsync('dictionary_search', async () => {
    const fn = searchCallable();
    const result = await retryTransient(() => fn({ query: parsed.data, charSet, mode }));
    return result.data;
  });
  searchCache.set(key, found);
  if (searchCache.size > SEARCH_CACHE_SIZE) {
    searchCache.delete(searchCache.keys().next().value as string);
  }
  return found;
}

/**
 * One empty English search, sent when the learner switches to English. The
 * instance builds its English index before the first English query comes. A
 * failure only means that the first query waits for the build.
 */
export function warmEnglishSearch(): void {
  searchCallable()({ query: '', charSet: 'simp', mode: 'english' }).catch(() => undefined);
}

/**
 * One dictionary entry by its id, for the word page (#562). Null when no
 * entry has the id.
 */
export async function getEntry(id: number): Promise<Word | null> {
  const fn = httpsCallable<{ id: number }, Word | null>(functions, 'dictionaryEntry');
  const result = await retryTransient(() => fn({ id }));
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
