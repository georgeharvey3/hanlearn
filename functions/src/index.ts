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

interface SegmentedSentence {
  chinese: {
    sentence: string;
    highlight: number[][];
    segments: string[];
    targetIndex: number;
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
 * Search Tatoeba for Chinese sentences containing a word.
 * Returns raw sentence objects (no translations fetched yet).
 */
async function searchTatoeba(word: string): Promise<TatoebaSentence[]> {
  const searchUrl = `https://api.tatoeba.org/unstable/sentences?lang=cmn&q=${encodeURIComponent(word)}&limit=20&sort=relevance`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    console.error(`Tatoeba search failed: ${searchResponse.status}`);
    return [];
  }

  const searchData = await searchResponse.json() as { data: TatoebaSentence[] };
  return searchData.data || [];
}

/**
 * Fetch the English translation for a single Tatoeba sentence.
 * Returns null if no English translation is available.
 */
async function fetchTatoebaTranslation(sentence: TatoebaSentence): Promise<TatoebaExample | null> {
  try {
    const detailUrl = `https://api.tatoeba.org/unstable/sentences/${sentence.id}?include=translations`;
    const detailResponse = await fetch(detailUrl);

    if (!detailResponse.ok) {
      return null;
    }

    const detailData = await detailResponse.json() as { data: TatoebaSentenceWithTranslations };
    const sentenceWithTranslations = detailData.data;

    const englishTranslation = sentenceWithTranslations.translations?.find(
      (t) => t.lang === 'eng'
    );

    if (!englishTranslation) {
      return null;
    }

    let chineseText = sentence.text;
    if (sentence.script === 'Hant') {
      const simpTranscription = sentence.transcriptions?.find(
        (t) => t.script === 'Hans'
      );
      if (simpTranscription) {
        chineseText = simpTranscription.text;
      }
    }

    return {
      chinese: chineseText,
      english: englishTranslation.text,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch example sentences from Tatoeba API (batch mode).
 * Used by getOneSentence and as fallback.
 */
async function fetchTatoebaExamples(word: string): Promise<TatoebaExample[]> {
  const sentences = await searchTatoeba(word);

  if (sentences.length === 0) {
    return [];
  }

  const detailPromises = sentences.slice(0, 10).map(
    (sentence) => fetchTatoebaTranslation(sentence)
  );

  const results = await Promise.all(detailPromises);
  return results.filter((r): r is TatoebaExample => r !== null);
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
 * Segment a sentence into words, marking the target word's position.
 * Returns plain strings — word lookups happen on the frontend via the static dictionary.
 */
function segmentSentence(
  sentence: string,
  targetWord: string
): { segments: string[]; targetIndex: number } {
  const parts = sentence.split(targetWord);
  const segments: string[] = [];

  // Segment text before the target word
  if (parts[0]) {
    const segmented = segmentChinese(parts[0]);
    for (const word of segmented) {
      if (isChinese(word)) {
        segments.push(word);
      }
    }
  }

  // Add the target word
  const targetIndex = segments.length;
  segments.push(targetWord);

  // Segment text after the target word
  if (parts.length > 1 && parts[1]) {
    const segmented = segmentChinese(parts[1]);
    for (const word of segmented) {
      if (isChinese(word)) {
        segments.push(word);
      }
    }
  }

  return { segments, targetIndex };
}

/**
 * Get example sentences for a word.
 * With offset: returns a single sentence at that position + totalCount (fast: 2 API calls).
 * Without offset: returns all sentences (legacy batch mode: 11 API calls).
 */
export const getSentences = functions.https.onCall(
  async (data: { word: string; offset?: number }, context) => {
    verifyAuth(context);

    const { word, offset } = data;

    if (!word) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'word is required'
      );
    }

    try {
      // Search Tatoeba for candidate sentences (1 API call)
      const rawSentences = await searchTatoeba(word);

      // Filter out sentences with Latin characters
      const filtered = rawSentences.filter(
        (s) => !containsLatinLetters(s.text)
      );

      // Sort by sentence length (shorter = easier to read)
      const sorted = [...filtered].sort(
        (a, b) => a.text.length - b.text.length
      );

      // Keep only short sentences (≤30 chars), or shortest 5 if none qualify
      const shortSentences = sorted.filter((s) => s.text.length <= 30);
      const candidates = shortSentences.length > 0
        ? shortSentences
        : sorted.slice(0, 5);

      if (typeof offset === 'number') {
        // Single-sentence mode: fetch translation for just one sentence
        if (offset >= candidates.length) {
          return { sentence: null, totalCount: candidates.length };
        }

        const selected = candidates[offset];
        const example = await fetchTatoebaTranslation(selected);

        if (!example) {
          return { sentence: null, totalCount: candidates.length };
        }

        const { segments, targetIndex } = segmentSentence(example.chinese, word);
        const chineseHighlight = calculateHighlightIndices(example.chinese, word);

        return {
          sentence: {
            chinese: {
              sentence: example.chinese,
              highlight: chineseHighlight,
              segments,
              targetIndex,
            },
            english: {
              sentence: example.english,
              highlight: [],
            },
          },
          totalCount: candidates.length,
        };
      }

      // Batch mode (legacy): fetch translations for all candidates
      const detailPromises = candidates.map(
        (s) => fetchTatoebaTranslation(s)
      );
      const examples = (await Promise.all(detailPromises)).filter(
        (r): r is TatoebaExample => r !== null
      );

      const sentences: SegmentedSentence[] = examples.map((ex) => {
        const { segments, targetIndex } = segmentSentence(ex.chinese, word);
        const chineseHighlight = calculateHighlightIndices(ex.chinese, word);

        return {
          chinese: {
            sentence: ex.chinese,
            highlight: chineseHighlight,
            segments,
            targetIndex,
          },
          english: {
            sentence: ex.english,
            highlight: [],
          },
        };
      });

      return { sentences };
    } catch (error) {
      console.error('Error fetching sentences:', error);
      if (typeof offset === 'number') {
        return { sentence: null, totalCount: 0 };
      }
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
