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
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  DIRECTIONS,
  Direction,
  DirectionState,
  DirectionStates,
  Word,
  WordDirectionResults,
  WordList,
} from '../types/models';
import { fillDirections } from '../utils/directions';
import {
  bankOf,
  currentMemory,
  dueDateFrom,
  elapsedDays,
  nextLapses,
  nextMemory,
} from '../utils/scheduling';
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

interface StoredDirectionState {
  /**
   * Derived from the interval. It stays in the document because the read path,
   * the dashboard and `isNewWord` all read a bank, and because a document
   * written before the interval existed holds nothing else to schedule from.
   */
  bank: number;
  dueDate: Timestamp;
  /**
   * The days after which the recall probability of this direction is 0.9.
   * Absent reads as the interval, which measures the same thing.
   */
  stability?: number;
  /** How much one review moves the stability, from 1 to 10. Absent reads from the ease. */
  difficulty?: number;
  /**
   * Days between one review of this direction and the next. Absent reads as the
   * interval of the bank, so a document written before the field existed keeps
   * the schedule it had and needs no migration.
   */
  interval?: number;
  /**
   * The multiplier of the calculation that FSRS replaced. It is read and not
   * written: a direction that holds an ease seeds its difficulty from it.
   */
  ease?: number;
  /** When this direction was last reviewed. Absent gives a review no delay credit. */
  lastReview?: Timestamp;
  /**
   * How many tone errors this direction has collected, over every session that
   * asked it. Absent reads as 0, so a document written before the counter
   * existed needs no migration.
   */
  toneErrors?: number;
  /**
   * How many times the learner has failed to recall this direction after
   * learning it. Absent reads as 0, so a document written before the counter
   * existed needs no migration, and it starts counting from its next failure.
   */
  lapses?: number;
}

interface UserWordDocument {
  wordId: string;
  wordData: {
    simp: string;
    trad: string;
    pinyin: string;
    meaning: string;
  };
  amendedMeaning: string | null;
  // `bank` and `dueDate` are derived: the lowest bank and the earliest due date
  // across the directions. They stay at the top level because Firestore cannot
  // range-query five map fields, so getDueUserWords, getListStats and
  // getDashboardStats keep their existing queries and indexes.
  bank: number;
  dueDate: Timestamp;
  addedAt: Timestamp;
  listId?: string;
  directions?: Partial<Record<Direction, StoredDirectionState>>;
}

/**
 * Read the stored directions map into the client shape, converting each
 * Timestamp to a date string. A document written before the map existed has no
 * `directions` field, and fillDirections then derives all five entries from the
 * top-level bank and due date.
 */
function readDirections(data: UserWordDocument): DirectionStates {
  const stored: Partial<Record<Direction, Partial<DirectionState>>> = {};
  for (const direction of DIRECTIONS) {
    const entry = data.directions?.[direction];
    if (!entry) continue;
    stored[direction] = {
      level: entry.bank,
      dueDate: entry.dueDate ? formatDate(entry.dueDate.toDate()) : undefined,
      lapses: entry.lapses,
    };
  }
  return fillDirections(stored, data.bank, formatDate(data.dueDate.toDate()));
}

/**
 * Build the stored form of a directions map, with every direction at the same
 * bank and due date.
 */
function storedDirections(
  bank: number,
  dueDate: Timestamp,
): Record<Direction, StoredDirectionState> {
  return DIRECTIONS.reduce(
    (acc, direction) => {
      acc[direction] = { bank, dueDate };
      return acc;
    },
    {} as Record<Direction, StoredDirectionState>,
  );
}

/**
 * The stored directions of a document, with any direction the document lacks
 * derived from its top-level bank and due date. A document the migration has
 * not reached yet therefore behaves exactly like one it has.
 */
function currentDirections(data: UserWordDocument): Record<Direction, StoredDirectionState> {
  const derived = storedDirections(data.bank, data.dueDate);
  const stored = data.directions;
  if (!stored) return derived;
  return DIRECTIONS.reduce(
    (acc, direction) => {
      acc[direction] = stored[direction] ?? derived[direction];
      return acc;
    },
    {} as Record<Direction, StoredDirectionState>,
  );
}

