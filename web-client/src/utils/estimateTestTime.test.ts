import { describe, it, expect } from 'vitest';
import { estimateTestTime, formatTestTime, TestTimeEstimateParams } from './estimateTestTime';

const defaults: TestTimeEstimateParams = {
  numWords: 5,
  useHandwriting: true,
  priority: 'none',
  onlyPriority: false,
  newWordsEnabled: true,
  sentenceReadEnabled: true,
  sentenceWriteEnabled: true,
};

describe('estimateTestTime', () => {
  it('calculates time for default settings', () => {
    const result = estimateTestTime(defaults);
    // Vocab: 5 * (10+8+8+10+15) = 5 * 51 = 255
    // New words: 5 * 5 = 25
    // Sentence read: 5 * 30 = 150
    // Sentence write: 5 * 30 = 150
    // Total: 580
    expect(result).toBe(580);
  });

  it('calculates time without handwriting', () => {
    const result = estimateTestTime({ ...defaults, useHandwriting: false });
    // Vocab: 5 * (10+8+8+10) = 5 * 36 = 180
    // Stages: 25 + 150 + 150 = 325
    // Total: 505
    expect(result).toBe(505);
  });

  it('calculates minimum config', () => {
    const result = estimateTestTime({
      numWords: 1,
      useHandwriting: false,
      priority: 'MP',
      onlyPriority: true,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    // Only MP perm: 1 * 8 = 8
    expect(result).toBe(8);
  });

  it('calculates maximum config', () => {
    const result = estimateTestTime({
      numWords: 20,
      useHandwriting: true,
      priority: 'none',
      onlyPriority: false,
      newWordsEnabled: true,
      sentenceReadEnabled: true,
      sentenceWriteEnabled: true,
    });
    // Vocab: 20 * 51 = 1020
    // Stages: 100 + 600 + 600 = 1300
    // Total: 2320
    expect(result).toBe(2320);
  });

  it('uses only priority permutation when onlyPriority is true', () => {
    const result = estimateTestTime({
      ...defaults,
      priority: 'CM',
      onlyPriority: true,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    // Only CM: 5 * 15 = 75
    expect(result).toBe(75);
  });

  it('includes all permutations when priority is set but onlyPriority is false', () => {
    const result = estimateTestTime({
      ...defaults,
      priority: 'CM',
      onlyPriority: false,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    // All 5 perms: 5 * 51 = 255
    expect(result).toBe(255);
  });

  it('ignores onlyPriority when priority is none', () => {
    const result = estimateTestTime({
      ...defaults,
      priority: 'none',
      onlyPriority: true,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    // All 5 perms (handwriting on): 5 * 51 = 255
    expect(result).toBe(255);
  });

  it('disabling stages removes their contribution', () => {
    const vocabOnly = estimateTestTime({
      ...defaults,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    const withNewWords = estimateTestTime({
      ...defaults,
      newWordsEnabled: true,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: false,
    });
    expect(withNewWords - vocabOnly).toBe(5 * 5); // 25s for new words

    const withSentenceRead = estimateTestTime({
      ...defaults,
      newWordsEnabled: false,
      sentenceReadEnabled: true,
      sentenceWriteEnabled: false,
    });
    expect(withSentenceRead - vocabOnly).toBe(5 * 30); // 150s

    const withSentenceWrite = estimateTestTime({
      ...defaults,
      newWordsEnabled: false,
      sentenceReadEnabled: false,
      sentenceWriteEnabled: true,
    });
    expect(withSentenceWrite - vocabOnly).toBe(5 * 30); // 150s
  });

  it('scales linearly with numWords', () => {
    const one = estimateTestTime({ ...defaults, numWords: 1 });
    const ten = estimateTestTime({ ...defaults, numWords: 10 });
    expect(ten).toBe(one * 10);
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
