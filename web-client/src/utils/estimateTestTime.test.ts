import { describe, it, expect } from 'vitest';

import { Direction, TestPerm, Word } from '../types/models';
import { SessionPlan } from '../components/Test/Logic/TestLogic';
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

const stages: StageSettings = {
  newWordsEnabled: true,
  sentenceReadEnabled: true,
  sentenceWriteEnabled: true,
  sentenceStagesForAllWords: false,
};

const defaults: TestTimeEstimateParams = {
  ...stages,
  directions: ALL_DIRECTIONS,
  newWordCount: 1,
};

describe('estimateTestTime', () => {
  it('adds up the seconds of the directions the session asks', () => {
    const result = estimateTestTime({
      ...defaults,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    // MC 10 + MP 8 + PM 8 + PC 10 + CM 15
    expect(result).toBe(51);
  });

  it('calculates time for a default session', () => {
    const result = estimateTestTime(defaults);
    // Questions: 51
    // New words: 1 * 5 = 5
    // Sentence read: 1 * 30, sentence write: 1 * 30
    expect(result).toBe(116);
  });

  it('costs a handwriting question more than a listening one', () => {
    const questions: StageSettings = {
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
      sentenceStagesForAllWords: false,
    };
    const handwriting = estimateTestTime({ ...questions, directions: ['CM'], newWordCount: 0 });
    const listening = estimateTestTime({ ...questions, directions: ['MP'], newWordCount: 0 });
    expect(handwriting).toBe(15);
    expect(listening).toBe(8);
  });

  it('scales with the number of questions', () => {
    const options = {
      ...defaults,
      newWordCount: 0,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    };
    const one = estimateTestTime({ ...options, directions: ['MC'] });
    const ten = estimateTestTime({ ...options, directions: Array(10).fill('MC') });
    expect(ten).toBe(one * 10);
  });

  it('counts the sentence stages for the new words only, by default', () => {
    const result = estimateTestTime({
      ...defaults,
      directions: Array(10).fill('MC'),
      newWordCount: 2,
      newWordsEnabled: false,
    });
    // Questions: 10 * 10 = 100
    // Sentence read: 2 * 30 = 60, sentence write: 2 * 30 = 60
    expect(result).toBe(220);
  });

  it('counts the sentence stages for every word when the setting is on', () => {
    const result = estimateTestTime({
      ...defaults,
      directions: Array(10).fill('MC'),
      newWordCount: 2,
      newWordsEnabled: false,
      sentenceStagesForAllWords: true,
    });
    // Questions: 100
    // Sentence read: 10 * 30 = 300, sentence write: 10 * 30 = 300
    expect(result).toBe(700);
  });

  it('adds nothing for a stage that is off', () => {
    const vocabOnly = estimateTestTime({
      ...defaults,
      newWordCount: 3,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    const withNewWords = estimateTestTime({
      ...defaults,
      newWordCount: 3,
      newWordsEnabled: true,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    expect(withNewWords - vocabOnly).toBe(3 * 5);

    const withSentenceRead = estimateTestTime({
      ...defaults,
      newWordCount: 3,
      newWordsEnabled: false,
      sentenceReadEnabled: true,
      sentenceWriteEnabled: false,
    });
    expect(withSentenceRead - vocabOnly).toBe(3 * 30);

    const withSentenceWrite = estimateTestTime({
      ...defaults,
      newWordCount: 3,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: true,
    });
    expect(withSentenceWrite - vocabOnly).toBe(3 * 30);
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
});

describe('estimatePlannedTime', () => {
  const word = (id: number): Word => ({
    id,
    simp: '好',
    trad: '好',
    pinyin: 'hao3',
    meaning: 'good',
  });

  const perm = (index: number, direction: Direction): TestPerm => ({
    index: index.toString(),
    aCategory: direction[0] as TestPerm['aCategory'],
    qCategory: direction[1] as TestPerm['qCategory'],
  });

  it('reads the questions and the new words from the plan', () => {
    const plan: SessionPlan = {
      words: [word(1), word(2), word(3)],
      queue: [perm(0, 'MC'), perm(1, 'CM'), perm(2, 'MP')],
      newWords: [word(1)],
    };

    const result = estimatePlannedTime(plan, stages);
    // Questions: MC 10 + CM 15 + MP 8 = 33
    // New words: 1 * 5 = 5
    // Sentence read: 1 * 30, sentence write: 1 * 30
    expect(result).toBe(98);
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
