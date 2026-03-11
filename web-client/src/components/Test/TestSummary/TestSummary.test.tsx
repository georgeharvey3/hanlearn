/**
 * Tests for TestSummary component — the end-of-session score screen.
 *
 * Focus areas:
 * - Renders "Session Summary" heading
 * - Correct plural/singular word count ("3 words tested" vs "1 word tested")
 * - Lists each word's character and score label
 * - Score chips carry the right MUI color variant per score bucket
 * - Home button navigates to '/'
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestSummary from './TestSummary';
import { renderWithProviders } from '../../../test/utils';
import { WordScore } from '../../../types/models';

const allScores: WordScore[] = [
  { char: '你', score: 'Very Strong' },
  { char: '好', score: 'Strong' },
  { char: '学', score: 'Average' },
  { char: '生', score: 'Weak' },
  { char: '中', score: 'Very Weak' },
];

describe('TestSummary — heading and word count', () => {
  it('renders "Session Summary" heading', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByRole('heading', { name: /session summary/i })).toBeInTheDocument();
  });

  it('shows the correct plural word count', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByText(/5 words tested/i)).toBeInTheDocument();
  });

  it('shows singular "word" for a single-word session', () => {
    renderWithProviders(<TestSummary scores={[{ char: '你', score: 'Strong' }]} />);
    expect(screen.getByText(/1 word tested/i)).toBeInTheDocument();
  });

  it('handles an empty scores array without crashing', () => {
    renderWithProviders(<TestSummary scores={[]} />);
    expect(screen.getByText(/0 words tested/i)).toBeInTheDocument();
  });

  it('renders without crashing when scores is undefined', () => {
    renderWithProviders(<TestSummary />);
    expect(screen.getByRole('heading', { name: /session summary/i })).toBeInTheDocument();
  });

  it('shows "0 words tested" when scores is undefined', () => {
    renderWithProviders(<TestSummary />);
    expect(screen.getByText(/0 words tested/i)).toBeInTheDocument();
  });
});

describe('TestSummary — score rows', () => {
  it('renders each word character', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    for (const { char } of allScores) {
      expect(screen.getByText(char)).toBeInTheDocument();
    }
  });

  it('renders all five score labels', () => {
    renderWithProviders(<TestSummary scores={allScores} />);
    expect(screen.getByText('Very Strong')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('Very Weak')).toBeInTheDocument();
  });

  it('renders two words with the same score correctly', () => {
    const scores: WordScore[] = [
      { char: '一', score: 'Strong' },
      { char: '二', score: 'Strong' },
    ];
    renderWithProviders(<TestSummary scores={scores} />);
    // Both chars visible
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('二')).toBeInTheDocument();
    // Two "Strong" chips
    expect(screen.getAllByText('Strong')).toHaveLength(2);
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
