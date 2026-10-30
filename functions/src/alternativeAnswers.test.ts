import { describe, it, expect } from 'vitest';
import { DictionaryEntry } from './dictionarySearch';
import {
  alternativeAnswers,
  createAlternativeIndex,
  readAlternativesRequest,
} from './alternativeAnswers';

/** A few CC-CEDICT entries, numbered in file order as build-dictionary.js does. */
const DICTIONARY: Omit<DictionaryEntry, 'id'>[] = [
  { trad: '訓練', simp: '训练', pinyin: 'xun4 lian4', meaning: 'to train; to drill/training' },
  { trad: '培訓', simp: '培训', pinyin: 'pei2 xun4', meaning: 'to cultivate/To Train' },
  { trad: '是', simp: '是', pinyin: 'shi4', meaning: 'is/are/am/yes' },
  { trad: '事', simp: '事', pinyin: 'shi4', meaning: 'matter/thing/CL:件[jian4]' },
  { trad: '室', simp: '室', pinyin: 'Shi4', meaning: 'surname Shi' },
  { trad: '試', simp: '试', pinyin: 'shi4', meaning: 'to test' },
  { trad: '十', simp: '十', pinyin: 'shi2', meaning: 'ten' },
  { trad: '長', simp: '长', pinyin: 'chang2', meaning: 'length/long' },
  { trad: '長', simp: '长', pinyin: 'zhang3', meaning: 'chief/to grow' },
  { trad: '朋友', simp: '朋友', pinyin: 'peng2 you5', meaning: 'friend' },
  { trad: '乾', simp: '干', pinyin: 'gan1', meaning: 'dry' },
  { trad: '幹', simp: '干', pinyin: 'gan4', meaning: 'to do' },
  { trad: '干', simp: '干', pinyin: 'gan1', meaning: 'to concern' },
];

const index = createAlternativeIndex(DICTIONARY.map((entry, i) => ({ id: i + 1, ...entry })));

describe('alternativeAnswers: a meaning question (PM)', () => {
  it('gives the pinyin of each entry that shares a gloss', () => {
    expect(
      alternativeAnswers(index, { direction: 'PM', value: ['to train', 'to drill'] }, 'simp'),
    ).toEqual(['xun4 lian4', 'pei2 xun4']);
  });

  it('needs only one shared gloss', () => {
    expect(alternativeAnswers(index, { direction: 'PM', value: ['to cultivate'] }, 'simp')).toEqual(
      ['pei2 xun4'],
    );
  });

  it('matches a whole gloss, not a part of one', () => {
    expect(alternativeAnswers(index, { direction: 'PM', value: ['train'] }, 'simp')).toEqual([]);
  });
});

describe('alternativeAnswers: a pinyin question (MP)', () => {
  it('gives the meanings of each entry with the same pinyin, case aside', () => {
    expect(alternativeAnswers(index, { direction: 'MP', value: 'shi4' }, 'simp')).toEqual([
      'is',
      'are',
      'am',
      'yes',
      'matter',
      'thing',
      'surname Shi',
      'to test',
    ]);
  });

  it('reads a neutral tone with or without its number', () => {
    expect(alternativeAnswers(index, { direction: 'MP', value: 'peng2 you' }, 'simp')).toEqual([
      'friend',
    ]);
  });
});

describe('alternativeAnswers: a character question (MC, PC)', () => {
  it('gives the pinyin of each reading of the characters', () => {
    expect(alternativeAnswers(index, { direction: 'PC', value: '长' }, 'simp')).toEqual([
      'chang2',
      'zhang3',
    ]);
  });

  it('gives the meanings of each reading of the characters', () => {
    expect(alternativeAnswers(index, { direction: 'MC', value: '长' }, 'simp')).toEqual([
      'length',
      'long',
      'chief',
      'to grow',
    ]);
  });

  it('reads the characters in the character set of the learner', () => {
    expect(alternativeAnswers(index, { direction: 'PC', value: '干' }, 'trad')).toEqual(['gan1']);
    expect(alternativeAnswers(index, { direction: 'PC', value: '干' }, 'simp')).toEqual([
      'gan1',
      'gan4',
    ]);
  });
});

describe('readAlternativesRequest', () => {
  it('takes the questions of one session', () => {
    const request = {
      charSet: 'trad',
      questions: [
        { direction: 'PM', value: ['to train'] },
        { direction: 'PC', value: '長' },
      ],
    };
    expect(readAlternativesRequest(request)).toEqual(request);
  });

  it('refuses a handwriting question, which takes no alternative answer', () => {
    expect(
      readAlternativesRequest({ charSet: 'simp', questions: [{ direction: 'CM', value: ['long'] }] }),
    ).toBeNull();
  });

  it('refuses a value of the wrong shape, or a session too long to be one', () => {
    const question = { direction: 'MP', value: 'shi4' };
    expect(readAlternativesRequest({ charSet: 'simp', questions: [{ direction: 'MP', value: 4 }] })).toBeNull();
    expect(readAlternativesRequest({ charSet: 'simp', questions: [{ direction: 'PM', value: 'x' }] })).toBeNull();
    expect(readAlternativesRequest({ charSet: 'simp', questions: [{ direction: 'MP', value: 'x'.repeat(201) }] })).toBeNull();
    expect(readAlternativesRequest({ charSet: 'big5', questions: [question] })).toBeNull();
    expect(readAlternativesRequest({ charSet: 'simp', questions: Array(201).fill(question) })).toBeNull();
    expect(readAlternativesRequest(null)).toBeNull();
  });
});
