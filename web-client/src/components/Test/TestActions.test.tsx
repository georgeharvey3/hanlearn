/**
 * Tests for TestActions — the button row below the answer area.
 *
 * The hint for a meaning question comes from a generated example sentence,
 * which can take some seconds. While it loads, the button must show that
 * work is in progress and must not accept a second click.
 */
import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

import TestActions from './TestActions';
import { TestState } from './types';

const baseState = {
  idkDisabled: false,
  showAnswer: false,
  showHint: false,
  hintLoading: false,
  useSound: false,
  answerCategory: 'meaning',
  questionCategory: 'character',
  chosenCharacter: '你好',
  result: '',
} as unknown as TestState;

const noop = () => {};

const renderActions = (state: TestState, onHint = noop) =>
  render(<TestActions state={state} onIDontKnow={noop} onHint={onHint} showCharacter={noop} />);

describe('TestActions hint button', () => {
  it('shows the hint label when no hint is loading', () => {
    renderActions(baseState);

    expect(screen.getByRole('button', { name: 'Show Hint' })).toBeEnabled();
  });

  it('shows a loading indicator while the hint loads', () => {
    renderActions({ ...baseState, hintLoading: true });

    const button = screen.getByRole('button', { name: /Loading Hint/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not call onHint again while the hint loads', () => {
    const onHint = vi.fn();
    renderActions({ ...baseState, hintLoading: true }, onHint);

    fireEvent.click(screen.getByRole('button', { name: /Loading Hint/ }));

    expect(onHint).not.toHaveBeenCalled();
  });
});
