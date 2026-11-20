import * as fs from 'fs';
import * as path from 'path';
import * as functions from 'firebase-functions/v1';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';
import { withErrorReporting } from './reporting';
import { alternativeAnswers, readAlternativesRequest } from './alternativeAnswers';
import { ModeOf, searchDictionary, SearchMode, WordResult } from './dictionarySearch';
import { entryById } from './dictionaryEntry';
import { createDictionaryStore } from './dictionaryStore';

/**
 * The dictionary of this instance (persists across warm invocations). Each
 * function builds only the indexes that it reads, on its first call (#498).
 */
const dictionary = createDictionaryStore(() => {
  const dictPath = path.join(__dirname, '..', 'data', 'dictionary.json');
  return JSON.parse(fs.readFileSync(dictPath, 'utf8'));
});

/**
 * Search for words by exact character match.
 */
function searchWordInternal(
  character: string,
  charSet: 'simp' | 'trad'
): WordResult[] {
  const { simp: simpIndex, trad: tradIndex } = dictionary.characterIndexes();
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
  const results = dictionary.characterIndexes().simp.get(char);
  if (!results || results.length === 0) return null;

  return { pinyin: results[0].pinyin, trad: results[0].trad };
}

/**
 * Look up a single traditional character.
 */
function lookupCharacterByTradInternal(
  char: string
): { pinyin: string; simp: string } | null {
  const results = dictionary.characterIndexes().trad.get(char);
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
  const { simp: simpIndex, trad: tradIndex } = dictionary.characterIndexes();
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
  const { simp: simpIndex, trad: tradIndex } = dictionary.characterIndexes();
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

/**
 * Runtime options for every `dictionary*` function.
 *
 * The dictionary store reads a 15.9 MB JSON file and builds the indexes of the
 * function over all 124k entries, once per instance. Measured peak RSS for that
 * cold start, with the two character indexes only, was about 194 MB (see scripts/measure-dictionary-memory.js and issue #319), so
 * the 1st gen default of 256 MB leaves only 24% of headroom. 512 MB leaves 62%,
 * and the larger CPU share that comes with it also shortens the cold start.
 */
const dictionaryRuntime = functions.runWith({ memory: '512MB' });

export const dictionarySearchWord = dictionaryRuntime.https.onCall(
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

/**
 * The search of the Add Words screen: hanzi, pinyin or English, ranked, at
 * most 30 entries. `dictionarySearchWord` stays for the exact lookups.
 *
 * An English call builds the English index first, so the client warms an
 * instance with an empty English query when the learner switches to English
 * (#577). A Chinese call never builds it.
 */
export const dictionarySearch = dictionaryRuntime.https.onCall(
  withErrorReporting(
    'dictionarySearch',
    (data: { query: string; charSet: 'simp' | 'trad'; mode: SearchMode }) => {
      const { query, charSet, mode } = data;
      const validCharSet = charSet === 'simp' || charSet === 'trad';
      const validMode = mode === 'chinese' || mode === 'english';
      if (typeof query !== 'string' || query.length > 100 || !validCharSet || !validMode) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'query, charSet and mode are required'
        );
      }
      const search: ModeOf =
        mode === 'english' ? { mode, english: dictionary.englishIndex() } : { mode };
      return searchDictionary(dictionary.searchIndex(), query, charSet, search);
    }
  )
);

/**
 * One entry by its id, for the word page of an entry that the learner does not
 * have (#562). Null when no entry has the id.
 */
export const dictionaryEntry = dictionaryRuntime.https.onCall(
  withErrorReporting('dictionaryEntry', (data: { id: number }) => {
    const id = data?.id;
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      throw new functions.https.HttpsError('invalid-argument', 'id is required');
    }
    return entryById(dictionary.entryIndex(), id);
  })
);

export const dictionaryLookupCharacter = dictionaryRuntime.https.onCall(
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

export const dictionaryLookupCharacterByTrad = dictionaryRuntime.https.onCall(
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

export const dictionaryConvertText = dictionaryRuntime.https.onCall(
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

export const dictionarySubstringMatch = dictionaryRuntime.https.onCall(
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

/**
 * The alternative answers of the questions of one session: for each question
 * value, the answers of every entry that fits it. The client sends each value
 * once, when the session starts, and gets the lists back in the same order.
 * See issue #348.
 */
export const dictionaryAlternatives = dictionaryRuntime.https.onCall(
  withErrorReporting('dictionaryAlternatives', async (data: unknown, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }
    const request = readAlternativesRequest(data);
    if (!request) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'charSet and questions are required'
      );
    }

    // The rate-limit transaction waits on the network, and the index build is
    // CPU work, so the build runs while the transaction is in flight (#498).
    // A caller that the limit rejects on a cold instance still builds the
    // index, but the instance keeps it for later calls. The empty catch stops
    // an unhandled rejection when the build throws first. The await below
    // still gets the rejection.
    const allowed = checkRateLimit(
      context.auth.uid,
      'dictionaryAlternatives',
      RATE_LIMITS.dictionaryAlternatives
    );
    allowed.catch(() => undefined);
    const index = dictionary.alternativeIndex();
    await allowed;
    return request.questions.map((question) =>
      alternativeAnswers(index, question, request.charSet)
    );
  })
);
