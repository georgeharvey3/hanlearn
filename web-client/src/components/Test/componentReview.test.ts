/**
 * Tests for the characters the component review holds after a graded question.
 * See issues #335 and #493.
 */
import { describe, it, expect } from 'vitest';
import { componentsToReview, ReviewShape } from './componentReview';

const cm = (overrides: Partial<ReviewShape> = {}): ReviewShape => ({
  answerCategory: 'character',
  questionCategory: 'meaning',
  chosenCharacter: '你好',
  missedCharIndexes: [],
  ...overrides,
});

describe('componentsToReview', () => {
  it('holds the one character of a missed handwriting question', () => {
    expect(
      componentsToReview(cm({ chosenCharacter: '好', missedCharIndexes: [0] }), 'lapse'),
    ).toEqual(['好']);
  });

  it('holds only the character the hint was used on', () => {
    expect(componentsToReview(cm({ missedCharIndexes: [0] }), 'lapse')).toEqual(['你']);
  });

  it('holds only the character a stroke reached the cap on', () => {
    expect(componentsToReview(cm({ missedCharIndexes: [1] }), 'lapse')).toEqual(['好']);
  });

  it('holds the characters in answer order, each once', () => {
    expect(componentsToReview(cm({ missedCharIndexes: [1, 0, 1] }), 'lapse')).toEqual(['你', '好']);
  });

  it('holds every character after "I don\'t know", which grades a fail', () => {
    expect(componentsToReview(cm({ missedCharIndexes: [] }), 'fail')).toEqual(['你', '好']);
  });

  it('holds nothing after a pass', () => {
    expect(componentsToReview(cm({ missedCharIndexes: [0] }), 'pass')).toEqual([]);
  });

  it.each([
    ['MC', 'meaning', 'character'],
    ['PC', 'pinyin', 'character'],
  ] as const)('holds every character of a missed %s question', (_, answer, question) => {
    const state = cm({ answerCategory: answer, questionCategory: question });
    expect(componentsToReview(state, 'lapse')).toEqual(['你', '好']);
    expect(componentsToReview(state, 'fail')).toEqual(['你', '好']);
  });

  it.each([
    ['MP', 'meaning', 'pinyin'],
    ['PM', 'pinyin', 'meaning'],
  ] as const)('holds nothing after a missed %s question', (_, answer, question) => {
    expect(
      componentsToReview(cm({ answerCategory: answer, questionCategory: question }), 'fail'),
    ).toEqual([]);
  });
});
