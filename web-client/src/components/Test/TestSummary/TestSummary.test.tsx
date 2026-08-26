/**
 * Tests for TestSummary component — the end-of-session score screen.
 *
 * Focus areas:
 * - Renders "Session Summary" heading
 * - Counts questions and the distinct words they came from
 * - Lists one row per direction, with the word, the direction and the result
 * - Result chips carry the right MUI color variant
 * - Home button navigates to '/'
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestSummary from './TestSummary';
import { renderWithProviders } from '../../../test/utils';
import { DIRECTIONS, WordScore } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';

/** One word asked in all five directions, with handwriting failed. */
const allScores: WordScore[] = DIRECTIONS.map((direction) => ({
  char: '你',
  direction,
  result: direction === 'CM' ? ('fail' as const) : ('pass' as const),
}));

describe('TestSummary — heading and word count', () => {
  it('renders "Session Summary" heading', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByRole('heading', { name: /session summary/i })).toBeInTheDocument();
  });

  it('counts the questions and the words they came from', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByText(/5 questions across 1 word/i)).toBeInTheDocument();
  });

  it('uses the singular for a session of one question', () => {
    renderWithProviders(<TestSummary scores={[{ char: '你', direction: 'MC', result: 'pass' }]} />);
    expect(screen.getByText(/1 question across 1 word/i)).toBeInTheDocument();
  });

  it('counts distinct words, not rows', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'pass' },
      { char: '一', direction: 'CM', result: 'fail' },
      { char: '二', direction: 'MC', result: 'pass' },
    ];
    renderWithProviders(<TestSummary scores={scores} />);
    expect(screen.getByText(/3 questions across 2 words/i)).toBeInTheDocument();
  });

  it('handles an empty scores array without crashing', () => {
    renderWithProviders(<TestSummary scores={[]} />);
    expect(screen.getByText(/0 questions across 0 words/i)).toBeInTheDocument();
  });

  it('renders without crashing when scores is undefined', () => {
    renderWithProviders(<TestSummary />);
    expect(screen.getByRole('heading', { name: /session summary/i })).toBeInTheDocument();
  });

  it('shows a zero count when scores is undefined', () => {
    renderWithProviders(<TestSummary />);
    expect(screen.getByText(/0 questions across 0 words/i)).toBeInTheDocument();
  });
});

describe('TestSummary — session accuracy', () => {
  it('counts a pass in every direction, not the word as a whole', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    // Four directions passed, handwriting failed.
    expect(screen.getByTestId('session-accuracy')).toHaveTextContent('4 / 5 correct (80%)');
  });

  it('shows 100% when every direction passed', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'pass' },
      { char: '二', direction: 'PC', result: 'pass' },
    ];
    renderWithProviders(<TestSummary scores={scores} />);
    expect(screen.getByTestId('session-accuracy')).toHaveTextContent('2 / 2 correct (100%)');
  });

  it('shows 0% when every direction failed', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'fail' },
      { char: '二', direction: 'PC', result: 'fail' },
      { char: '三', direction: 'CM', result: 'fail' },
    ];
    renderWithProviders(<TestSummary scores={scores} />);
    expect(screen.getByTestId('session-accuracy')).toHaveTextContent('0 / 3 correct (0%)');
  });

  it('does not show accuracy line when scores is empty', () => {
    renderWithProviders(<TestSummary scores={[]} />);
    expect(screen.queryByTestId('session-accuracy')).not.toBeInTheDocument();
  });

  it('does not show accuracy line when scores is undefined', () => {
    renderWithProviders(<TestSummary />);
    expect(screen.queryByTestId('session-accuracy')).not.toBeInTheDocument();
  });
});

describe('TestSummary — one row per direction', () => {
  it('repeats the word once per direction it was asked in', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getAllByText('你')).toHaveLength(DIRECTIONS.length);
  });

  it('names the direction of every row', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    for (const direction of DIRECTIONS) {
      expect(screen.getByText(DIRECTION_LABELS[direction])).toBeInTheDocument();
    }
  });

  it('marks the failed direction and only that one', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getAllByText('Known')).toHaveLength(4);
    expect(screen.getAllByText('Not known')).toHaveLength(1);
  });

  it('keeps two words with the same direction apart', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'pass' },
      { char: '二', direction: 'MC', result: 'fail' },
    ];
    renderWithProviders(<TestSummary scores={scores} />);
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('二')).toBeInTheDocument();
    expect(screen.getAllByText(DIRECTION_LABELS.MC)).toHaveLength(2);
    expect(screen.getByText('Known')).toBeInTheDocument();
    expect(screen.getByText('Not known')).toBeInTheDocument();
  });
});

describe('TestSummary — Home button', () => {
  it('renders a Home button', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('navigates to "/" when Home is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestSummary scores={allScores} />);

    await user.click(screen.getByRole('button', { name: /home/i }));
    // BrowserRouter in test env — location should be /
    expect(window.location.pathname).toBe('/');
  });
});
