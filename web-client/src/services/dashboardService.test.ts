import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboardStats } from './dashboardService';
import * as wordService from './wordService';
import * as streakService from './streakService';
import { Word } from '../types/models';

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));
vi.mock('./wordService');
vi.mock('./streakService');
vi.mock('./performanceService', () => ({
  traceAsync: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

const mockedWordService = vi.mocked(wordService);
const mockedStreakService = vi.mocked(streakService);

function makeWord(id: number, level: number): Word {
  return {
    id,
    simp: `字${id}`,
    trad: `字${id}`,
    pinyin: 'pīn',
    meaning: 'meaning',
    level,
    due_date: '2026/02/27',
  };
}

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // calculateStreak is a real function imported by dashboardService;
    // mock it to return a fixed value for determinism
    mockedStreakService.calculateStreak.mockReturnValue(3);
    mockedStreakService.getStreakData.mockResolvedValue([
      { date: '2026-02-25', testsCount: 1 },
      { date: '2026-02-26', testsCount: 1 },
      { date: '2026-02-27', testsCount: 1 },
    ]);
  });

  it('returns correct totalWords count', async () => {
    const allWords = [makeWord(1, 1), makeWord(2, 2), makeWord(3, 5)];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([allWords[0]]);

    const stats = await getDashboardStats('user-1');

    expect(stats.totalWords).toBe(3);
  });

  it('returns correct dueWords count', async () => {
    const allWords = [makeWord(1, 1), makeWord(2, 2), makeWord(3, 5)];
    const due = [allWords[0], allWords[1]];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue(due);

    const stats = await getDashboardStats('user-1');

    expect(stats.dueWords).toBe(2);
  });

  it('computes levelDistribution correctly', async () => {
    const allWords = [
      makeWord(1, 1),
      makeWord(2, 1),
      makeWord(3, 3),
      makeWord(4, 5),
      makeWord(5, 5),
    ];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.levelDistribution[1]).toBe(2);
    expect(stats.levelDistribution[2]).toBe(0);
    expect(stats.levelDistribution[3]).toBe(1);
    expect(stats.levelDistribution[4]).toBe(0);
    expect(stats.levelDistribution[5]).toBe(2);
  });

  it('counts masteredCount from level 5 words', async () => {
    const allWords = [makeWord(1, 5), makeWord(2, 5), makeWord(3, 3)];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.masteredCount).toBe(2);
  });

  it('treats missing level as level 1 in distribution', async () => {
    const wordWithoutLevel: Word = {
      id: 99,
      simp: '字',
      trad: '字',
      pinyin: 'zì',
      meaning: 'character',
      // level is undefined
    };
    mockedWordService.getUserWords.mockResolvedValue([wordWithoutLevel]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.levelDistribution[1]).toBe(1);
  });

  it('returns streak from streakService', async () => {
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);
    mockedStreakService.calculateStreak.mockReturnValue(5);

    const stats = await getDashboardStats('user-1');

    expect(stats.streak).toBe(5);
  });

  it('masteredCount is 0 when no words are at level 5', async () => {
    const allWords = [makeWord(1, 1), makeWord(2, 2), makeWord(3, 3)];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.masteredCount).toBe(0);
  });

  it('returns zero stats for empty word list', async () => {
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);
    mockedStreakService.calculateStreak.mockReturnValue(0);

    const stats = await getDashboardStats('user-1');

    expect(stats.totalWords).toBe(0);
    expect(stats.dueWords).toBe(0);
    expect(stats.masteredCount).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.levelDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('calls all three services in parallel with the given userId', async () => {
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    await getDashboardStats('user-abc');

    expect(mockedWordService.getUserWords).toHaveBeenCalledWith('user-abc', undefined);
    expect(mockedWordService.getDueUserWords).toHaveBeenCalledWith('user-abc', undefined);
    expect(mockedStreakService.getStreakData).toHaveBeenCalledWith('user-abc');
  });

  it('returns null estimatedStudyTime when no words are due', async () => {
    mockedWordService.getUserWords.mockResolvedValue([makeWord(1, 1)]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.estimatedStudyTime).toBeNull();
  });

  it('returns a formatted estimatedStudyTime when words are due', async () => {
    const dueWords = [makeWord(1, 1), makeWord(2, 1), makeWord(3, 1)];
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    expect(stats.estimatedStudyTime).toMatch(/min/);
  });

  it('caps the estimate at the questions the budget allows', async () => {
    // One direction only, so every question costs the same and the estimate is
    // the budget times that cost.
    localStorage.setItem('questionsPerSession', '10');
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    localStorage.setItem('newWords', 'false');
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    const dueWords = Array.from({ length: 20 }, (_, i) => makeWord(i + 1, 1));
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // 10 questions of MP at 8s = 80s
    expect(stats.estimatedStudyTime).toBe('~2 min');
  });

  it('estimates the shorter session when fewer words are due than the budget', async () => {
    localStorage.setItem('questionsPerSession', '50');
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    localStorage.setItem('newWords', 'false');
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    const dueWords = [makeWord(1, 1), makeWord(2, 1), makeWord(3, 1)];
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // One question for each of the 3 due words: 24s
    expect(stats.estimatedStudyTime).toBe('< 1 min');
  });

  it('migrates the old words per session setting into the budget', async () => {
    localStorage.setItem('numWords', '2');
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    localStorage.setItem('newWords', 'false');
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    const dueWords = Array.from({ length: 20 }, (_, i) => makeWord(i + 1, 1));
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // 2 words becomes 10 questions, and 10 MP questions take 80s.
    expect(stats.estimatedStudyTime).toBe('~2 min');
  });

  it('counts the stages the session runs for its new words', async () => {
    localStorage.setItem('questionsPerSession', '10');
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    localStorage.setItem('newWords', 'true');
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    const dueWords = Array.from({ length: 20 }, (_, i) => makeWord(i + 1, 1));
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // Every word is at level 1, so all 10 are new: 80s of questions and 50s of
    // the Learn step.
    expect(stats.estimatedStudyTime).toBe('~3 min');
  });
});
