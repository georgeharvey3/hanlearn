import { vi, describe, it, expect } from 'vitest';

vi.mock('../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import { matchEnglishToSentenceWords, SentenceWord } from './sentenceUtils';

const makeSentenceWord = (
  id: number,
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
  makeSentenceWord(1, '学生', 'xue2 sheng1', 'student'),
  makeSentenceWord(2, '继续', 'ji4 xu4', 'to continue/to carry on'),
  makeSentenceWord(3, '房子', 'fang2 zi', 'house/building'),
  makeSentenceWord(4, '学习', 'xue2 xi2', 'to study/to learn'),
];

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
