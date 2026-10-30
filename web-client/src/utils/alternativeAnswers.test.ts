import { describe, it, expect } from 'vitest';
import { Word } from '../types/models';
import {
  answerMatches,
  buildAlternativeIndex,
  ownWordAlternatives,
  questionKey,
} from './alternativeAnswers';

const word = (id: number, simp: string, trad: string, pinyin: string, meaning: string): Word => ({
  id,
  simp,
  trad,
  pinyin,
  meaning,
});

// `meaning` is what the question shows: the amended meaning when the learner set one.
const COLLECTION: Word[] = [
  word(1, '训练', '訓練', 'xun4 lian4', 'to train/to drill'),
  word(2, '培训', '培訓', 'pei2 xun4', 'to cultivate; To Train'),
  word(3, '是', '是', 'shi4', 'is/yes'),
  word(4, '事', '事', 'shi4', 'matter/CL:件[jian4]'),
  word(5, '长', '長', 'chang2', 'long'),
  word(6, '长', '長', 'zhang3', 'to grow'),
  word(7, '朋友', '朋友', 'peng2 you5', 'friend'),
  word(8, '我的词', '我的詞', 'wo3 de ci2', 'my own word'),
];

describe('answerMatches', () => {
  it('compares a meaning without case or punctuation', () => {
    expect(answerMatches(' To Train! ', ['to train', 'to drill'], 'meaning')).toBe(true);
    expect(answerMatches('train', ['to train'], 'meaning')).toBe(false);
  });

  it('compares a pinyin without spaces, case or neutral tone numbers', () => {
    expect(answerMatches('Peng2you', ['peng2 you5'], 'pinyin')).toBe(true);
    expect(answerMatches('peng2 you3', ['peng2 you5'], 'pinyin')).toBe(false);
  });
});

describe('ownWordAlternatives', () => {
  const index = buildAlternativeIndex(COLLECTION, 'simp');

  it('gives the pinyin of each word that shares a gloss of a meaning question', () => {
    expect(ownWordAlternatives(index, 'PM', ['to train', 'to drill'])).toEqual([
      'xun4 lian4',
      'pei2 xun4',
    ]);
  });

  it('gives the meanings of each word with the pinyin of a pinyin question', () => {
    expect(ownWordAlternatives(index, 'MP', 'Shi4')).toEqual(['is', 'yes', 'matter']);
    expect(ownWordAlternatives(index, 'MP', 'peng2 you')).toEqual(['friend']);
  });

  it('gives the answers of each word with the characters of a character question', () => {
    expect(ownWordAlternatives(index, 'PC', '长')).toEqual(['chang2', 'zhang3']);
    expect(ownWordAlternatives(index, 'MC', '长')).toEqual(['long', 'to grow']);
  });

  it('reads the characters in the character set of the session', () => {
    const trad = buildAlternativeIndex(COLLECTION, 'trad');
    expect(ownWordAlternatives(trad, 'PC', '長')).toEqual(['chang2', 'zhang3']);
    expect(ownWordAlternatives(trad, 'PC', '长')).toEqual([]);
  });

  it('covers a word the learner made by hand', () => {
    expect(ownWordAlternatives(index, 'PM', ['my own word'])).toEqual(['wo3 de ci2']);
  });

  it('gives nothing for a handwriting question', () => {
    expect(ownWordAlternatives(index, 'CM', ['long'])).toEqual([]);
  });
});

describe('questionKey', () => {
  it('names a question by its direction and the value it shows', () => {
    expect(questionKey('PM', ['to train', 'to drill'])).toBe(
      questionKey('PM', ['to train', 'to drill']),
    );
    expect(questionKey('PM', ['to train'])).not.toBe(questionKey('PM', ['to train', 'to drill']));
    expect(questionKey('MC', '长')).not.toBe(questionKey('PC', '长'));
  });
});
