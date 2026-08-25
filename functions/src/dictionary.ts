import * as fs from 'fs';
import * as path from 'path';
import * as functions from 'firebase-functions';
import { withErrorReporting } from './reporting';

interface DictionaryEntry {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

export interface WordResult {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

// In-memory dictionary state (persists across warm invocations)
let dictionaryLoaded = false;
let entries: DictionaryEntry[] = [];
const simpIndex: Map<string, DictionaryEntry[]> = new Map();
const tradIndex: Map<string, DictionaryEntry[]> = new Map();

/**
 * Load the dictionary from the bundled JSON file into memory.
 * Only runs once per Cloud Function instance.
 */
function loadDictionary(): void {
  if (dictionaryLoaded) return;

  const dictPath = path.join(__dirname, '..', 'data', 'dictionary.json');
  const raw = fs.readFileSync(dictPath, 'utf8');
  entries = JSON.parse(raw);

  for (const entry of entries) {
    if (!simpIndex.has(entry.simp)) {
      simpIndex.set(entry.simp, []);
    }
    simpIndex.get(entry.simp)!.push(entry);

    if (!tradIndex.has(entry.trad)) {
      tradIndex.set(entry.trad, []);
    }
    tradIndex.get(entry.trad)!.push(entry);
  }

  dictionaryLoaded = true;
  console.log(`Dictionary loaded: ${entries.length} entries`);
}

/**
 * Search for words by exact character match.
 */
function searchWordInternal(
  character: string,
  charSet: 'simp' | 'trad'
): WordResult[] {
  loadDictionary();

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
 * Look up a single simplified character.
 */
function lookupCharacterInternal(
  char: string
): { pinyin: string; trad: string } | null {
  loadDictionary();

  const results = simpIndex.get(char);
  if (!results || results.length === 0) return null;

  return { pinyin: results[0].pinyin, trad: results[0].trad };
}

/**
 * Look up a single traditional character.
 */
function lookupCharacterByTradInternal(
  char: string
): { pinyin: string; simp: string } | null {
  loadDictionary();

  const results = tradIndex.get(char);
  if (!results || results.length === 0) return null;

  return { pinyin: results[0].pinyin, simp: results[0].simp };
}

/**
 * Convert text between simplified and traditional.
 */
function convertTextInternal(
  text: string,
  toCharSet: 'simp' | 'trad'
): string {
  loadDictionary();

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
 * Greedy forward maximum matching for substring decomposition.
 */
function substringMatchInternal(
  text: string,
  charSet: 'simp' | 'trad'
): WordResult[] {
  loadDictionary();

  const primaryIndex = charSet === 'simp' ? simpIndex : tradIndex;
  const fallbackIndex = charSet === 'simp' ? tradIndex : simpIndex;
  const results: WordResult[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;
    for (let len = text.length - i; len >= 1; len--) {
      const substr = text.slice(i, i + len);
      let entries = primaryIndex.get(substr);
      if (!entries || entries.length === 0) {
        entries = fallbackIndex.get(substr);
      }
      if (entries && entries.length > 0) {
        const e = entries[0];
        results.push({
          id: e.id,
          simp: e.simp,
          trad: e.trad,
          pinyin: e.pinyin,
          meaning: e.meaning,
        });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      results.push({
        id: -1,
        simp: text[i],
        trad: text[i],
        pinyin: '',
        meaning: '',
      });
      i += 1;
    }
  }
  return results;
}

// --- Callable Cloud Functions ---

export const dictionarySearchWord = functions.https.onCall(
  withErrorReporting(
    'dictionarySearchWord',
    (data: { character: string; charSet: 'simp' | 'trad' }) => {
      const { character, charSet } = data;
      if (!character || !charSet) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'character and charSet are required'
        );
      }
      return searchWordInternal(character, charSet);
    }
  )
);

export const dictionaryLookupCharacter = functions.https.onCall(
  withErrorReporting('dictionaryLookupCharacter', (data: { char: string }) => {
    const { char } = data;
    if (!char) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'char is required'
      );
    }
    return lookupCharacterInternal(char);
  })
);

export const dictionaryLookupCharacterByTrad = functions.https.onCall(
  withErrorReporting(
    'dictionaryLookupCharacterByTrad',
    (data: { char: string }) => {
      const { char } = data;
      if (!char) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'char is required'
        );
      }
      return lookupCharacterByTradInternal(char);
    }
  )
);

export const dictionaryConvertText = functions.https.onCall(
  withErrorReporting(
    'dictionaryConvertText',
    (data: { text: string; toCharSet: 'simp' | 'trad' }) => {
      const { text, toCharSet } = data;
      if (!text || !toCharSet) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'text and toCharSet are required'
        );
      }
      return convertTextInternal(text, toCharSet);
    }
  )
);

export const dictionarySubstringMatch = functions.https.onCall(
  withErrorReporting(
    'dictionarySubstringMatch',
    (data: { text: string; charSet: 'simp' | 'trad' }) => {
      const { text, charSet } = data;
      if (!text || !charSet) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'text and charSet are required'
        );
      }
      return substringMatchInternal(text, charSet);
    }
  )
);
