import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '../firebase/config';
import { reportError } from './errorReporting';
import { PracticeByWord, SentenceResult, TabPractice } from '../utils/sentenceQueue';
import {
  SentenceGrade,
  sentenceLogDocument,
  sentencePracticeUpdate,
} from '../utils/sentencePracticeDocuments';

export type { SentenceGrade } from '../utils/sentencePracticeDocuments';

/**
 * The Firestore side of the Comprehend and Compose tabs (#489).
 *
 * `users/{uid}/sentencePractice/{wordId}` holds the queue state of a word: one
 * entry for each tab that practised it. It lives outside `userWords`, so the
 * documents of the scheduler and their rules carry no sentence state.
 *
 * `users/{uid}/sentenceLog/{autoId}` holds one write-once entry for each grade,
 * to measure the tabs. See docs/adr/0021-sentence-tasks-are-a-separate-practice.md.
 */

interface StoredTabPractice {
  lastPractised: Timestamp;
  lastResult: SentenceResult;
  seen?: Record<string, Timestamp>;
}

const fromStored = (stored: StoredTabPractice): TabPractice => ({
  lastPractised: stored.lastPractised.toDate().toISOString(),
  lastResult: stored.lastResult,
  seen: Object.fromEntries(
    Object.entries(stored.seen ?? {}).map(([id, at]) => [id, at.toDate().toISOString()]),
  ),
});

/** Read the queue state of every word, with one query. */
export async function loadPractice(userId: string): Promise<PracticeByWord> {
  const snapshot = await getDocs(collection(db, 'users', userId, 'sentencePractice'));
  const practice: PracticeByWord = {};
  for (const document of snapshot.docs) {
    const data = document.data() as Record<string, StoredTabPractice | undefined>;
    const entry: PracticeByWord[string] = {};
    for (const tab of ['comprehend', 'compose'] as const) {
      const stored = data[tab];
      if (stored) entry[tab] = fromStored(stored);
    }
    practice[document.id] = entry;
  }
  return practice;
}

/**
 * Save one grade: first the queue state, then the log entry.
 *
 * The queue state is the save, so the log entry waits for it: no entry
 * describes a grade that was not saved. A failed log write is reported and
 * does not reject the grade. With no network connection, Firestore holds the
 * writes until it is back, so the caller does not wait for this promise.
 */
export async function saveGrade(userId: string, grade: SentenceGrade): Promise<void> {
  const at = Timestamp.fromDate(grade.at);

  await setDoc(
    doc(db, 'users', userId, 'sentencePractice', String(grade.wordId)),
    sentencePracticeUpdate(grade, at),
    { merge: true },
  );

  await setDoc(
    doc(collection(db, 'users', userId, 'sentenceLog')),
    sentenceLogDocument(grade, at),
  ).catch((error) => {
    reportError(error, { feature: 'sentence-log' });
  });
}
