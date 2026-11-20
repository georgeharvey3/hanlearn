import { describe, it, expect } from 'vitest';
import {
  createEnglishIndex,
  createSearchIndex,
  searchDictionary,
  DictionaryEntry,
  SearchMode,
} from './dictionarySearch';

/** A few CC-CEDICT entries, numbered in file order as build-dictionary.js does. */
const DICTIONARY: Omit<DictionaryEntry, 'id'>[] = [
  { trad: '你', simp: '你', pinyin: 'ni3', meaning: 'you (informal)' },
  { trad: '你好', simp: '你好', pinyin: 'ni3 hao3', meaning: 'hello; hi', q: 120 },
  { trad: '你們', simp: '你们', pinyin: 'ni3 men5', meaning: 'you (plural)', q: 300 },
  { trad: '好', simp: '好', pinyin: 'hao3', meaning: 'good/well', q: 20 },
  { trad: '好', simp: '好', pinyin: 'hao4', meaning: 'to be fond of' },
  { trad: '中國', simp: '中国', pinyin: 'Zhong1 guo2', meaning: 'China', q: 50 },
  { trad: '中國人', simp: '中国人', pinyin: 'Zhong1 guo2 ren2', meaning: 'Chinese person' },
  { trad: '女', simp: '女', pinyin: 'nu:3', meaning: 'female/woman' },
  { trad: '努', simp: '努', pinyin: 'nu3', meaning: 'to exert' },
  { trad: '吃', simp: '吃', pinyin: 'chi1', meaning: 'to eat; to consume/to eat at (a cafeteria etc)', q: 10 },
  { trad: '吃飯', simp: '吃饭', pinyin: 'chi1 fan4', meaning: 'to have a meal/to eat (a meal)' },
  { trad: '喫', simp: '吃', pinyin: 'chi1', meaning: 'variant of 吃[chi1]' },
  { trad: '創造', simp: '创造', pinyin: 'chuang4 zao4', meaning: 'to create' },
  { trad: '飯', simp: '饭', pinyin: 'fan4', meaning: 'cooked rice/meal (CL:頓|顿[dun4])' },
  { trad: '吃東西', simp: '吃东西', pinyin: 'chi1 dong1 xi5', meaning: 'to eat something' },
  { trad: '東西', simp: '东西', pinyin: 'dong1 xi5', meaning: 'thing/stuff' },
  { trad: '東西', simp: '东西', pinyin: 'dong1 xi1', meaning: 'east and west' },
  { trad: '大衛', simp: '大卫', pinyin: 'Da4 wei4', meaning: 'see 大衛|大卫[Da4 wei4]' },
  { trad: '扇子', simp: '扇子', pinyin: 'shan4 zi5', meaning: 'fan' },
];

const ENTRIES = DICTIONARY.map((entry, i) => ({ id: i + 1, ...entry }));
const index = createSearchIndex(ENTRIES);
const english = createEnglishIndex(ENTRIES);

/** The results of a search, as "simp pinyin", in order. */
const searchIn = (mode: SearchMode, query: string, charSet: 'simp' | 'trad' = 'simp') =>
  searchDictionary(index, query, charSet, mode === 'english' ? { mode, english } : { mode }).map(
    (w) => `${w.simp} ${w.pinyin}`,
  );
const search = (query: string, charSet: 'simp' | 'trad' = 'simp') =>
  searchIn('chinese', query, charSet);
const searchEnglish = (query: string) => searchIn('english', query);

describe('searchDictionary: hanzi', () => {
  it('gives the exact entries first, then the entries that start with the query', () => {
    expect(search('你')).toEqual(['你 ni3', '你好 ni3 hao3', '你们 ni3 men5']);
  });

  it('searches the traditional form for a traditional learner', () => {
    expect(search('中國', 'trad')).toEqual(['中国 Zhong1 guo2', '中国人 Zhong1 guo2 ren2']);
  });

  it('searches mixed input as typed, with no pinyin match', () => {
    expect(search('你hao')).toEqual([]);
  });
});

