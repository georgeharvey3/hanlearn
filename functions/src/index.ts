import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

admin.initializeApp();

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
 * Translate text using DeepL API
 * This moves the API key to the server side, fixing the security issue
 */
export const translateWithDeepL = functions.https.onCall(
  async (data: { text: string; targetLang: string }, context) => {
    verifyAuth(context);

    const { text, targetLang } = data;

    if (!text || !targetLang) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'text and targetLang are required'
      );
    }

    // Get API key from Firebase config
    // Set with: firebase functions:config:set deepl.key="your-api-key"
    const apiKey = functions.config().deepl?.key;

    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'DeepL API key not configured'
      );
    }

    try {
      const response = await fetch(
        `https://api-free.deepl.com/v2/translate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            auth_key: apiKey,
            text: text,
            target_lang: targetLang,
          }),
        }
      );

      if (!response.ok) {
        throw new functions.https.HttpsError(
          'internal',
          `DeepL API error: ${response.statusText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('DeepL translation error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Translation failed'
      );
    }
  }
);

interface SentenceWord {
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

interface Sentence {
  chinese: {
    sentence: string;
    highlight: string;
    words: SentenceWord[];
  };
  english: {
    sentence: string;
    highlight: string;
  };
}

/**
 * Get example sentences for a word
 * Note: This is a placeholder implementation
 * Full implementation would require:
 * 1. Reverso Context API (or similar service)
 * 2. Chinese text segmentation (jieba-js or similar)
 * 3. Word lookups from Firestore
 */
export const getSentences = functions.https.onCall(
  async (data: { word: string }, context) => {
    verifyAuth(context);

    const { word } = data;

    if (!word) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'word is required'
      );
    }

    // Placeholder: Return empty sentences array
    // Full implementation would call Reverso API and process results
    const sentences: Sentence[] = [];

    return { sentences };
  }
);

/**
 * Get a single random example sentence for hints
 */
export const getOneSentence = functions.https.onCall(
  async (data: { word: string }, context) => {
    verifyAuth(context);

    const { word } = data;

    if (!word) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'word is required'
      );
    }

    // Placeholder: Return null sentence
    // Full implementation would call Reverso API
    return { sentence: null };
  }
);

/**
 * Get the daily chengyu challenge
 */
export const getDailyChengyu = functions.https.onCall(
  async (data, context) => {
    verifyAuth(context);

    const BASE_DATE = new Date('2021-05-24');
    const today = new Date();
    const daysSinceBase = Math.floor(
      (today.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get all chengyus
    const chengyusSnapshot = await db.collection('chengyus').get();
    const chengyus = chengyusSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (chengyus.length === 0) {
      return { chengyu: null, options: [], correct: '', char_results: [] };
    }

    // Select today's chengyu
    const index = daysSinceBase % chengyus.length;
    const todaysChengyu = chengyus[index] as {
      characters: string;
      pinyin: string;
      meaning: string;
    };

    // Get 3 random wrong options
    const otherChengyus = chengyus.filter((_, i) => i !== index);
    const shuffled = otherChengyus.sort(() => Math.random() - 0.5);
    const wrongOptions = shuffled.slice(0, 3).map((c: any) => c.meaning);

    // Shuffle all options
    const allOptions = [todaysChengyu.meaning, ...wrongOptions].sort(
      () => Math.random() - 0.5
    );

    // Look up character data
    const charResults = [];
    for (const char of todaysChengyu.characters) {
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

      charResults.push({
        char,
        trads: trads.slice(0, 10),
        pinyins: pinyins.slice(0, 10),
        meanings: meanings.slice(0, 10),
      });
    }

    return {
      chengyu: todaysChengyu.characters,
      options: allOptions,
      correct: todaysChengyu.meaning,
      char_results: charResults,
    };
  }
);

/**
 * Look up a single character for the chengyu quiz
 */
export const lookupChengyuChar = functions.https.onCall(
  async (data: { char: string }, context) => {
    verifyAuth(context);

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
