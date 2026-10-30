/**
 * The disambiguator on the question card. It narrows the question to its own
 * word, so it shows only after an alternative answer. See issue #348.
 */
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import QuestionDisplay from './QuestionDisplay';
import { TestState } from './types';
import { QueuePair, Word } from '../../types/models';
import { copy } from '../../copy';

const word = (simp: string, pinyin: string, meaning: string): Word => ({
  id: 1,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

const pairOf = (direction: string): QueuePair => ({
  index: '0',
  aCategory: direction[0] as QueuePair['aCategory'],
  qCategory: direction[1] as QueuePair['qCategory'],
});

/** The state of an open typed question, before any answer. */
function questionState(
  asked: Word,
  direction: 'MP' | 'MC' | 'PC',
  overrides: Partial<TestState> = {},
): TestState {
  const category = { M: 'meaning', P: 'pinyin', C: 'character' } as const;
  return {
    testSet: [asked],
    currentPair: pairOf(direction),
    chosenCharacter: asked.simp,
    answerCategory: category[direction[0] as 'M' | 'P'],
    questionCategory: category[direction[1] as 'P' | 'C'],
    question: direction[1] === 'P' ? asked.pinyin : asked.simp,
    answer: direction[0] === 'P' ? asked.pinyin : [asked.meaning],
    meaningQuizType: 'input',
    pinyinQuizType: 'input',
    useSound: true,
    showPinyin: false,
    showQuestionPinyin: false,
    showDisambiguator: false,
    alternativesSent: [],
    outcome: null,
    showAnswer: false,
    showHint: false,
    hint: null,
    componentReviewChars: [],
    gradeCap: 'pass',
    synthLoading: false,
    ...overrides,
  } as TestState;
}

function renderCard(state: TestState) {
  const onToggleDisambiguator = vi.fn();
  render(
    <QuestionDisplay
      state={state}
      onSpeak={vi.fn()}
      onPlayHintSentence={vi.fn()}
      onToggleShowPinyin={vi.fn()}
      onToggleDisambiguator={onToggleDisambiguator}
    />,
  );
  return onToggleDisambiguator;
}

const showCharacter = () => screen.queryByRole('button', { name: copy.test.showCharacter });

describe('QuestionDisplay — the characters of a pinyin question (MP)', () => {
  it.each([
    ['a spoken one-character word', word('是', 'shi4', 'is'), true],
    ['a spoken two-character word', word('权利', 'quan2 li4', 'right'), true],
    ['a written one-character word', word('是', 'shi4', 'is'), false],
    ['a written two-character word', word('权利', 'quan2 li4', 'right'), false],
  ])('offers no characters before an alternative answer, for %s', (_, asked, useSound) => {
    renderCard(questionState(asked, 'MP', { useSound }));

    expect(showCharacter()).not.toBeInTheDocument();
    expect(screen.queryByText(asked.simp)).not.toBeInTheDocument();
  });

  it.each([
    ['a spoken one-character word', word('是', 'shi4', 'is'), true],
    ['a spoken two-character word', word('权利', 'quan2 li4', 'right'), true],
    ['a written one-character word', word('是', 'shi4', 'is'), false],
    ['a written two-character word', word('权利', 'quan2 li4', 'right'), false],
  ])('offers the characters after an alternative answer, for %s', (_, asked, useSound) => {
    const onToggle = renderCard(
      questionState(asked, 'MP', { useSound, alternativesSent: ['matter'] }),
    );

    showCharacter()!.click();
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows the characters once the learner asks for them', () => {
    const asked = word('权利', 'quan2 li4', 'right');
    renderCard(
      questionState(asked, 'MP', {
        useSound: false,
        alternativesSent: ['power'],
        showDisambiguator: true,
      }),
    );

    expect(screen.getByText('权利')).toBeInTheDocument();
  });
});

describe('QuestionDisplay — the pinyin of a character question (MC)', () => {
  const chang = word('长', 'chang2', 'long');
  const showPinyin = () => screen.queryByRole('button', { name: copy.test.showPinyin });

  it('offers no pinyin before an alternative answer', () => {
    renderCard(questionState(chang, 'MC'));

    expect(showPinyin()).not.toBeInTheDocument();
  });

  it('offers the pinyin after an alternative answer, and shows it on request', () => {
    const onToggle = renderCard(questionState(chang, 'MC', { alternativesSent: ['to grow'] }));
    showPinyin()!.click();
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows the pinyin once the learner asks for it', () => {
    renderCard(
      questionState(chang, 'MC', { alternativesSent: ['to grow'], showDisambiguator: true }),
    );

    expect(screen.getByText('cháng')).toBeInTheDocument();
  });

  it('never offers the pinyin when the pinyin is the answer (PC)', () => {
    renderCard(questionState(chang, 'PC', { alternativesSent: ['zhang3'] }));

    expect(showPinyin()).not.toBeInTheDocument();
  });
});
