import { getUserWords, getDueUserWords } from './wordService';
import { getStreakData, calculateStreak } from './streakService';
import { estimateTestTime, formatTestTime } from '../utils/estimateTestTime';

export interface DashboardStats {
  totalWords: number;
  dueWords: number;
  streak: number;
  bankDistribution: Record<number, number>;
  masteredCount: number;
  estimatedStudyTime: string | null;
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

  const dueCount = dueWords.length;
  let estimatedStudyTime: string | null = null;

  if (dueCount > 0) {
    const numWords = Math.min(dueCount, parseInt(localStorage.getItem('numWords') || '10', 10));
    const totalSeconds = estimateTestTime({
      numWords,
      useHandwriting: localStorage.getItem('useHandwriting') === 'true',
      priority: localStorage.getItem('priority') || 'none',
      onlyPriority: localStorage.getItem('onlyPriority') === 'true',
      newWordsEnabled: localStorage.getItem('newWords') !== 'false',
      sentenceReadEnabled: localStorage.getItem('sentenceRead') === 'true',
      sentenceWriteEnabled: localStorage.getItem('sentenceWrite') === 'true',
    });

    if (totalSeconds >= 3600) {
      estimatedStudyTime = '~60+ min';
    } else {
      estimatedStudyTime = formatTestTime(totalSeconds);
    }
  }

  return {
    totalWords: allWords.length,
    dueWords: dueCount,
    streak,
    bankDistribution,
    masteredCount,
    estimatedStudyTime,
  };
};
