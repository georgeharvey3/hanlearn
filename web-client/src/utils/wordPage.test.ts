import { describe, it, expect } from 'vitest';
import { hanziOf, isCustomWord, readingsInWord, sensesOf, syllablesOf } from './wordPage';

describe('sensesOf', () => {
  it('splits a CC-CEDICT meaning on its slashes', () => {
    expect(sensesOf('to learn/to study/ ')).toEqual(['to learn', 'to study']);
  });
});

describe('hanziOf', () => {
  it('keeps only the hanzi', () => {
    expect(hanziOf('卡拉OK')).toEqual(['卡', '拉']);
    expect(hanziOf('110')).toEqual([]);
  });
});

describe('isCustomWord', () => {
  it('reads a negative id as a custom word', () => {
    expect(isCustomWord({ id: -3 })).toBe(true);
    expect(isCustomWord({ id: 42 })).toBe(false);
  });
});

describe('syllablesOf', () => {
  it('gives one syllable for each character', () => {
    expect(syllablesOf({ pinyin: 'yin2 hang2' }, 2)).toEqual(['yin2', 'hang2']);
  });

  it('gives no syllables when the count does not agree', () => {
    expect(syllablesOf({ pinyin: 'kǎ lā ōu kēi' }, 2)).toEqual([null, null]);
  });
});

describe('readingsInWord', () => {
  const XING = { pinyin: 'xing2', meaning: 'to walk/to go' };
  const HANG = { pinyin: 'hang2', meaning: 'row/line/profession' };

  it('puts the reading of the syllable first', () => {
    const readings = readingsInWord([XING, HANG], 'hang2');
    expect(readings.inWord).toEqual({ pinyin: 'háng', senses: ['row', 'line', 'profession'] });
    expect(readings.others).toEqual([{ pinyin: 'xíng', senses: ['to walk', 'to go'] }]);
  });

  it('matches a syllable in tone marks', () => {
    expect(readingsInWord([XING, HANG], 'háng').inWord?.pinyin).toBe('háng');
  });

  it('prefers an exact match over a match in another case', () => {
    const SURNAME = { pinyin: 'Shu1', meaning: 'abbr. for Shujing' };
    const BOOK = { pinyin: 'shu1', meaning: 'book/letter' };
    expect(readingsInWord([SURNAME, BOOK], 'shu1').inWord?.senses[0]).toBe('book');
    expect(readingsInWord([SURNAME], 'shu1').inWord?.pinyin).toBe('Shū');
  });

  it('matches nothing with no syllable', () => {
    const readings = readingsInWord([XING, HANG], null);
    expect(readings.inWord).toBeNull();
    expect(readings.others).toHaveLength(2);
  });
});
