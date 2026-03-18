import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as hanzi from 'hanzi';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';

admin.initializeApp();

let hanziReady = false;
function ensureHanzi(): void {
  if (!hanziReady) {
    hanzi.start();
    hanziReady = true;
  }
}

// Re-export dictionary Cloud Functions
export {
  dictionarySearchWord,
  dictionaryLookupCharacter,
  dictionaryLookupCharacterByTrad,
  dictionaryConvertText,
  dictionarySubstringMatch,
} from './dictionary';

// Re-export TTS Cloud Function
export { textToSpeech } from './tts';

// Re-export similarity scoring Cloud Function
export { scoreSimilarity } from './similarity';

// Re-export chengyu sentence generation Cloud Function
export { generateChengyuSentence } from './chengyuSentence';

const db = admin.firestore();

/**
 * Verify that the request is from an authenticated user
 */
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }
  return context.auth.uid;
}

/**
 * Fisher-Yates shuffle for unbiased random ordering
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const BASE_DATE = new Date('2021-05-24');

/**
 * Compute the date key for today (YYYY-MM-DD in UTC)
 */
function getTodayKey(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Compute the days since the base date
 */
function getDaysSinceBase(): number {
  const today = new Date();
  return Math.floor(
    (today.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Get the daily chengyu challenge.
 *
 * Caches the selected chengyu and character data in a `dailyChengyu/{dateKey}`
 * document so that only the first call of the day reads the full collection.
 * Subsequent calls read a single cached document.
 */
export const getDailyChengyu = functions.https.onCall(
  async (data, context) => {
    const uid = verifyAuth(context);
    await checkRateLimit(uid, 'getDailyChengyu', RATE_LIMITS.getDailyChengyu);

    const dateKey = getTodayKey();
    const cacheRef = db.collection('dailyChengyu').doc(dateKey);

    // Try reading the cached document first (1 read instead of full scan)
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      return cacheDoc.data();
    }

    // Cache miss — compute today's chengyu
    const daysSinceBase = getDaysSinceBase();

    // Get all chengyus
    const chengyusSnapshot = await db.collection('chengyus').get();
    interface Chengyu {
      id: string;
      characters: string;
      pinyin: string;
      meaning: string;
    }
    const chengyus: Chengyu[] = chengyusSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Chengyu, 'id'>),
    }));

    if (chengyus.length === 0) {
      return { chengyu: null, options: [], correct: '', char_results: [] };
    }

    // Select today's chengyu deterministically
    const index = daysSinceBase % chengyus.length;
    const todaysChengyu = chengyus[index];

    // Get 3 random wrong options using Fisher-Yates
    const otherChengyus = chengyus.filter((_, i) => i !== index);
    const shuffled = fisherYatesShuffle(otherChengyus);
    const wrongOptions = shuffled.slice(0, 3).map((c) => c.meaning);

    // Shuffle all options using Fisher-Yates
    const allOptions = fisherYatesShuffle([
      todaysChengyu.meaning,
      ...wrongOptions,
    ]);

    // Batch character lookups using 'in' query instead of one query per char
    const chars = Array.from(todaysChengyu.characters).filter(
      (c) => c !== '，' && c !== ','
    );
    const uniqueChars = [...new Set(chars)];

    // Firestore 'in' queries support up to 30 values; chengyus are typically 4 chars
    const wordsSnapshot = await db
      .collection('words')
      .where('simp', 'in', uniqueChars)
      .get();

    // Build a map of char -> aggregated data
    const charDataMap = new Map<
      string,
      { trads: string[]; pinyins: string[]; meanings: string[] }
    >();
    for (const c of uniqueChars) {
      charDataMap.set(c, { trads: [], pinyins: [], meanings: [] });
    }

    wordsSnapshot.docs.forEach((doc) => {
      const wordData = doc.data();
      const entry = charDataMap.get(wordData.simp);
      if (!entry) return;
      if (wordData.trad && !entry.trads.includes(wordData.trad))
        entry.trads.push(wordData.trad);
      if (wordData.pinyin && !entry.pinyins.includes(wordData.pinyin))
        entry.pinyins.push(wordData.pinyin);
      if (wordData.meaning && !entry.meanings.includes(wordData.meaning))
        entry.meanings.push(wordData.meaning);
    });

    // Build char_results preserving original character order
    const charResults = chars.map((char) => {
      const entry = charDataMap.get(char) || {
        trads: [],
        pinyins: [],
        meanings: [],
      };
      return {
        char,
        trads: entry.trads.slice(0, 10),
        pinyins: entry.pinyins.slice(0, 10),
        meanings: entry.meanings.slice(0, 10),
      };
    });

    const result = {
      chengyu: todaysChengyu.characters,
      options: allOptions,
      correct: todaysChengyu.meaning,
      char_results: charResults,
    };

    // Cache the result for subsequent calls today
    await cacheRef.set(result);

    return result;
  }
);

