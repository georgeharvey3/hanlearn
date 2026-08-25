import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';
import { initSentry, withErrorReporting } from './reporting';

// Start the error reporter before anything else, so that a failure during the
// rest of the cold start is still reported.
initSentry();

admin.initializeApp();

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

// Re-export character decomposition Cloud Function
export { decomposeCharacter } from './decompose';

const db = admin.firestore();

/**
 * Runtime options, so that the memory limit of each function is a decision and
 * not the 1st gen default. See issue #316 and functions/monitoring/README.md;
 * the two alert-policy files there group functions by these limits.
 *
 * Baseline for any instance is about 105 MB — firebase-functions, the Admin
 * SDK and Sentry.init. `standardRuntime` covers the handlers that add only
 * per-request data on top of that.
 */
const standardRuntime = functions.runWith({ memory: '256MB' });

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
export const getDailyChengyu = standardRuntime.https.onCall(
  withErrorReporting('getDailyChengyu', async (data, context) => {
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
      // An admin manages this collection, so empty means broken data or broken
      // rules. The client cannot show null anyway, and an empty result here was
      // indistinguishable from a failure. See issue #317.
      throw new functions.https.HttpsError(
        'internal',
        'The chengyus collection is empty'
      );
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
  })
);

/**
 * Look up a single character for the chengyu quiz
 */
export const lookupChengyuChar = standardRuntime.https.onCall(
  withErrorReporting('lookupChengyuChar', async (data: { char: string }, context) => {
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
  })
);

