import {
  collection,
  doc,
  addDoc,
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
import { Word, WordList } from '../types/models';
import {
  searchWord as searchDictionary,
  lookupCharacter,
  lookupCharacterByTrad,
} from './dictionaryService';
import {
  amendedMeaningSchema,
  customWordTextSchema,
  customWordMeaningSchema,
} from '../validation/schemas';

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
  listId?: string;
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
    listId: data.listId || 'default',
  };
  if (includeDueDate) {
    word.due_date = formatDate(data.dueDate.toDate());
  }
  return word;
}

// ─── Word List CRUD ──────────────────────────────────────────────────────────

/**
 * Get all word lists for a user. Always includes the built-in "General" list.
 */
export const getUserWordLists = async (userId: string): Promise<WordList[]> => {
  const listsRef = collection(db, 'users', userId, 'wordLists');
  const q = query(listsRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);

  const lists: WordList[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      createdAt: data.createdAt?.toDate?.()
        ? formatDate(data.createdAt.toDate())
        : '',
      order: data.order ?? 0,
    };
  });

  // Ensure the default list is always present
  if (!lists.find((l) => l.id === 'default')) {
    lists.unshift({
      id: 'default',
      name: 'General',
      createdAt: '',
      order: 0,
    });
  }

  return lists;
};

/**
 * Create a new word list
 */
export const createWordList = async (
  userId: string,
  name: string,
): Promise<WordList> => {
  // Get current lists to determine next order value
  const listsRef = collection(db, 'users', userId, 'wordLists');
  const snapshot = await getDocs(listsRef);
  const maxOrder = snapshot.docs.reduce((max, doc) => {
    const order = doc.data().order ?? 0;
    return order > max ? order : max;
  }, 0);

  const listData = {
    name,
    createdAt: Timestamp.now(),
    order: maxOrder + 1,
  };

  const docRef = await addDoc(listsRef, listData);

  return {
    id: docRef.id,
    name,
    createdAt: formatDate(new Date()),
    order: maxOrder + 1,
  };
};

/**
 * Rename a word list
 */
export const renameWordList = async (
  userId: string,
  listId: string,
  newName: string,
): Promise<void> => {
  const listRef = doc(db, 'users', userId, 'wordLists', listId);
  await updateDoc(listRef, { name: newName });
};

/**
 * Delete a word list and all its words
 */
export const deleteWordList = async (
  userId: string,
  listId: string,
): Promise<void> => {
  if (listId === 'default') {
    throw new Error('Cannot delete the default word list');
  }

  // Delete all words in this list
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const q = query(userWordsRef, where('listId', '==', listId));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((wordDoc) => {
    batch.delete(wordDoc.ref);
  });

  // Delete the list document itself
  const listRef = doc(db, 'users', userId, 'wordLists', listId);
  batch.delete(listRef);

  await batch.commit();
};

// ─── Word Operations ─────────────────────────────────────────────────────────

/**
 * Get all words in a user's word bank, sorted by due date.
 * Optionally filtered by listId.
 */
export const getUserWords = async (
  userId: string,
  listId?: string,
): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  let q;
  if (listId) {
    q = query(
      userWordsRef,
      where('listId', '==', listId),
      orderBy('dueDate', 'asc'),
    );
  } else {
    q = query(userWordsRef, orderBy('dueDate', 'asc'));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocumentToWord(doc as any, true));
};

/**
 * Get words that are due for review (due date <= today).
 * Optionally filtered by listId.
 */
export const getDueUserWords = async (
  userId: string,
  listId?: string,
): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const now = Timestamp.now();
  let q;
  if (listId) {
    q = query(
      userWordsRef,
      where('listId', '==', listId),
      where('dueDate', '<=', now),
    );
  } else {
    q = query(userWordsRef, where('dueDate', '<=', now));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocumentToWord(doc as any));
};

/**
 * Add a word from the dictionary to the user's word bank
 */
export const addWordToBank = async (
  userId: string,
  word: Word,
  listId: string = 'default',
): Promise<void> => {
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
    listId,
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
  listId: string = 'default',
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
    listId,
  };
  await addWordToBank(userId, word, listId);

  return word;
};

/**
 * Move a word to a different list
 */
export const moveWordToList = async (
  userId: string,
  wordId: number,
  newListId: string,
): Promise<void> => {
  const wordRef = doc(db, 'users', userId, 'userWords', wordId.toString());
  await updateDoc(wordRef, { listId: newListId });
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
