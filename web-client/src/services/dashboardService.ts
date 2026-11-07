import { getUserWords, getDueUserWords } from './wordService';
import { getReviewStats } from './retentionService';
import { reportError } from './errorReporting';
import { estimatePlannedTime, formatTestTime } from '../utils/estimateTestTime';
import { planSession, readSessionSettings } from '../components/Test/Logic/TestLogic';
import { traceAsync } from './performanceService';
import { loadHskIndex } from './premadeListService';
import { hskCoverage, type HskLevelCoverage } from '../utils/hskCoverage';
import { BankCounts, directionBankDistribution } from '../utils/directions';
import {
  FORECAST_DAYS,
  HISTORY_DAYS,
  SESSION_SIZES,
  SessionSize,
  sizeBudget,
  wordsDueAhead,
} from '../utils/dashboard';
import { lookbackFrom, type ReviewStatsDay } from '../utils/retention';
import { Direction, Word } from '../types/models';

/** One size of session, as the plan for it would run now. */
export interface SizePlan {
  questions: number;
  newWords: number;
  /** "~6 min". */
  time: string;
}

export interface DashboardStats {
  totalWords: number;
  dueWords: number;
  levelDistribution: Record<number, number>;
  /**
   * The bank counts of each direction. The word's own level is the lowest of
   * the five, so this is what shows which skill is weak.
   */
  directionDistribution: Record<Direction, BankCounts>;
  masteredCount: number;
  /** The usual session's time, or null when nothing is due. */
  estimatedStudyTime: string | null;
  /** The session each size would start now, planned from the words that are due. */
  sessionSizes: Record<SessionSize, SizePlan>;
  /** The words due on each of the next days; index 0 is today, with the overdue words in it. */
  forecast: number[];
  /** The daily rollups of the whole account, oldest first; days without study are absent. */
  history: ReviewStatsDay[];
}

/**
 * The session a size would start, planned from the due words. The queue
 * decides how many questions the learner gets and which directions those ask,
 * so the estimate reads the plan rather than guessing from the budget alone.
 */
function planSize(dueWords: Word[], size: SessionSize): SizePlan {
  const settings = readSessionSettings();
  const plan = planSession(dueWords, {
    ...settings,
    budget: sizeBudget(size, settings.budget, dueWords.length),
  });
  const seconds = estimatePlannedTime(plan, {
    newWordsEnabled: localStorage.getItem('newWords') !== 'false',
  });
  return {
    questions: plan.queue.length,
    newWords: plan.newWords.length,
    time: seconds >= 3600 ? '~60+ min' : formatTestTime(seconds),
  };
}

/**
 * The history is for the calendar and the charts only. A failed read of it
 * leaves those empty rather than the whole Dashboard on an error.
 */
async function readHistory(userId: string): Promise<ReviewStatsDay[]> {
  try {
    return await getReviewStats(userId, lookbackFrom(new Date(), HISTORY_DAYS));
  } catch (err) {
    reportError(err, { feature: 'dashboard-history' });
    return [];
  }
}

export const getDashboardStats = async (userId: string, listId?: string): Promise<DashboardStats> =>
  traceAsync('dashboard_stats_load', async () => {
    const [allWords, dueWords, history] = await Promise.all([
      getUserWords(userId, listId),
      getDueUserWords(userId, listId),
      readHistory(userId),
    ]);

    const levelDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const word of allWords) {
      const level = word.level ?? 1;
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    }

    const directionDistribution = directionBankDistribution(allWords);
    const masteredCount = levelDistribution[5] || 0;

    const sessionSizes = SESSION_SIZES.reduce(
      (acc, size) => {
        acc[size] = planSize(dueWords, size);
        return acc;
      },
      {} as Record<SessionSize, SizePlan>,
    );

    const forecast = wordsDueAhead(allWords, FORECAST_DAYS, new Date());

    return {
      totalWords: allWords.length,
      dueWords: dueWords.length,
      levelDistribution,
      directionDistribution,
      masteredCount,
      estimatedStudyTime: dueWords.length > 0 ? sessionSizes.usual.time : null,
      sessionSizes,
      forecast,
      history,
    };
  });

/**
 * The HSK coverage of the whole collection, whatever list is active, or null
 * when the collection is empty. The Dashboard asks for it after its stats
 * load, so it never delays the Today card.
 */
export const getHskCoverage = async (userId: string): Promise<HskLevelCoverage[] | null> => {
  const [index, words] = await Promise.all([loadHskIndex(), getUserWords(userId)]);
  return words.length > 0 ? hskCoverage(index, words) : null;
};
