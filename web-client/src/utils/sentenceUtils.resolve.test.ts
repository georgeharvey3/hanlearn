import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../services/dictionaryService', () => ({
  searchWord: vi.fn(),
  substringMatch: vi.fn(),
}));
vi.mock('../services/errorReporting', () => ({ reportError: vi.fn() }));

import { resolveSentence, CloudSentence } from './sentenceUtils';
import { searchWord, substringMatch } from '../services/dictionaryService';
import { reportError } from '../services/errorReporting';

const mockedSearchWord = vi.mocked(searchWord);
const mockedSubstringMatch = vi.mocked(substringMatch);

const sentence: CloudSentence = {
  chinese: {
    sentence: '他不择手段地赚钱',
    highlight: [],
    segments: ['他', '不择手段', '地', '赚钱'],
    targetIndex: 1,
  },
  english: { sentence: 'He makes money by any means.', highlight: [] },
};

const entry = (simp: string) => ({
  id: 1,
  simp,
  trad: simp,
  pinyin: '',
  meaning: simp,
  level: 1,
  due_date: '',
});
const resolvedWord = (simp: string) => ({ id: 1, simp, trad: simp, pinyin: '', meaning: simp });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveSentence', () => {
  it('keeps the sentence when one dictionary lookup fails', async () => {
    mockedSearchWord.mockImplementation(async (seg) => {
      if (seg === '赚钱') throw new Error('deadline-exceeded');
      return [entry(seg)];
    });

    const resolved = await resolveSentence(sentence);

    expect(resolved.chinese.words).toEqual([
      resolvedWord('他'),
      '不择手段',
      resolvedWord('地'),
      '赚钱',
    ]);
    expect(mockedSubstringMatch).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'sentence-resolve', level: 'warning' }),
    );
  });

  it('keeps a segment as a plain string when the substring fallback fails', async () => {
    mockedSearchWord.mockResolvedValue([]);
    mockedSubstringMatch.mockRejectedValue(new Error('unavailable'));

    const resolved = await resolveSentence(sentence);

    expect(resolved.chinese.words).toEqual(['他', '不择手段', '地', '赚钱']);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when every lookup succeeds', async () => {
    mockedSearchWord.mockImplementation(async (seg) => [entry(seg)]);

    await resolveSentence(sentence);

    expect(reportError).not.toHaveBeenCalled();
  });
});
