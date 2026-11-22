import { describe, it, expect, beforeEach } from 'vitest';

import { Word } from '../types/models';
import { loadSummary, restoreSummary, saveSummary, SavedSummary } from './savedSummary';

const word = (id: number, simp: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'x',
  meaning: 'y',
});

const saved: SavedSummary = {
  userId: 'u1',
  listId: 'default',
  practiceMode: false,
  wordIds: [1, 2],
  scores: [
    { char: '你好', direction: 'MC', result: 'pass' },
    { char: '学生', direction: 'CM', result: 'fail' },
  ],
};

beforeEach(() => sessionStorage.clear());

describe('savedSummary', () => {
  it('loads the summary of the same learner and list only', () => {
    saveSummary(saved);
    expect(loadSummary('u1', 'default')).toEqual(saved);
    expect(loadSummary('u2', 'default')).toBeNull();
    expect(loadSummary('u1', 'other')).toBeNull();
  });

  it('is null when nothing is saved, or the record is broken', () => {
    expect(loadSummary('u1', 'default')).toBeNull();
    sessionStorage.setItem('savedSummary', '{not json');
    expect(loadSummary('u1', 'default')).toBeNull();
  });

  it('leaves out a word deleted since, with its scores', () => {
    const restored = restoreSummary(saved, [word(1, '你好')]);
    expect(restored?.words.map((w) => w.id)).toEqual([1]);
    expect(restored?.scores).toEqual([saved.scores[0]]);
  });

  it('is null when no word is left', () => {
    expect(restoreSummary(saved, [])).toBeNull();
  });
});
