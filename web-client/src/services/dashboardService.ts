import { getUserWords, getDueUserWords } from './wordService';
import { getStreakData, calculateStreak } from './streakService';

export interface DashboardStats {
  totalWords: number;
  dueWords: number;
  streak: number;
  bankDistribution: Record<number, number>;
  masteredCount: number;
}

export const getDashboardStats = async (
  userId: string,
  listId?: string,
): Promise<DashboardStats> => {
  const [allWords, dueWords, streakData] = await Promise.all([
    getUserWords(userId, listId),
    getDueUserWords(userId, listId),
    getStreakData(userId),
  ]);

  const bankDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const word of allWords) {
    const bank = word.bank ?? 1;
    bankDistribution[bank] = (bankDistribution[bank] || 0) + 1;
  }

  const streak = calculateStreak(streakData.map((d) => d.date));
  const masteredCount = bankDistribution[5] || 0;

  return {
    totalWords: allWords.length,
    dueWords: dueWords.length,
    streak,
    bankDistribution,
    masteredCount,
  };
};
