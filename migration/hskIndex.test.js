import { describe, it, expect } from 'vitest';
import { checkHskIndex, hskIndexOf } from './hskIndex';

const entry = (id, simp, pinyin) => ({
  id,
  trad: simp,
  simp,
  pinyin,
  meaning: 'meaning',
});

const catalogue = [
  {
    id: 'hsk-1',
    name: 'HSK 1',
    entries: [entry(1, '爱', 'ai4'), entry(2, '好', 'hao3')],
  },
  { id: 'hsk-2', name: 'HSK 2', entries: [entry(3, '安静', 'an1 jing4')] },
];

describe('hskIndexOf', () => {
  it('gives one row for each word of the catalogue, with its list', () => {
    expect(hskIndexOf(catalogue)).toEqual({
      lists: [
        { id: 'hsk-1', name: 'HSK 1' },
        { id: 'hsk-2', name: 'HSK 2' },
      ],
      words: [
        [1, '爱', 'ai4', 0],
        [2, '好', 'hao3', 0],
        [3, '安静', 'an1 jing4', 1],
      ],
    });
  });
});

describe('checkHskIndex', () => {
  it('accepts the index of the catalogue', () => {
    expect(() => checkHskIndex(hskIndexOf(catalogue), catalogue)).not.toThrow();
  });

  it('fails on a row whose pinyin does not match the premade list', () => {
    const index = hskIndexOf(catalogue);
    index.words[1] = [2, '好', 'hao4', 0];
    expect(() => checkHskIndex(index, catalogue)).toThrow(/hsk-1/);
  });

  it('fails on a row in the wrong list', () => {
    const index = hskIndexOf(catalogue);
    index.words[2] = [3, '安静', 'an1 jing4', 0];
    expect(() => checkHskIndex(index, catalogue)).toThrow();
  });

  it('fails on a missing row', () => {
    const index = hskIndexOf(catalogue);
    index.words.pop();
    expect(() => checkHskIndex(index, catalogue)).toThrow();
  });

  it('fails when one entry is in two lists', () => {
    const twice = [catalogue[0], { ...catalogue[1], entries: [entry(1, '爱', 'ai4')] }];
    expect(() => checkHskIndex(hskIndexOf(twice), twice)).toThrow(/two/);
  });
});
