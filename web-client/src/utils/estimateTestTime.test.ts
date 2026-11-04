import { describe, it, expect } from 'vitest';

import { Direction, QueuePair, Word } from '../types/models';
import { SessionPlan } from '../components/Test/Logic/TestLogic';
import { makeDirections } from './directions';
import {
  assumedNewWordCount,
  estimatePlannedTime,
  estimateTestTime,
  formatTestTime,
  spreadOverDirections,
  StageSettings,
  TestTimeEstimateParams,
} from './estimateTestTime';

const ALL_DIRECTIONS: Direction[] = ['MC', 'MP', 'PM', 'PC', 'CM'];

const stages: StageSettings = { newWordsEnabled: true };

const defaults: TestTimeEstimateParams = {
  ...stages,
  directions: ALL_DIRECTIONS,
  newWordCount: 1,
};

describe('estimateTestTime', () => {
  it('adds up the seconds of the directions the session asks', () => {
    const result = estimateTestTime({ ...defaults, newWordsEnabled: false });
    // MC 10 + MP 8 + PM 8 + PC 10 + CM 15
    expect(result).toBe(51);
  });

  it('calculates time for a default session, with no time for sentences', () => {
    const result = estimateTestTime(defaults);
    // Questions: 51
    // New words: 1 * 5 = 5
    expect(result).toBe(56);
  });

  it('costs a handwriting question more than a listening one', () => {
    const questions = { newWordsEnabled: false, newWordCount: 0 };
    expect(estimateTestTime({ ...questions, directions: ['CM'] })).toBe(15);
    expect(estimateTestTime({ ...questions, directions: ['MP'] })).toBe(8);
  });

  it('scales with the number of questions', () => {
    const options = { ...defaults, newWordCount: 0, newWordsEnabled: false };
    const one = estimateTestTime({ ...options, directions: ['MC'] });
    const ten = estimateTestTime({ ...options, directions: Array(10).fill('MC') });
    expect(ten).toBe(one * 10);
  });

  it('adds the new words only when the Learn step is on', () => {
    const vocabOnly = estimateTestTime({ ...defaults, newWordCount: 3, newWordsEnabled: false });
    const withNewWords = estimateTestTime({ ...defaults, newWordCount: 3, newWordsEnabled: true });
    expect(withNewWords - vocabOnly).toBe(3 * 5);
  });

  it('is zero for a session with no questions and no new words', () => {
    expect(estimateTestTime({ ...defaults, directions: [], newWordCount: 0 })).toBe(0);
  });
});

describe('spreadOverDirections', () => {
  it('gives one entry for each question in the budget', () => {
    expect(spreadOverDirections(7, ALL_DIRECTIONS)).toHaveLength(7);
  });

  it('spreads the questions evenly over the directions', () => {
    const spread = spreadOverDirections(10, ALL_DIRECTIONS);
    for (const direction of ALL_DIRECTIONS) {
      expect(spread.filter((d) => d === direction)).toHaveLength(2);
    }
  });

  it('asks one direction only when the settings allow one', () => {
    expect(spreadOverDirections(3, ['CM'])).toEqual(['CM', 'CM', 'CM']);
  });

  it('returns nothing when no direction is eligible', () => {
    expect(spreadOverDirections(5, [])).toEqual([]);
  });
});

describe('assumedNewWordCount', () => {
  it('assumes a fifth of the session is new words', () => {
    expect(assumedNewWordCount(25)).toBe(5);
  });

  it('assumes at least one new word', () => {
    expect(assumedNewWordCount(5)).toBe(1);
  });

  it('assumes no more new words than a session admits', () => {
    expect(assumedNewWordCount(50)).toBe(5);
  });
});

describe('estimatePlannedTime', () => {
  const word = (id: number, level = 1): Word => ({
    id,
    simp: '好',
    trad: '好',
    pinyin: 'hao3',
    meaning: 'good',
    level,
    directions: makeDirections(level, '2026/01/01'),
  });

  const pair = (index: number, direction: Direction): QueuePair => ({
    index: index.toString(),
    aCategory: direction[0] as QueuePair['aCategory'],
    qCategory: direction[1] as QueuePair['qCategory'],
  });

  it('reads the questions and the new words from the plan', () => {
    const plan: SessionPlan = {
      words: [word(1), word(2), word(3)],
      queue: [pair(0, 'MC'), pair(1, 'CM'), pair(2, 'MP')],
      newWords: [word(1)],
    };

    const result = estimatePlannedTime(plan, stages);
    // Questions: MC 10 + CM 15 + MP 8 = 33
    // New words: 1 * 5 = 5
    expect(result).toBe(38);
  });

  it('is zero for an empty plan', () => {
    expect(estimatePlannedTime({ words: [], queue: [], newWords: [] }, stages)).toBe(0);
  });
});

describe('formatTestTime', () => {
  it('returns "< 1 min" for values under 60 seconds', () => {
    expect(formatTestTime(0)).toBe('< 1 min');
    expect(formatTestTime(8)).toBe('< 1 min');
    expect(formatTestTime(59)).toBe('< 1 min');
  });

  it('returns "~1 min" for exactly 60 seconds', () => {
    expect(formatTestTime(60)).toBe('~1 min');
  });

  it('rounds up to the nearest minute', () => {
    expect(formatTestTime(61)).toBe('~2 min');
    expect(formatTestTime(120)).toBe('~2 min');
    expect(formatTestTime(121)).toBe('~3 min');
  });

  it('handles large values', () => {
    expect(formatTestTime(2320)).toBe('~39 min');
  });
});