describe('searchDictionary: pinyin', () => {
  it('finds an entry by its pinyin without tones, spaces or case', () => {
    expect(search('nihao')).toEqual(['你好 ni3 hao3']);
    expect(search('Ni hao')).toEqual(['你好 ni3 hao3']);
    expect(search("zhong'guo")[0]).toBe('中国 Zhong1 guo2');
  });

  it('reads tone marks and tone digits, and a mix of the two', () => {
    expect(search('nǐhǎo')).toEqual(['你好 ni3 hao3']);
    expect(search('ni3hao3')).toEqual(['你好 ni3 hao3']);
    expect(search('nǐhao3')).toEqual(['你好 ni3 hao3']);
  });

  it('matches a syllable with a tone to that tone only', () => {
    expect(search('hao3')).toEqual(['好 hao3']);
    expect(search('hǎo')).toEqual(['好 hao3']);
    expect(search('ni3hao')).toEqual(['你好 ni3 hao3']);
    expect(search('ni2hao')).toEqual([]);
  });

  it('matches a neutral tone to toneless input and to 5 or 0, not to tones 1 to 4', () => {
    expect(search('dongxi')).toEqual(['东西 dong1 xi5', '东西 dong1 xi1']);
    expect(search('dong1xi5')).toEqual(['东西 dong1 xi5']);
    expect(search('dong1xi0')).toEqual(['东西 dong1 xi5']);
    expect(search('dong1xi1')).toEqual(['东西 dong1 xi1']);
  });

  it('treats ü, v and u: as one letter, and lets a bare u match ü', () => {
    for (const query of ['nü3', 'nv3', 'nu:3']) expect(search(query)).toEqual(['女 nu:3']);
    expect(search('nu3')).toEqual(['女 nu:3', '努 nu3']);
  });

  it('ranks the full pinyin above the entries that start with the query', () => {
    expect(search('zhongguo')).toEqual(['中国 Zhong1 guo2', '中国人 Zhong1 guo2 ren2']);
    expect(search('nih')).toEqual(['你好 ni3 hao3']);
  });

  it('does not match in the middle of the pinyin', () => {
    expect(search('guo')).toEqual([]);
  });

  it('matches the first letters of the syllables, at the same length, below the syllables', () => {
    expect(search('nh')).toEqual(['你好 ni3 hao3']);
    expect(search('zgr')).toEqual(['中国人 Zhong1 guo2 ren2']);
    expect(search('cf')).toEqual(['吃饭 chi1 fan4']);
  });
});

describe('searchDictionary: English', () => {
  it('ranks a gloss equal to the query, then one that starts with it, then one that holds it', () => {
    expect(searchEnglish('eat')).toEqual(['吃 chi1', '吃饭 chi1 fan4', '吃东西 chi1 dong1 xi5']);
    expect(searchEnglish('meal')).toEqual(['饭 fan4', '吃饭 chi1 fan4']);
  });

  it('ignores case, text in parentheses and a leading "to"', () => {
    expect(searchEnglish('To Eat')).toEqual(searchEnglish('eat'));
    expect(searchEnglish('you')).toEqual(['你们 ni3 men5', '你 ni3']);
  });

  it('does not match part of a word', () => {
    expect(searchEnglish('ate')).toEqual([]);
  });

  it('ranks the entries with only cross-reference glosses last', () => {
    expect(searchEnglish('variant')).toEqual(['吃 chi1']);
  });
});

describe('searchDictionary: search mode', () => {
  it('reads a Latin query as pinyin only in Chinese mode', () => {
    expect(search('fan')).toEqual(['饭 fan4']);
    expect(search('eat')).toEqual([]);
  });

  it('reads a Latin query as English only in English mode', () => {
    expect(searchEnglish('fan')).toEqual(['扇子 shan4 zi5']);
    expect(searchEnglish('nihao')).toEqual([]);
  });

  it('gives the same results for a hanzi query in both modes', () => {
    expect(searchEnglish('你')).toEqual(search('你'));
    expect(searchEnglish('你')).toEqual(['你 ni3', '你好 ni3 hao3', '你们 ni3 men5']);
  });
});
