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
    await setDoc(docRef, { testsCount: increment(1), completedAt: Timestamp.now() }, { merge: true });
  } else {
    await setDoc(docRef, { completedAt: Timestamp.now(), testsCount: 1 });
  }
};

/**
 * Get all test completion documents for a user (sorted by date desc).
 */
export const getStreakData = async (userId: string): Promise<{ date: string; testsCount: number }[]> => {
  const colRef = collection(db, 'users', userId, 'testCompletions');
  const q = query(colRef, orderBy('completedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    date: d.id,
    testsCount: (d.data() as { testsCount: number }).testsCount,
  }));
};

/**
 * Calculate current streak from an array of completion date strings (already sorted desc).
 */
export const calculateStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecent = new Date(dates[0]);
  mostRecent.setHours(0, 0, 0, 0);
  const diffFromToday = Math.floor((today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    prev.setHours(0, 0, 0, 0);
    curr.setHours(0, 0, 0, 0);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};
