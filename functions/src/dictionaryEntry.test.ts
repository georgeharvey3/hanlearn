import { describe, it, expect } from 'vitest';
import { createEntryIndex, entryById } from './dictionaryEntry';
import { DictionaryEntry } from './dictionarySearch';

const DICTIONARY: DictionaryEntry[] = [
  { id: 1, trad: '行', simp: '行', pinyin: 'xing2', meaning: 'to walk/to go' },
  { id: 2, trad: '行', simp: '行', pinyin: 'hang2', meaning: 'row/line', q: 400 },
  { id: 3, trad: '學習', simp: '学习', pinyin: 'xue2 xi2', meaning: 'to learn/to study', q: 30 },
];

const index = createEntryIndex(DICTIONARY);

describe('entryById', () => {
  it('gives the entry with the id, without the frequency rank', () => {
    expect(entryById(index, 2)).toEqual({
      id: 2,
      simp: '行',
      trad: '行',
      pinyin: 'hang2',
      meaning: 'row/line',
    });
  });

  it('gives nothing for an id that no entry has', () => {
    expect(entryById(index, 99)).toBeNull();
  });

  it('gives nothing for the negative id of a custom word', () => {
    expect(entryById(index, -3)).toBeNull();
  });
});
