import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import AnswerInput from './AnswerInput';
import { TestState } from './types';

const baseState = {
  answerInput: '',
  showAnswer: false,
  yesClicked: false,
  noClicked: false,
  useSound: false,
  useFlashcards: false,
  useChineseSpeechRecognition: false,
  useEnglishSpeechRecognition: false,
  useAutoRecord: false,
  useTypingInput: true,
  showInput: false,
  answerCategory: 'character',
  recognition: null,
} as unknown as TestState;

const noop = () => {};

describe('AnswerInput — handwriting canvas', () => {
  it('renders the handwriting canvas with an accessible label', () => {
    render(
      <AnswerInput
        state={baseState}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={noop}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={noop as any}
      />,
    );
    const canvas = document.getElementById('character-target-div');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-label');
    expect(canvas?.getAttribute('aria-label')).toMatch(/draw/i);
  });

  it('renders placeholder text in the handwriting canvas', () => {
    render(
      <AnswerInput
        state={baseState}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={noop}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={noop as any}
      />,
    );
    expect(screen.getByText(/draw here/i)).toBeInTheDocument();
  });
});
