import { vi, describe, it, expect } from 'vitest';

vi.mock('../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../services/dictionaryService', () => ({ searchWord: vi.fn() }));

import {
  dictionaryEntryOf,
  matchEnglishToSentenceWords,
  resolveSentence,
  SegmentedSentence,
  SentenceWord,
} from './sentenceUtils';
import { searchWord } from '../services/dictionaryService';

const makeSentenceWord = (
  id: string,
  simp: string,
  pinyin: string,
  meaning: string,
): SentenceWord => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

const sampleWords: SentenceWord[] = [
  makeSentenceWord('1', '学生', 'xue2 sheng1', 'student'),
  makeSentenceWord('2', '继续', 'ji4 xu4', 'to continue/to carry on'),
  makeSentenceWord('3', '房子', 'fang2 zi', 'house/building'),
  makeSentenceWord('4', '学习', 'xue2 xi2', 'to study/to learn'),
];

const sentence: SegmentedSentence = {
  id: 's1',
  chinese: {
    sentence: '學生們，聽好了！',
    simplified: '学生们，听好了！',
    highlight: [[0, 2]],
    segments: [
      { s: '学生', t: '學生', p: 'xué sheng', e: 'student; schoolchild' },
      { s: '们', t: '們', p: 'men', e: 'plural marker for pronouns' },
      { s: '，', t: '，', p: '', e: '' },
      { s: '听', t: '聽', p: 'tīng', e: 'to listen to; to hear' },
      { s: '小李', t: '小李', p: '', e: '' },
    ],
    targetIndex: 0,
  },
  english: { sentence: 'Listen up, students!', highlight: [] },
};

describe('resolveSentence', () => {
  it('builds each word from its segment, with the gloss as its meaning', () => {
    const resolved = resolveSentence(sentence, 'trad');

    expect(resolved.chinese.words[3]).toEqual({
      id: '听 tīng',
      simp: '听',
      trad: '聽',
      pinyin: 'tīng',
      meaning: 'to listen to; to hear',
    });
  });

  it('keeps the target and each segment with no entry as plain strings', () => {
    const resolved = resolveSentence(sentence, 'trad');

    expect(resolved.chinese.words[0]).toBe('學生');
    expect(resolved.chinese.words[2]).toBe('，');
    expect(resolved.chinese.words[4]).toBe('小李');
  });

  it('keeps the sentence, the highlight, the target and the English', () => {
    const resolved = resolveSentence(sentence, 'trad');

    expect(resolved.chinese.sentence).toBe('學生們，聽好了！');
    expect(resolved.chinese.highlight).toEqual([[0, 2]]);
    expect(resolved.chinese.targetIndex).toBe(0);
    expect(resolved.english.sentence).toBe('Listen up, students!');
  });

  it('reads the pinyin line from the simplified text of a traditional sentence', () => {
    const traditional: SegmentedSentence = {
      ...sentence,
      chinese: { ...sentence.chinese, sentence: '我的蘋果沒了。', simplified: '我的苹果没了。' },
    };

    const resolved = resolveSentence(traditional, 'trad');

    expect(resolved.chinese.sentence).toBe('我的蘋果沒了。');
    expect(resolved.chinese.pinyin).toBe('wǒ de píng guǒ méi le。');
  });

  it('gives 們 and 嗎 the neutral tone in a traditional sentence', () => {
    const traditional: SegmentedSentence = {
      ...sentence,
      chinese: { ...sentence.chinese, sentence: '他們會來嗎？', simplified: '他们会来吗？' },
    };

    expect(resolveSentence(traditional, 'trad').chinese.pinyin).toBe('tā men huì lái ma？');
  });

  it('gives the same id to the same entry in two sentences', () => {
    const [a] = [resolveSentence(sentence, 'trad').chinese.words[3]];
    const b = resolveSentence({ ...sentence, id: 's2' }, 'trad').chinese.words[3];

    expect((a as SentenceWord).id).toBe((b as SentenceWord).id);
  });
});

describe('dictionaryEntryOf', () => {
  const word: SentenceWord = {
    id: '行 háng',
    simp: '行',
    trad: '行',
    pinyin: 'háng',
    meaning: 'row; line',
  };

  it('finds the dictionary entry with the pinyin of the segment', async () => {
    vi.mocked(searchWord).mockResolvedValue([
      { id: 10, simp: '行', trad: '行', pinyin: 'xing2', meaning: 'to walk' },
      { id: 11, simp: '行', trad: '行', pinyin: 'hang2', meaning: 'row/line' },
    ]);

    const entry = await dictionaryEntryOf(word);

    expect(searchWord).toHaveBeenCalledWith('行', 'simp');
    expect(entry?.id).toBe(11);
  });

  it('takes the first entry of the same characters when no pinyin fits', async () => {
    vi.mocked(searchWord).mockResolvedValue([
      { id: 20, simp: '行', trad: '行', pinyin: 'xing2', meaning: 'to walk' },
    ]);

    expect((await dictionaryEntryOf(word))?.id).toBe(20);
  });

  it('gives null when the dictionary has no entry', async () => {
    vi.mocked(searchWord).mockResolvedValue([]);

    expect(await dictionaryEntryOf(word)).toBeNull();
  });
});

describe('matchEnglishToSentenceWords', () => {
  it('returns matching words for a single English word', () => {
    const matches = matchEnglishToSentenceWords('student', sampleWords);
    expect(matches).toHaveLength(1);
    expect(matches[0].simp).toBe('学生');
  });

  it('is case insensitive', () => {
    const matches = matchEnglishToSentenceWords('Student', sampleWords);
    expect(matches).toHaveLength(1);
    expect(matches[0].simp).toBe('学生');
  });

  it('matches multi-word phrases like "carry on"', () => {
    const matches = matchEnglishToSentenceWords('carry on', sampleWords);
    expect(matches).toHaveLength(1);
    expect(matches[0].simp).toBe('继续');
  });

  it('returns empty array when no match found', () => {
    const matches = matchEnglishToSentenceWords('airplane', sampleWords);
    expect(matches).toHaveLength(0);
  });

  it('returns empty array for empty query', () => {
    const matches = matchEnglishToSentenceWords('', sampleWords);
    expect(matches).toHaveLength(0);
  });

  it('returns empty array for whitespace-only query', () => {
    const matches = matchEnglishToSentenceWords('   ', sampleWords);
    expect(matches).toHaveLength(0);
  });

  it('matches partial meaning substring', () => {
    const matches = matchEnglishToSentenceWords('study', sampleWords);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((m) => m.simp === '学习')).toBe(true);
  });

  it('falls back to individual word matching when phrase has no match', () => {
    // "big house" won't match as a phrase, but "house" should match individually
    const matches = matchEnglishToSentenceWords('big house', sampleWords);
    expect(matches).toHaveLength(1);
    expect(matches[0].simp).toBe('房子');
  });

  it('returns empty array for empty sentence words', () => {
    const matches = matchEnglishToSentenceWords('hello', []);
    expect(matches).toHaveLength(0);
  });
});
