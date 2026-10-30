/**
 * The disambiguator on the question card. It narrows the question to its own
 * word. It shows with no tap after an alternative answer, and `CM` has a
 * button for it on every question. See issues #348 and #396.
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
  direction: 'MP' | 'MC' | 'PC' | 'CM',
  overrides: Partial<TestState> = {},
): TestState {
  const category = { M: 'meaning', P: 'pinyin', C: 'character' } as const;
  return {
    testSet: [asked],
    currentPair: pairOf(direction),
    chosenCharacter: asked.simp,
    answerCategory: category[direction[0] as 'M' | 'P' | 'C'],
    questionCategory: category[direction[1] as 'M' | 'P' | 'C'],
    question: { M: [asked.meaning], P: asked.pinyin, C: asked.simp }[direction[1]],
    answer: { M: [asked.meaning], P: asked.pinyin, C: asked.simp }[direction[0]],
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

const anyButton = () => screen.queryByRole('button');

describe('QuestionDisplay — the characters of a pinyin question (MP)', () => {
  it.each([
    ['a spoken one-character word', word('是', 'shi4', 'is'), true],
    ['a spoken two-character word', word('权利', 'quan2 li4', 'right'), true],
    ['a written one-character word', word('是', 'shi4', 'is'), false],
    ['a written two-character word', word('权利', 'quan2 li4', 'right'), false],
  ])('offers no characters before an alternative answer, for %s', (_, asked, useSound) => {
    renderCard(questionState(asked, 'MP', { useSound }));

    expect(screen.queryByRole('button', { name: 'Show character' })).not.toBeInTheDocument();
    expect(screen.queryByText(asked.simp)).not.toBeInTheDocument();
  });

  it.each([
    ['a spoken two-character word', true],
    ['a written two-character word', false],
  ])('shows the characters after an alternative answer, for %s', (_, useSound) => {
    const asked = word('权利', 'quan2 li4', 'right');
    renderCard(
      questionState(asked, 'MP', {
        useSound,
        alternativesSent: ['power'],
        showDisambiguator: true,
      }),
    );

    expect(screen.getByText('权利')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide character' })).not.toBeInTheDocument();
  });
});

describe('QuestionDisplay — the pinyin of a character question (MC)', () => {
  const chang = word('长', 'chang2', 'long');

  it('shows no pinyin before an alternative answer', () => {
    renderCard(questionState(chang, 'MC'));

    expect(screen.queryByText('cháng')).not.toBeInTheDocument();
    expect(anyButton()).not.toBeInTheDocument();
  });

  it('shows the pinyin after an alternative answer, with no button', () => {
    renderCard(
      questionState(chang, 'MC', { alternativesSent: ['to grow'], showDisambiguator: true }),
    );

    expect(screen.getByText('cháng')).toBeInTheDocument();
    expect(anyButton()).not.toBeInTheDocument();
  });
});

describe('QuestionDisplay — the meaning of a pinyin answer (PC)', () => {
  const chang = word('长', 'chang2', 'long');

  it('shows no meaning before an alternative answer', () => {
    renderCard(questionState(chang, 'PC'));

    expect(screen.queryByText('long')).not.toBeInTheDocument();
  });

  it('shows the meaning of the asked reading after an alternative answer, never its pinyin', () => {
    renderCard(
      questionState(chang, 'PC', { alternativesSent: ['zhang3'], showDisambiguator: true }),
    );

    expect(screen.getByText('long')).toBeInTheDocument();
    expect(screen.queryByText('cháng')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(anyButton()).not.toBeInTheDocument();
  });
});

describe('QuestionDisplay — the initials of a drawn answer (CM)', () => {
  const changcheng = word('长城', 'Chang2 cheng2', 'the Great Wall');
  const showInitials = () => screen.queryByRole('button', { name: copy.test.showInitials });

  it('offers the initials on every question, before any answer', () => {
    const onToggle = renderCard(questionState(changcheng, 'CM'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    showInitials()!.click();
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows the first letter of each syllable once the learner asks for them', () => {
    renderCard(questionState(changcheng, 'CM', { showDisambiguator: true }));

    expect(screen.getByRole('img', { name: copy.test.initialsLabel('c, c') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.test.hideInitials })).toBeInTheDocument();
  });

  it('takes the button off the reveal', () => {
    renderCard(questionState(changcheng, 'CM', { outcome: 'pass' }));

    expect(showInitials()).not.toBeInTheDocument();
  });
});
