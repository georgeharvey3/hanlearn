import { getUserWords, getDueUserWords } from './wordService';
import { getStreakData, calculateStreak, computeWeeklyStats, WeeklyStats } from './streakService';
import { estimatePlannedTime, formatTestTime } from '../utils/estimateTestTime';
import { planSession, readSessionSettings } from '../components/Test/Logic/TestLogic';
import { traceAsync } from './performanceService';
import { BankCounts, directionBankDistribution } from '../utils/directions';
import { Direction } from '../types/models';

export interface DashboardStats {
  totalWords: number;
  dueWords: number;
  streak: number;
  levelDistribution: Record<number, number>;
  /**
   * The bank counts of each direction. The word's own level is the lowest of
   * the five, so this is what shows which skill is weak.
   */
  directionDistribution: Record<Direction, BankCounts>;
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

    const directionDistribution = directionBankDistribution(allWords);

    const streak = calculateStreak(streakData.map((d) => d.date));
    const weeklyStats = computeWeeklyStats(streakData);
    const masteredCount = levelDistribution[5] || 0;

    const dueCount = dueWords.length;
    let estimatedStudyTime: string | null = null;

    if (dueCount > 0) {
      // The session the learner would start now, planned from the words that
      // are due. The queue decides how many questions they get and which
      // directions those ask, so the estimate reads the plan rather than
      // guessing from the budget alone.
      const plan = planSession(dueWords, readSessionSettings());
      const totalSeconds = estimatePlannedTime(plan, {
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
      directionDistribution,
      masteredCount,
      estimatedStudyTime,
      weeklyStats,
    };
  });