/** The lowest bank across the directions. Written to the derived top-level field. */
function lowestBank(directions: Record<Direction, StoredDirectionState>): number {
  return DIRECTIONS.reduce((min, direction) => Math.min(min, directions[direction].bank), 5);
}

/** The earliest due date across the directions. Written to the derived top-level field. */
function earliestDueDate(directions: Record<Direction, StoredDirectionState>): Timestamp {
  return DIRECTIONS.map((direction) => directions[direction].dueDate).reduce((earliest, dueDate) =>
    dueDate.toDate().getTime() < earliest.toDate().getTime() ? dueDate : earliest,
  );
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
    level: data.bank,
    ammended_meaning: data.amendedMeaning || undefined,
    listId: data.listId || 'default',
    // Always present, whatever includeDueDate asks for: the session queue reads
    // the per-direction due dates from words that getDueUserWords returned.
    directions: readDirections(data),
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
      createdAt: data.createdAt?.toDate?.() ? formatDate(data.createdAt.toDate()) : '',
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
export const createWordList = async (userId: string, name: string): Promise<WordList> => {
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
export const deleteWordList = async (userId: string, listId: string): Promise<void> => {
  if (listId === 'default') {
    throw new Error('Cannot delete the default word list');
  }

  // Delete all words in this list (chunk into batches of 499 to stay under the 500 limit)
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const q = query(userWordsRef, where('listId', '==', listId));
  const snapshot = await getDocs(q);

  const BATCH_LIMIT = 499; // Reserve 1 slot for the list document in the final batch
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const isLastChunk = i + BATCH_LIMIT >= snapshot.docs.length;

    const batch = writeBatch(db);
    chunk.forEach((wordDoc) => {
      batch.delete(wordDoc.ref);
    });

    // Include the list document deletion in the final batch
    if (isLastChunk) {
      const listRef = doc(db, 'users', userId, 'wordLists', listId);
      batch.delete(listRef);
    }

    await batch.commit();
  }

  // If there were no words, still delete the list document
  if (snapshot.docs.length === 0) {
    const listRef = doc(db, 'users', userId, 'wordLists', listId);
    const batch = writeBatch(db);
    batch.delete(listRef);
    await batch.commit();
  }
};

// ─── Word Operations ─────────────────────────────────────────────────────────

/**
 * Get all words in a user's word list, sorted by due date.
 * Optionally filtered by listId.
 */
export const getUserWords = async (userId: string, listId?: string): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  let q;
  if (listId) {
    q = query(userWordsRef, where('listId', '==', listId), orderBy('dueDate', 'asc'));
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
export const getDueUserWords = async (userId: string, listId?: string): Promise<Word[]> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const now = Timestamp.fromDate(endOfToday);
  let q;
  if (listId) {
    q = query(userWordsRef, where('listId', '==', listId), where('dueDate', '<=', now));
  } else {
    q = query(userWordsRef, where('dueDate', '<=', now));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocumentToWord(doc as any));
};

/**
 * Add a word from the dictionary to the user's word list
 */
export const addWordToList = async (
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

  const dueTimestamp = Timestamp.fromDate(dueDate);
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
    // A new word starts at bank 1 in all five directions, so the two derived
    // fields are the same values.
    bank: 1,
    dueDate: dueTimestamp,
    directions: storedDirections(1, dueTimestamp),
    addedAt: Timestamp.now(),
    listId,
  });
};

/**
 * Remove a word from the user's word list
 */
export const removeWordFromList = async (userId: string, wordId: number): Promise<void> => {
  const wordRef = doc(db, 'users', userId, 'userWords', wordId.toString());
  await deleteDoc(wordRef);
};

