import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInitialState } from './constants';
import { Props } from './types';
import { Word } from '../../types/models';

const mockWords: Word[] = [
  { id: 1, simp: '你好', trad: '你好', pinyin: 'nǐ hǎo', meaning: 'hello' },
  { id: 2, simp: '谢谢', trad: '謝謝', pinyin: 'xiè xiè', meaning: 'thanks' },
];

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    words: mockWords,
    userId: 'test-user',
    isDemo: false,
    devTestFinished: false,
    synthAvailable: false,
    speechAvailable: false,
    voice: null,
    lang: null,
    onComplete: vi.fn(),
    ...overrides,
  } as unknown as Props;
}

describe('createInitialState', () => {
  let originalGetItem: typeof Storage.prototype.getItem;

  beforeEach(() => {
    originalGetItem = localStorage.getItem;
  });

  afterEach(() => {
    localStorage.getItem = originalGetItem;
    localStorage.clear();
  });

  it('returns default values when localStorage is empty', () => {
    const state = createInitialState(makeProps());

    expect(state.numWords).toBe(5);
    expect(state.charSet).toBe('trad');
    expect(state.priority).toBe('none');
    expect(state.onlyPriority).toBe(false);
    expect(state.testFinished).toBe(false);
    expect(state.scoreList).toEqual([]);
  });

  it('reads numWords from localStorage', () => {
    localStorage.setItem('numWords', '10');

    const state = createInitialState(makeProps());
    expect(state.numWords).toBe(10);
  });

  it('reads charSet from localStorage', () => {
    localStorage.setItem('charSet', 'trad');

    const state = createInitialState(makeProps());
    expect(state.charSet).toBe('trad');
  });

  it('reads priority and onlyPriority from localStorage for non-demo mode', () => {
    localStorage.setItem('priority', 'high');
    localStorage.setItem('onlyPriority', 'true');

    const state = createInitialState(makeProps());
    expect(state.priority).toBe('high');
    expect(state.onlyPriority).toBe(true);
  });

  it('ignores priority settings in demo mode', () => {
    localStorage.setItem('priority', 'high');
    localStorage.setItem('onlyPriority', 'true');

    const state = createInitialState(makeProps({ isDemo: true }));
    expect(state.priority).toBe('none');
    expect(state.onlyPriority).toBe(false);
  });

  it('populates scoreList with random scores when devTestFinished is true', () => {
    const state = createInitialState(makeProps({ devTestFinished: true }));

    expect(state.scoreList).toHaveLength(mockWords.length);
    state.scoreList.forEach((score) => {
      expect(['Very Strong', 'Strong', 'Average', 'Weak', 'Very Weak']).toContain(score.score);
    });
    expect(state.testFinished).toBe(true);
  });

  it('uses trad characters by default for devTestFinished scoreList', () => {
    const state = createInitialState(makeProps({ devTestFinished: true }));

    expect(state.scoreList[0].char).toBe('你好');
    expect(state.scoreList[1].char).toBe('謝謝');
  });

  it('uses simp characters when charSet is simp for devTestFinished scoreList', () => {
    localStorage.setItem('charSet', 'simp');

    const state = createInitialState(makeProps({ devTestFinished: true }));

    expect(state.scoreList[0].char).toBe('你好');
    expect(state.scoreList[1].char).toBe('谢谢');
  });

  it('initializes all UI state fields to their defaults', () => {
    const state = createInitialState(makeProps());

    expect(state.testSet).toEqual([]);
    expect(state.permList).toEqual([]);
    expect(state.perm).toBeNull();
    expect(state.answer).toBeNull();
    expect(state.question).toBeNull();
    expect(state.result).toBe('');
    expect(state.answerInput).toBe('');
    expect(state.idkDisabled).toBe(false);
    expect(state.submitDisabled).toBe(false);
    expect(state.progressBar).toBe(0);
    expect(state.qNum).toBe(0);
    expect(state.showPinyin).toBe(false);
    expect(state.showHint).toBe(false);
    expect(state.showAnswer).toBe(false);
    expect(state.useSound).toBe(true);
    expect(state.useSoundEffects).toBe(true);
    expect(state.useHandwriting).toBe(true);
    expect(state.meaningQuizType).toBe('input');
    expect(state.pinyinQuizType).toBe('input');
  });
});
