import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboardStats } from './dashboardService';
import * as wordService from './wordService';
import * as streakService from './streakService';
import { Word } from '../types/models';

vi.mock('../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('./wordService');
vi.mock('./streakService');

const mockedWordService = vi.mocked(wordService);
const mockedStreakService = vi.mocked(streakService);

function makeWord(id: number, bank: number): Word {
  return {
    id,
    simp: `字${id}`,
    trad: `字${id}`,
    pinyin: 'pīn',
    meaning: 'meaning',
    bank,
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

  it('computes bankDistribution correctly', async () => {
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

    expect(stats.bankDistribution[1]).toBe(2);
    expect(stats.bankDistribution[2]).toBe(0);
    expect(stats.bankDistribution[3]).toBe(1);
    expect(stats.bankDistribution[4]).toBe(0);
    expect(stats.bankDistribution[5]).toBe(2);
  });

  it('counts masteredCount from bank 5 words', async () => {
    const allWords = [makeWord(1, 5), makeWord(2, 5), makeWord(3, 3)];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.masteredCount).toBe(2);
  });

  it('treats missing bank as bank 1 in distribution', async () => {
    const wordWithoutBank: Word = {
      id: 99,
      simp: '字',
      trad: '字',
      pinyin: 'zì',
      meaning: 'character',
      // bank is undefined
    };
    mockedWordService.getUserWords.mockResolvedValue([wordWithoutBank]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.bankDistribution[1]).toBe(1);
  });

  it('returns streak from streakService', async () => {
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);
    mockedStreakService.calculateStreak.mockReturnValue(5);

    const stats = await getDashboardStats('user-1');

    expect(stats.streak).toBe(5);
  });

  it('masteredCount is 0 when no words are at bank 5', async () => {
    const allWords = [makeWord(1, 1), makeWord(2, 2), makeWord(3, 3)];
    mockedWordService.getUserWords.mockResolvedValue(allWords);
    mockedWordService.getDueUserWords.mockResolvedValue([]);

    const stats = await getDashboardStats('user-1');

    expect(stats.masteredCount).toBe(0);
  });

  it('returns zero stats for empty word bank', async () => {
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.getDueUserWords.mockResolvedValue([]);
    mockedStreakService.calculateStreak.mockReturnValue(0);

    const stats = await getDashboardStats('user-1');

    expect(stats.totalWords).toBe(0);
    expect(stats.dueWords).toBe(0);
    expect(stats.masteredCount).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.bankDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
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

  it('uses numWords setting from localStorage for time estimate', async () => {
    localStorage.setItem('numWords', '2');
    const dueWords = Array.from({ length: 10 }, (_, i) => makeWord(i + 1, 1));
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // With 2 words and default settings (all stages enabled):
    // 2 × (8+8+10+10+15 + 5+30+30) = 2 × 116 = 232s → ~4 min
    expect(stats.estimatedStudyTime).toBe('~4 min');
  });

  it('respects user settings from localStorage for time estimate', async () => {
    localStorage.setItem('numWords', '20');
    localStorage.setItem('useHandwriting', 'true');
    localStorage.setItem('newWords', 'true');
    localStorage.setItem('sentenceRead', 'true');
    localStorage.setItem('sentenceWrite', 'true');
    const dueWords = Array.from({ length: 20 }, (_, i) => makeWord(i + 1, 1));
    mockedWordService.getUserWords.mockResolvedValue(dueWords);
    mockedWordService.getDueUserWords.mockResolvedValue(dueWords);

    const stats = await getDashboardStats('user-1');

    // 20 words × (8+8+10+10+15 + 5+30+30) s/word = 2320s → ~39 min
    expect(stats.estimatedStudyTime).toBe('~39 min');
  });
});