/**
 * Update the meaning for a word in the user's list
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
 * Submit the results of a session and reschedule the directions it asked.
 *
 * Each direction carries its own memory state and due date, so a failure in one
 * leaves the other four untouched. A direction the session did not ask is
 * absent from the payload and keeps the state it already holds.
 *
 * FSRS reads the stability, the difficulty and the days since the last review,
 * and it gives the day on which the recall probability falls to the target
 * retention. See docs/adr/0009-fsrs.md.
 *
 * The tone errors of a direction are added to the count it already holds, in
 * the same batch that writes the interval, and so are the failed retrievals
 * that the leech rule counts. See
 * docs/adr/0010-partial-demotion-and-leeches.md.
 *
 * Returns the new derived due date of each word, keyed by its simplified form.
 */
export const finishTest = async (
  userId: string,
  results: WordDirectionResults[],
): Promise<Record<string, string>> => {
  const newDates: Record<string, string> = {};
  const batch = writeBatch(db);
  // One clock for the whole session, so every direction of every word measures
  // its elapsed days and its next due date from the same instant.
  const now = new Date();

  for (const { word_id, directions, toneErrors } of results) {
    const wordRef = doc(db, 'users', userId, 'userWords', word_id.toString());
    const wordDoc = await getDoc(wordRef);

    if (!wordDoc.exists()) continue;

    const data = wordDoc.data() as UserWordDocument;
    const updated = { ...currentDirections(data) };

    for (const direction of DIRECTIONS) {
      const result = directions[direction];
      // Absent means the session did not ask this direction, so it keeps its state.
      if (!result) continue;

      const current = updated[direction];
      const memory = currentMemory(current);
      const elapsed = elapsedDays(current.lastReview?.toDate(), now, memory.interval);
      const next = nextMemory(memory, result, elapsed, now);

      const collected = (current.toneErrors ?? 0) + (toneErrors?.[direction] ?? 0);
      const lapses = nextLapses(current.lapses ?? 0, memory, result);

      updated[direction] = {
        // The bank is derived from the interval, and it is written in the same
        // object, so the two never disagree.
        bank: bankOf(next.interval),
        dueDate: Timestamp.fromDate(dueDateFrom(next.interval, now)),
        stability: next.stability,
        difficulty: next.difficulty,
        interval: next.interval,
        lastReview: Timestamp.fromDate(now),
        // A direction that has never collected a tone error stays without the
        // field, so a session of correct tones writes nothing new.
        ...(collected > 0 ? { toneErrors: collected } : {}),
        // The same for the failed retrievals, which the leech rule counts.
        ...(lapses > 0 ? { lapses } : {}),
      };
    }

    const derivedDueDate = earliestDueDate(updated);

    batch.update(wordRef, {
      directions: updated,
      // Both derived fields are rewritten in the same batch as the directions,
      // so the queryable values never disagree with the map.
      bank: lowestBank(updated),
      dueDate: derivedDueDate,
    });

    newDates[data.wordData.simp] = formatDate(derivedDueDate.toDate());
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
  charSet: 'simp' | 'trad' = 'trad',
  listId: string = 'default',
): Promise<Word> => {
  const validatedText = customWordTextSchema.parse(text);
  const validatedMeaning = customWordMeaningSchema.parse(meaning);

  let pinyin = '';
  let simp = '';
  let trad = '';

  const lookupFn = charSet === 'simp' ? lookupCharacter : lookupCharacterByTrad;

  for (let i = 0; i < validatedText.length; i++) {
    const char = validatedText[i];
    const charData = await lookupFn(char);

    if (charData) {
      if (pinyin && charData.pinyin) pinyin += ' ';
      pinyin += charData.pinyin || '';
      // Each lookup gives the counterpart of the character set that it reads.
      const counterpart = 'trad' in charData ? charData.trad : charData.simp;
      if (charSet === 'simp') {
        simp += char;
        trad += counterpart || char;
      } else {
        trad += char;
        simp += counterpart || char;
      }
    } else {
      simp += char;
      trad += char;
    }
  }

  // Generate a unique ID for the custom word (negative to avoid collision with dictionary IDs)
  const wordId = -Date.now();

  // Add to user's word list (custom words are stored directly in userWords, not in a global words collection)
  const word: Word = {
    id: wordId,
    simp,
    trad,
    pinyin,
    meaning: validatedMeaning,
    listId,
  };
  await addWordToList(userId, word, listId);

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
 * Get word counts (total and due) grouped by list for all of a user's words.
 * Used to show due-count badges across all lists without loading every word into Redux.
 */
export const getListStats = async (
  userId: string,
): Promise<Record<string, { due: number; total: number }>> => {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const snapshot = await getDocs(userWordsRef);

  const stats: Record<string, { due: number; total: number }> = {};
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  snapshot.docs.forEach((d) => {
    const data = d.data() as UserWordDocument;
    const listId = data.listId || 'default';
    if (!stats[listId]) stats[listId] = { due: 0, total: 0 };
    stats[listId].total++;

    if (data.dueDate) {
      const dueDate = data.dueDate.toDate();
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate <= now) {
        stats[listId].due++;
      }
    }
  });

  return stats;
};

type WordMigration = 'listId' | 'directions';

/** The fields one migration pass can add to a userWords document. */
type WordMigrationUpdate = {
  listId?: string;
  directions?: Record<Direction, StoredDirectionState>;
};

/**
 * Backfill missing fields on a user's userWords documents in a single pass.
 *
 * Each migration is idempotent: a document is written only when it is missing
 * the field the migration adds, and a document that is already complete costs
 * nothing beyond the read. The migrations share one pass because each of them
 * reads the whole collection, so running them together halves the reads.
 */
async function runWordMigrations(userId: string, migrations: WordMigration[]): Promise<number> {
  const userWordsRef = collection(db, 'users', userId, 'userWords');
  const snapshot = await getDocs(userWordsRef);

  const backfillListId = migrations.includes('listId');
  const backfillDirections = migrations.includes('directions');

  const updates: { ref: DocumentReference; data: WordMigrationUpdate }[] = [];

  for (const d of snapshot.docs) {
    const data = d.data() as UserWordDocument;
    const update: WordMigrationUpdate = {};

    if (backfillListId && !data.listId) {
      update.listId = 'default';
    }

    if (backfillDirections) {
      const existing = data.directions;
      const isComplete = existing !== undefined && DIRECTIONS.every((dir) => existing[dir]);
      if (!isComplete) {
        // Copy the single bank and due date into every direction the document
        // is missing, and keep any direction it already holds.
        const derived = storedDirections(data.bank ?? 1, data.dueDate ?? Timestamp.now());
        update.directions = { ...derived, ...(existing ?? {}) };
      }
    }

    if (Object.keys(update).length > 0) {
      updates.push({ ref: d.ref, data: update });
    }
  }

  if (updates.length === 0) return 0;

  // Firestore batches are limited to 500 operations
  for (let i = 0; i < updates.length; i += 500) {
    const batch = writeBatch(db);
    for (const { ref, data } of updates.slice(i, i + 500)) {
      batch.update(ref, data);
    }
    await batch.commit();
  }

  return updates.length;
}

/**
 * Backfill listId='default' on any userWords documents that lack a listId field.
 * Safe to call multiple times — only writes to docs that need updating.
 *
 * The app runs this together with the directions backfill through
 * migrateUserWords. It stays exported so that either backfill can be run alone.
 */
export const migrateWordsWithoutListId = async (userId: string): Promise<number> => {
  return runWordMigrations(userId, ['listId']);
};

/**
 * Backfill the per-direction scheduling map on any userWords documents written
 * before it existed, copying the single bank and due date into all five
 * directions. Safe to call multiple times — only writes to docs that need it.
 *
 * The read path synthesizes the same values for a document this has not reached
 * yet, so this migration is a cleanup rather than a prerequisite.
 */
export const migrateWordsWithoutDirections = async (userId: string): Promise<number> => {
  return runWordMigrations(userId, ['directions']);
};

/**
 * Run every userWords migration in one pass. This is what the app calls on load.
 * Returns the number of documents written.
 */
export const migrateUserWords = async (userId: string): Promise<number> => {
  return runWordMigrations(userId, ['listId', 'directions']);
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
