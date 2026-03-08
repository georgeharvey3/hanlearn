import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Word } from '../types/models';
import {
  searchWord as searchDictionary,
  lookupCharacter,
  lookupCharacterByTrad,
} from './dictionaryService';
import { amendedMeaningSchema, customWordTextSchema, customWordMeaningSchema } from '../validation/schemas';

// Spaced repetition intervals in days for each bank level
const BANK_INTERVALS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 30,
  5: 60,
};

interface UserWordDocument {
  wordId: string;
  wordData: {
    simp: string;
    trad: string;
    pinyin: string;
    meaning: string;
  };
  amendedMeaning: string | null;
  bank: number;
  dueDate: Timestamp;
  addedAt: Timestamp;
}

function mapDocumentToWord(
  doc: { id: string; data: () => UserWordDocument },
  includeDueDate = false,
): Word {
  const data = doc.data();
  const word: Word = {
    id: parseInt(doc.id),
    simp: data.wordData.simp,
    trad: data.wordData.trad,
    pinyin: data.wordData.pinyin,
    meaning: data.amendedMeaning || data.wordData.meaning,
    bank: data.bank,
    ammended_meaning: data.amendedMeaning || undefined,
  };
  if (includeDueDate) {
    word.due_date = formatDate(data.dueDate.toDate());
  }
  return word;
}

/**
 * Get all words in a user's word bank, sorted by due date
 */
export const getUserWords = async (userId: string): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const q = query(userWordsRef, orderBy('dueDate', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocumentToWord(doc as any, true));
};

/**
 * Get words that are due for review (due date <= today)
 */
export const getDueUserWords = async (userId: string): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const now = Timestamp.now();
  const q = query(userWordsRef, where('dueDate', '<=', now));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocumentToWord(doc as any));
};

/**
 * Add a word from the dictionary to the user's word bank
 */
export const addWordToBank = async (userId: string, word: Word): Promise<void> => {
  // Get count of existing words to determine initial due date
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const snapshot = await getDocs(userWordsRef);
  const wordCount = snapshot.size;

  // If more than 9 words, set due date to tomorrow; otherwise today
  const dueDate = new Date();
  if (wordCount > 9) {
    dueDate.setDate(dueDate.getDate() + 1);
  }

  const userWordRef = doc(db, 'users', userId, 'userWords', word.id.toString());
  await setDoc(userWordRef, {
    wordId: word.id.toString(),
    wordData: {
      simp: word.simp,
      trad: word.trad,
      pinyin: word.pinyin,
      meaning: word.meaning,
    },
    amendedMeaning: null,
    bank: 1,
    dueDate: Timestamp.fromDate(dueDate),
    addedAt: Timestamp.now(),
  });
};

/**
 * Remove a word from the user's word bank
 */
export const removeWordFromBank = async (userId: string, wordId: number): Promise<void> => {
  const wordRef = doc(db, 'users', userId, 'userWords', wordId.toString());
  await deleteDoc(wordRef);
};

/**
 * Update the meaning for a word in the user's bank
 */
export const updateWordMeaning = async (
  userId: string,
  wordId: number,
  newMeaning: string,
): Promise<void> => {
  const parsed = amendedMeaningSchema.parse(newMeaning);
  const wordRef = doc(db, 'users', userId, 'userWords', wordId.toString());
  await updateDoc(wordRef, { amendedMeaning: parsed });
};

/**
 * Submit test results and update bank levels and due dates
 */
export const finishTest = async (
  userId: string,
  scores: { word_id: number; score: number }[],
): Promise<Record<string, string>> => {
  const newDates: Record<string, string> = {};
  const batch = writeBatch(db);

  for (const { word_id, score } of scores) {
    const wordRef = doc(db, 'users', userId, 'userWords', word_id.toString());
    const wordDoc = await getDoc(wordRef);

    if (!wordDoc.exists()) continue;

    const data = wordDoc.data() as UserWordDocument;
    let bank = data.bank;

    // Update bank based on score
    if (score === 4 && bank < 5) {
      bank += 1;
    } else if (score < 4) {
      bank = 1;
    }

    // Calculate new due date
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + BANK_INTERVALS[bank]);

    batch.update(wordRef, {
      bank,
      dueDate: Timestamp.fromDate(newDueDate),
    });

    newDates[data.wordData.simp] = formatDate(newDueDate);
  }

  await batch.commit();
  return newDates;
};

/**
 * Search for a word in the dictionary by character.
 * Uses static dictionary JSON instead of Firestore for cost efficiency.
 */
export const searchWord = async (character: string, charSet: 'simp' | 'trad'): Promise<Word[]> => {
  return searchDictionary(character, charSet);
};

/**
 * Add a custom word that isn't in the dictionary.
 * Constructs pinyin and the counterpart character set from constituent character lookups
 * using the static dictionary. Supports both simplified and traditional input.
 */
export const addCustomWord = async (
  userId: string,
  text: string,
  meaning: string,
  charSet: 'simp' | 'trad' = 'simp',
): Promise<Word> => {
  const validatedText = customWordTextSchema.parse(text);
  const validatedMeaning = customWordMeaningSchema.parse(meaning);

  let pinyin = '';
  let simp = '';
  let trad = '';

  for (let i = 0; i < validatedText.length; i++) {
    const char = validatedText[i];

    if (charSet === 'simp') {
      const charData = await lookupCharacter(char);
      if (charData) {
        if (pinyin && charData.pinyin) pinyin += ' ';
        pinyin += charData.pinyin || '';
        simp += char;
        trad += charData.trad || char;
      } else {
        simp += char;
        trad += char;
      }
    } else {
      const charData = await lookupCharacterByTrad(char);
      if (charData) {
        if (pinyin && charData.pinyin) pinyin += ' ';
        pinyin += charData.pinyin || '';
        simp += charData.simp || char;
        trad += char;
      } else {
        simp += char;
        trad += char;
      }
    }
  }

  // Generate a unique ID for the custom word (negative to avoid collision with dictionary IDs)
  const wordId = -Date.now();

  // Add to user's word bank (custom words are stored directly in userWords, not in a global words collection)
  const word: Word = {
    id: wordId,
    simp,
    trad,
    pinyin,
    meaning: validatedMeaning,
  };
  await addWordToBank(userId, word);

  return word;
};

/**
 * Format a date as YYYY/MM/DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
