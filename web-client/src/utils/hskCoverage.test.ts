import { describe, it, expect } from 'vitest';

import { hskCoverage, type HskIndex } from './hskCoverage';
import { Word } from '../types/models';

const index: HskIndex = {
  lists: [
    { id: 'hsk-1', name: 'HSK 1' },
    { id: 'hsk-2', name: 'HSK 2' },
  ],
  words: [
    [1, '爱', 'ai4', 0],
    [2, '好', 'hao3', 0],
    [3, '安静', 'an1 jing4', 1],
    [4, '帮助', 'bang1 zhu4', 1],
  ],
};

const word = (id: number, simp: string, pinyin: string, level?: number): Word => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning: 'meaning',
  level,
});

const none = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

describe('hskCoverage', () => {
  it('counts every word of a level as not added when the collection is empty', () => {
    expect(hskCoverage(index, [])).toEqual([
      { listId: 'hsk-1', name: 'HSK 1', total: 2, notAdded: 2, levels: none },
      { listId: 'hsk-2', name: 'HSK 2', total: 2, notAdded: 2, levels: none },
    ]);
  });

  it('counts each added word at its level', () => {
    const coverage = hskCoverage(index, [word(1, '爱', 'ai4', 3), word(3, '安静', 'an1 jing4', 5)]);
    expect(coverage[0]).toMatchObject({ notAdded: 1, levels: { ...none, 3: 1 } });
    expect(coverage[1]).toMatchObject({ notAdded: 1, levels: { ...none, 5: 1 } });
  });

  it('counts a word at each level from 1 to 5', () => {
    const big: HskIndex = {
      lists: [{ id: 'hsk-1', name: 'HSK 1' }],
      words: [1, 2, 3, 4, 5, 6].map((id) => [id, `字${id}`, `zi${id}`, 0]),
    };
    const words = [1, 2, 3, 4, 5].map((level) => word(level, `字${level}`, `zi${level}`, level));
    expect(hskCoverage(big, words)).toEqual([
      {
        listId: 'hsk-1',
        name: 'HSK 1',
        total: 6,
        notAdded: 1,
        levels: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      },
    ]);
  });

  it('counts a word with no level at level 1', () => {
    const coverage = hskCoverage(index, [word(2, '好', 'hao3')]);
    expect(coverage[0].levels).toEqual({ ...none, 1: 1 });
  });

  it('counts a word added by hand: another id, the same characters and pinyin', () => {
    const coverage = hskCoverage(index, [word(900, '帮助', 'bang1 zhu4', 2)]);
    expect(coverage[1]).toMatchObject({ notAdded: 1, levels: { ...none, 2: 1 } });
  });

  it('does not count a word with the same characters and another pinyin', () => {
    const coverage = hskCoverage(index, [word(901, '好', 'hao4', 4)]);
    expect(coverage[0]).toMatchObject({ notAdded: 2, levels: none });
  });

  it('ignores a word outside HSK', () => {
    const coverage = hskCoverage(index, [word(902, '猫', 'mao1', 2)]);
    expect(coverage.map((c) => c.notAdded)).toEqual([2, 2]);
  });
});
