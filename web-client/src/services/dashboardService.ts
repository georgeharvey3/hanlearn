import { getUserWords, getDueUserWords } from './wordService';
import { getStreakData, calculateStreak, computeWeeklyStats, WeeklyStats } from './streakService';
import { estimateTestTime, formatTestTime } from '../utils/estimateTestTime';
import { traceAsync } from './performanceService';

export interface DashboardStats {
  totalWords: number;
  dueWords: number;
  streak: number;
  levelDistribution: Record<number, number>;
  masteredCount: number;
  estimatedStudyTime: string | null;
  weeklyStats: WeeklyStats;
}

export const getDashboardStats = async (userId: string, listId?: string): Promise<DashboardStats> =>
  traceAsync('dashboard_stats_load', async () => {
    const [allWords, dueWords, streakData] = await Promise.all([
      getUserWords(userId, listId),
      getDueUserWords(userId, listId),
      getStreakData(userId),
    ]);

    const levelDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const word of allWords) {
      const level = word.level ?? 1;
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    }

    const streak = calculateStreak(streakData.map((d) => d.date));
    const weeklyStats = computeWeeklyStats(streakData);
    const masteredCount = levelDistribution[5] || 0;

    const dueCount = dueWords.length;
    let estimatedStudyTime: string | null = null;

    if (dueCount > 0) {
      const numWords = parseInt(localStorage.getItem('numWords') || '5', 10);
      const totalSeconds = estimateTestTime({
        numWords,
        useHandwriting: localStorage.getItem('useHandwriting') !== 'false',
        priority: localStorage.getItem('priority') || 'none',
        onlyPriority: localStorage.getItem('onlyPriority') === 'true',
        newWordsEnabled: localStorage.getItem('newWords') !== 'false',
        sentenceReadEnabled: localStorage.getItem('sentenceRead') !== 'false',
        sentenceWriteEnabled: localStorage.getItem('sentenceWrite') !== 'false',
        sentenceStagesForAllWords: localStorage.getItem('sentenceStagesForAllWords') === 'true',
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
      levelDistribution,
      masteredCount,
      estimatedStudyTime,
      weeklyStats,
    };
  });
