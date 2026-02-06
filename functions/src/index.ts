import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { Segment, useDefault } from 'segmentit';
import { Translate } from '@google-cloud/translate/build/src/v2';

admin.initializeApp();

// Initialize Chinese segmenter
const segmentit = new Segment();
useDefault(segmentit);

// Initialize Google Cloud Translation client
const translate = new Translate();

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
 * Translate text using Google Cloud Translation API
 * Keeps the same function name for frontend compatibility
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

    // Map DeepL language codes to Google codes
    const googleLang = targetLang === 'EN' ? 'en' : 'zh-CN';

    try {
      const [translation] = await translate.translate(text, googleLang);

      // Return in same format as DeepL for frontend compatibility
      return { translations: [{ text: translation }] };
    } catch (error) {
      console.error('Google Translation error:', error);
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
    highlight: number[][];
    words: (SentenceWord | string)[];
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

/**
 * Calculate highlight indices for a word in a sentence
 */
function calculateHighlightIndices(
  sentence: string,
  word: string
): number[][] {
  const indices: number[][] = [];
  let startIndex = 0;

  while (true) {
    const index = sentence.indexOf(word, startIndex);
    if (index === -1) break;
    indices.push([index, index + word.length]);
    startIndex = index + word.length;
  }

  return indices;
}

interface TatoebaExample {
  chinese: string;
  english: string;
}

interface TatoebaSentence {
  id: number;
  text: string;
  lang: string;
  script: string | null;
  transcriptions?: Array<{
    script: string;
    text: string;
  }>;
}

interface TatoebaTranslation extends TatoebaSentence {
  is_direct: boolean;
}

interface TatoebaSentenceWithTranslations extends TatoebaSentence {
  translations: TatoebaTranslation[];
}

/**
 * Fetch example sentences from Tatoeba API
 */
async function fetchTatoebaExamples(word: string): Promise<TatoebaExample[]> {
  // Search for Chinese sentences containing the word
  const searchUrl = `https://api.tatoeba.org/unstable/sentences?lang=cmn&q=${encodeURIComponent(word)}&limit=20&sort=relevance`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    console.error(`Tatoeba search failed: ${searchResponse.status}`);
    return [];
  }

  const searchData = await searchResponse.json() as { data: TatoebaSentence[] };
  const sentences = searchData.data || [];

  if (sentences.length === 0) {
    return [];
  }

  // Fetch translations for each sentence
  const examples: TatoebaExample[] = [];

  for (const sentence of sentences.slice(0, 10)) {
    const detailUrl = `https://api.tatoeba.org/unstable/sentences/${sentence.id}?include=translations`;
    const detailResponse = await fetch(detailUrl);

    if (!detailResponse.ok) {
      continue;
    }

    const detailData = await detailResponse.json() as { data: TatoebaSentenceWithTranslations };
    const sentenceWithTranslations = detailData.data;

    // Find English translation
    const englishTranslation = sentenceWithTranslations.translations?.find(
      (t) => t.lang === 'eng'
    );

    if (englishTranslation) {
      // Get simplified Chinese text (from transcriptions if available, or original)
      let chineseText = sentence.text;
      if (sentence.script === 'Hant') {
        const simpTranscription = sentence.transcriptions?.find(
          (t) => t.script === 'Hans'
        );
        if (simpTranscription) {
          chineseText = simpTranscription.text;
        }
      }

      examples.push({
        chinese: chineseText,
        english: englishTranslation.text,
      });
    }
  }

  return examples;
}

/**
 * Check if a string contains Latin letters
 */
function containsLatinLetters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/**
 * Check if a string is a Chinese character
 */
function isChinese(text: string): boolean {
  return /^[\u4e00-\u9fff]+$/.test(text);
}

/**
 * Segment Chinese text into words
 */
function segmentChinese(text: string): string[] {
  const result = segmentit.doSegment(text, { simple: true });
  return result as string[];
}

/**
 * Look up words in Firestore dictionary
 */
