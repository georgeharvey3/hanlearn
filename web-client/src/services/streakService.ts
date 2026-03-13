import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  Timestamp,
  increment,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Record a test completion for today. Creates or increments the document.
 */
export const recordTestCompletion = async (userId: string): Promise<void> => {
  const dateStr = todayString();
  const docRef = doc(db, 'users', userId, 'testCompletions', dateStr);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await setDoc(
      docRef,
      { testsCount: increment(1), completedAt: Timestamp.now() },
      { merge: true },
    );
  } else {
    await setDoc(docRef, { completedAt: Timestamp.now(), testsCount: 1 });
  }
};

/**
 * Get all test completion documents for a user (sorted by date desc).
 */
export const getStreakData = async (
  userId: string,
): Promise<{ date: string; testsCount: number }[]> => {
  const colRef = collection(db, 'users', userId, 'testCompletions');
  const q = query(colRef, orderBy('completedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    date: d.id,
    testsCount: (d.data() as { testsCount: number }).testsCount,
  }));
};

/**
 * Parse a YYYY-MM-DD string as local midnight (not UTC).
 * new Date("2026-02-26") parses as UTC midnight which causes timezone bugs
 * in positive-offset timezones where local midnight is ahead of UTC midnight.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate current streak from an array of completion date strings (already sorted desc).
 */
export interface WeeklyStats {
  sessions: number;
  wordsReviewed: number;
}

/**
 * Compute weekly stats (last 7 days) from already-fetched streak data.
 * Data must be sorted descending by date.
 */
export const computeWeeklyStats = (
  data: { date: string; testsCount: number }[],
): WeeklyStats => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  let sessions = 0;
  let wordsReviewed = 0;

  for (const entry of data) {
    const entryDate = parseLocalDate(entry.date);
    if (entryDate < sevenDaysAgo) break;
    sessions++;
    wordsReviewed += entry.testsCount || 0;
  }

  return { sessions, wordsReviewed };
};

export const calculateStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecent = parseLocalDate(dates[0]);
  const diffFromToday = Math.floor(
    (today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = parseLocalDate(dates[i - 1]);
    const curr = parseLocalDate(dates[i]);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};