/**
 * Look up a single character for the chengyu quiz
 */
export const lookupChengyuChar = functions.https.onCall(
  async (data: { char: string }, context) => {
    const uid = verifyAuth(context);
    await checkRateLimit(uid, 'lookupChengyuChar', RATE_LIMITS.lookupChengyuChar);

    const { char } = data;

    if (!char) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'char is required'
      );
    }

    const wordsSnapshot = await db
      .collection('words')
      .where('simp', '==', char)
      .get();

    const trads: string[] = [];
    const pinyins: string[] = [];
    const meanings: string[] = [];

    wordsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.trad && !trads.includes(data.trad)) trads.push(data.trad);
      if (data.pinyin && !pinyins.includes(data.pinyin))
        pinyins.push(data.pinyin);
      if (data.meaning && !meanings.includes(data.meaning))
        meanings.push(data.meaning);
    });

    return {
      simp: char,
      trads,
      pinyins,
      meanings,
    };
  }
);

/**
 * Decompose a Chinese character into its radical/structural components.
 * Uses HanziJS for radical-level decomposition with meanings.
 */
export const decomposeCharacter = functions.https.onCall(
  async (data: { char: string }, context) => {
    try {
      const uid = verifyAuth(context);
      await checkRateLimit(uid, 'decomposeCharacter', RATE_LIMITS.decomposeCharacter);
      ensureHanzi();

      const { char } = data;

      if (!char || [...char].length !== 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'A single Chinese character is required'
        );
      }

      let components: { char: string; meaning: string | null; pinyin: string | null }[];

      try {
        const result = hanzi.decompose(char, 1);

        // hanzi.decompose can return the string 'Invalid Input' for unknown chars
        if (!result || typeof result === 'string') {
          return { components: [] };
        }

        const rawComponents: string[] = Array.isArray(result.components)
          ? result.components
          : [];

        // Filter out the character itself, placeholder values, empty strings,
        // and raw Unicode code-point references (e.g. "37045") that appear in
        // CJK decomposition data for obscure stroke components.
        const filtered = rawComponents.filter(
          (c: string) =>
            c &&
            c !== char &&
            c !== 'No glyph available' &&
            c.trim() !== '' &&
            !/^\d+$/.test(c)
        );

        components = filtered.map((component: string) => {
          let meaning: string | null = null;
          let pinyin: string | null = null;

          try {
            const radicalMeaning = hanzi.getRadicalMeaning(component);
            if (radicalMeaning && radicalMeaning !== 'N/A') {
              meaning = radicalMeaning;
            }
          } catch {
            // Radical lookup can fail for unusual components
          }

          try {
            const defResult = hanzi.definitionLookup(component, 's');
            if (Array.isArray(defResult) && defResult.length > 0) {
              const entry = defResult[0];
              if (entry.definition) {
                meaning = meaning
                  ? meaning
                  : entry.definition.split('/')[0];
              }
              if (entry.pinyin) {
                pinyin = entry.pinyin;
              }
            }
          } catch {
            // Dictionary lookup can fail for unusual components
          }

          return { char: component, meaning, pinyin };
        });
      } catch (err) {
        console.error(`hanzi decomposition failed for "${char}":`, err);
        components = [];
      }

      return { components };
    } catch (err) {
      // Re-throw HttpsErrors as-is so clients get proper error codes
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      console.error('decomposeCharacter unhandled error:', err);
      return { components: [] };
    }
  }
);