async function lookupWords(
  words: string[]
): Promise<(SentenceWord | null)[]> {
  const results: (SentenceWord | null)[] = [];

  for (const word of words) {
    // Skip non-Chinese text
    if (!isChinese(word)) {
      results.push(null);
      continue;
    }

    // Try to find the word as-is
    const wordSnapshot = await db
      .collection('words')
      .where('simp', '==', word)
      .limit(1)
      .get();

    if (!wordSnapshot.empty) {
      const data = wordSnapshot.docs[0].data();
      results.push({
        simp: data.simp,
        trad: data.trad || data.simp,
        pinyin: data.pinyin || '',
        meaning: data.meaning || '',
      });
    } else if (word.length > 1) {
      // If multi-char word not found, look up individual characters
      for (const char of word) {
        const charSnapshot = await db
          .collection('words')
          .where('simp', '==', char)
          .limit(1)
          .get();

        if (!charSnapshot.empty) {
          const data = charSnapshot.docs[0].data();
          results.push({
            simp: data.simp,
            trad: data.trad || data.simp,
            pinyin: data.pinyin || '',
            meaning: data.meaning || '',
          });
        } else {
          results.push(null);
        }
      }
    } else {
      results.push(null);
    }
  }

  return results;
}

/**
 * Get word breakdown for a sentence, excluding the target word
 */
async function getWordBreakdown(
  sentence: string,
  targetWord: string
): Promise<(SentenceWord | string)[]> {
  const parts = sentence.split(targetWord);
  const result: (SentenceWord | string)[] = [];

  // Process text before the target word
  if (parts[0]) {
    const segmented = segmentChinese(parts[0]);
    const lookedUp = await lookupWords(segmented);
    for (let i = 0; i < segmented.length; i++) {
      if (lookedUp[i]) {
        result.push(lookedUp[i]!);
      }
    }
  }

  // Add the target word as a string marker
  result.push(targetWord);

  // Process text after the target word
  if (parts[1]) {
    const segmented = segmentChinese(parts[1]);
    const lookedUp = await lookupWords(segmented);
    for (let i = 0; i < segmented.length; i++) {
      if (lookedUp[i]) {
        result.push(lookedUp[i]!);
      }
    }
  }

  return result;
}

/**
 * Get example sentences for a word
 * Fetches from Tatoeba API, segments Chinese text, and looks up words
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

    try {
      // Fetch examples from Tatoeba
      const examples = await fetchTatoebaExamples(word);

      // Filter out sentences containing Latin letters
      const filteredExamples = examples.filter(
        (ex) => !containsLatinLetters(ex.chinese)
      );

      // Build sentence objects with word breakdowns
      const sentences: Sentence[] = [];
      for (const ex of filteredExamples.slice(0, 10)) {
        const wordBreakdown = await getWordBreakdown(ex.chinese, word);

        // Calculate highlight indices for the word in the sentence
        const chineseHighlight = calculateHighlightIndices(ex.chinese, word);

        sentences.push({
          chinese: {
            sentence: ex.chinese,
            highlight: chineseHighlight,
            words: wordBreakdown,
          },
          english: {
            sentence: ex.english,
            highlight: [],
          },
        });
      }

      // Shuffle the results
      for (let i = sentences.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sentences[i], sentences[j]] = [sentences[j], sentences[i]];
      }

      return { sentences };
    } catch (error) {
      console.error('Error fetching sentences:', error);
      return { sentences: [] };
    }
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

    try {
      // Fetch examples from Tatoeba
      const examples = await fetchTatoebaExamples(word);

      // Filter out sentences containing Latin letters
      const filteredExamples = examples.filter(
        (ex) => !containsLatinLetters(ex.chinese)
      );

      if (filteredExamples.length === 0) {
        return { sentence: null };
      }

      // Sort by sentence length and take shortest 10
      const sortedExamples = filteredExamples
        .sort((a, b) => a.chinese.length - b.chinese.length)
        .slice(0, 10);

      // Pick a random sentence from the shortest ones
      const randomIndex = Math.floor(Math.random() * sortedExamples.length);
      const selected = sortedExamples[randomIndex];

      return {
        sentence: {
          chinese: selected.chinese,
          english: selected.english,
        },
      };
    } catch (error) {
      console.error('Error fetching sentence:', error);
      return { sentence: null };
    }
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

    // Select today's chengyu
    const index = daysSinceBase % chengyus.length;
    const todaysChengyu = chengyus[index];

    // Get 3 random wrong options
    const otherChengyus = chengyus.filter((_, i) => i !== index);
    const shuffled = otherChengyus.sort(() => Math.random() - 0.5);
    const wrongOptions = shuffled.slice(0, 3).map((c) => c.meaning);

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
