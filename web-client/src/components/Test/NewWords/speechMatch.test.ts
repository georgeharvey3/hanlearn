import { describe, it, expect } from 'vitest';

import { compareSpeech } from './speechMatch';

describe('compareSpeech', () => {
  it('matches every syllable of a word said with the right tones', () => {
    expect(compareSpeech('电脑', 'dian4 nao3')).toEqual({
      syllables: [
        { text: 'dian4', match: 'match' },
        { text: 'nao3', match: 'match' },
      ],
      result: 'match',
    });
  });

  it('marks a right sound with a wrong tone as a tone error', () => {
    // 脑 heard as 挠 (nao2).
    const { syllables, result } = compareSpeech('电挠', 'dian4 nao3');
    expect(syllables[1]).toEqual({ text: 'nao2', match: 'tone' });
    expect(result).toBe('tone');
  });

  it('marks a wrong sound as a miss, which outranks a tone error', () => {
    const { syllables, result } = compareSpeech('天挠', 'dian4 nao3');
    expect(syllables.map((s) => s.match)).toEqual(['sound', 'tone']);
    expect(result).toBe('sound');
  });

  it('accepts any tone on a neutral syllable', () => {
    expect(compareSpeech('休息', 'xiu1 xi5').result).toBe('match');
  });

  it('marks a syllable the recognizer did not hear as a miss', () => {
    const { syllables, result } = compareSpeech('电', 'dian4 nao3');
    expect(syllables[1]).toEqual({ text: '', match: 'sound' });
    expect(result).toBe('sound');
  });

  it('reads ü written as u: or v in the stored pinyin', () => {
    expect(compareSpeech('绿', 'lu:4').result).toBe('match');
    expect(compareSpeech('绿', 'lv4').result).toBe('match');
  });
});
