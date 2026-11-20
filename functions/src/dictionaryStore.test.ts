import { describe, it, expect } from 'vitest';
import { createDictionaryStore, LoadLine } from './dictionaryStore';
import { DictionaryEntry } from './dictionarySearch';

const DICTIONARY: DictionaryEntry[] = [
  { id: 1, trad: '行', simp: '行', pinyin: 'xing2', meaning: 'to walk/to go' },
  { id: 2, trad: '行', simp: '行', pinyin: 'hang2', meaning: 'row/line' },
  { id: 3, trad: '學習', simp: '学习', pinyin: 'xue2 xi2', meaning: 'to learn/to study' },
];

function store() {
  const lines: LoadLine[] = [];
  let reads = 0;
  const dictionary = createDictionaryStore(
    () => {
      reads++;
      return DICTIONARY;
    },
    { log: (line) => lines.push(line) }
  );
  return { dictionary, stages: () => lines.map((line) => line.stage), reads: () => reads };
}

describe('createDictionaryStore', () => {
  it('builds only the index that a function asks for, once', () => {
    const { dictionary, stages, reads } = store();

    expect(dictionary.entryIndex().get(3)?.simp).toBe('学习');
    dictionary.entryIndex();

    expect(stages()).toEqual(['entries', 'entry index']);
    expect(reads()).toBe(1);
  });

  it('reads the file once for all the indexes of an instance', () => {
    const { dictionary, stages, reads } = store();

    expect(dictionary.characterIndexes().trad.get('學習')?.map((e) => e.id)).toEqual([3]);
    expect(dictionary.characterIndexes().simp.get('行')?.map((e) => e.id)).toEqual([1, 2]);
    dictionary.searchIndex();
    dictionary.alternativeIndex();

    expect(stages()).toEqual(['entries', 'character indexes', 'search index', 'alternative index']);
    expect(reads()).toBe(1);
  });
});
