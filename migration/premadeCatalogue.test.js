import { describe, it, expect } from 'vitest';
import { ranksOf, resolveCatalogue } from './premadeCatalogue';

/** A dictionary entry as build-dictionary.js numbers it. */
const entry = (id, trad, simp, pinyin, meaning = 'meaning') => ({
  id,
  trad,
  simp,
  pinyin,
  meaning,
});

/** A source word with one form for each reading. */
const word = (simp, ...forms) => ({
  simp,
  forms: forms.map(([trad, pinyin]) => ({ trad, pinyin })),
});

const list = (...words) => [{ id: 'hsk-1', name: 'HSK 1', words }];

const none = { choose: {}, exclude: [] };

const idsOf = (catalogue) => catalogue.map((l) => l.entries.map((e) => e.id));

describe('resolveCatalogue', () => {
  it('takes the one entry with the same simplified form', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4'), entry(2, '安', '安', 'an1')];
    const catalogue = resolveCatalogue(list(word('爱', ['愛', 'ai4'])), none, dictionary);
    expect(catalogue).toEqual([
      { id: 'hsk-1', name: 'HSK 1', entries: [entry(1, '愛', '爱', 'ai4')] },
    ]);
  });

  it('drops the proper nouns when more than one entry matches', () => {
    const dictionary = [entry(1, '黃', '黄', 'Huang2'), entry(2, '黃', '黄', 'huang2')];
    const catalogue = resolveCatalogue(list(word('黄', ['黃', 'huang2'])), none, dictionary);
    expect(idsOf(catalogue)).toEqual([[2]]);
  });

  it('matches the pinyin of the source, with ü written as u:', () => {
    const dictionary = [entry(1, '女', '女', 'ru3'), entry(2, '女', '女', 'nu:3')];
    const catalogue = resolveCatalogue(list(word('女', ['女', 'nü3'])), none, dictionary);
    expect(idsOf(catalogue)).toEqual([[2]]);
  });

  it('matches the traditional form when the pinyin leaves more than one', () => {
    const dictionary = [entry(1, '干', '干', 'gan4'), entry(2, '幹', '干', 'gan4')];
    const catalogue = resolveCatalogue(list(word('干', ['幹', 'gan4'])), none, dictionary);
    expect(idsOf(catalogue)).toEqual([[2]]);
  });

  it('fails when no entry has the pinyin of the source, even if the traditional form matches', () => {
    // The source writes some readings with tone marks, which match no entry.
    const dictionary = [
      entry(1, '見過', '见过', 'jian4 guo4'),
      entry(2, '覸過', '见过', 'jian4 guo5'),
    ];
    const source = list(word('见过', ['見過', 'jiànguò']));
    expect(() => resolveCatalogue(source, none, dictionary)).toThrow(/见过 \[jiànguò\]/);
  });

  it('takes the entry that the override table names', () => {
    const dictionary = [entry(1, '都', '都', 'du1'), entry(2, '都', '都', 'dou1')];
    const overrides = { choose: { '都 [du1|dou1]': '都 [dou1]' }, exclude: [] };
    const source = list(word('都', ['都', 'du1'], ['都', 'dou1']));
    expect(idsOf(resolveCatalogue(source, overrides, dictionary))).toEqual([[2]]);
  });

  it('leaves out a word that the override table excludes', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4')];
    const overrides = { choose: {}, exclude: ['说起来 [shuo1 qi3 lai5]'] };
    const source = list(word('爱', ['愛', 'ai4']), word('说起来', ['說起來', 'shuo1 qi3 lai5']));
    expect(idsOf(resolveCatalogue(source, overrides, dictionary))).toEqual([[1]]);
  });

  it('fails and names each word with no entry or with more than one', () => {
    const dictionary = [entry(1, '都', '都', 'du1'), entry(2, '都', '都', 'dou1')];
    const source = list(
      word('都', ['都', 'du1'], ['都', 'dou1']),
      word('着眼于', ['著眼於', 'zhuo2 yan3 yu2']),
    );
    expect(() => resolveCatalogue(source, none, dictionary)).toThrow(
      /都 \[du1\|dou1\][\s\S]*着眼于 \[zhuo2 yan3 yu2\]/,
    );
  });

  it('fails when an override names no entry of the word', () => {
    const dictionary = [entry(1, '都', '都', 'du1'), entry(2, '都', '都', 'dou1')];
    const overrides = { choose: { '都 [du1|dou1]': '都 [dou3]' }, exclude: [] };
    const source = list(word('都', ['都', 'du1'], ['都', 'dou1']));
    expect(() => resolveCatalogue(source, overrides, dictionary)).toThrow(/都 \[dou3\]/);
  });

  it('fails on an override or an exclusion that matches no source word', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4')];
    const overrides = { choose: { '都 [du1|dou1]': '都 [dou1]' }, exclude: ['着眼于 [zhuo2]'] };
    const source = list(word('爱', ['愛', 'ai4']));
    expect(() => resolveCatalogue(source, overrides, dictionary)).toThrow(
      /都 \[du1\|dou1\][\s\S]*着眼于 \[zhuo2\]/,
    );
  });
});

describe('ranksOf', () => {
  const ranked = (q, w) => ({ ...w, q });

  it('gives each entry of the catalogue the frequency rank of its source word', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4'), entry(2, '八', '八', 'ba1')];
    const source = list(
      ranked(130, word('爱', ['愛', 'ai4'])),
      ranked(1362, word('八', ['八', 'ba1'])),
    );
    const catalogue = resolveCatalogue(source, none, dictionary);
    expect(ranksOf(source, none, catalogue)).toEqual(
      new Map([
        [1, 130],
        [2, 1362],
      ]),
    );
  });

  it('skips the excluded words and the words with no rank', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4'), entry(2, '八', '八', 'ba1')];
    const overrides = { choose: {}, exclude: ['着眼于 [zhuo2]'] };
    const source = list(
      ranked(5, word('着眼于', ['著眼於', 'zhuo2'])),
      word('爱', ['愛', 'ai4']),
      ranked(1362, word('八', ['八', 'ba1'])),
    );
    const catalogue = resolveCatalogue(source, overrides, dictionary);
    expect(ranksOf(source, overrides, catalogue)).toEqual(new Map([[2, 1362]]));
  });

  it('keeps the best rank when two source words name one entry', () => {
    const dictionary = [entry(1, '愛', '爱', 'ai4')];
    const source = [
      ...list(ranked(900, word('爱', ['愛', 'ai4']))),
      { id: 'hsk-2', name: 'HSK 2', words: [ranked(130, word('爱', ['愛', 'ai4']))] },
    ];
    const catalogue = resolveCatalogue(source, none, dictionary);
    expect(ranksOf(source, none, catalogue)).toEqual(new Map([[1, 130]]));
  });
});
