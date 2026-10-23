/**
 * Tests for TestSummary — the end-of-session screen: a score card over one
 * tile for each question.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestSummary from './TestSummary';
import { renderWithProviders } from '../../../test/utils';
import { Word, WordScore } from '../../../types/models';

const word = (id: number, simp: string, pinyin: string, meaning: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

const words = [
  word(1, '银行', 'yin2 hang2', 'bank'),
  word(2, '护照', 'hu4 zhao4', 'passport'),
  word(3, '安静', 'an1 jing4', 'quiet'),
];

const scores: WordScore[] = [
  { char: '银行', direction: 'MC', result: 'pass' },
  { char: '银行', direction: 'PM', result: 'pass' },
  { char: '护照', direction: 'CM', result: 'fail' },
  { char: '安静', direction: 'MP', result: 'lapse' },
];

const renderSummary = (props: Partial<React.ComponentProps<typeof TestSummary>> = {}) => {
  const onHome = vi.fn();
  const onPracticeMissed = vi.fn();
  renderWithProviders(
    <TestSummary
      scores={scores}
      words={words}
      practiceMode={false}
      onHome={onHome}
      onPracticeMissed={onPracticeMissed}
      {...props}
    />,
  );
  return { onHome, onPracticeMissed };
};

const tiles = () => screen.getAllByRole('button', { name: /, (Known|Nearly|Not known)/ });

describe('TestSummary — score card', () => {
  it('shows the known questions out of all of them', () => {
    renderSummary();
    expect(screen.getByTestId('summary-score')).toHaveTextContent('2/ 4');
  });

  it('counts the questions and the distinct words', () => {
    renderSummary();
    expect(screen.getByText('4 questions · 3 words')).toBeInTheDocument();
  });

  it('says a practice session changed no due dates', () => {
    renderSummary({ practiceMode: true });
    expect(screen.getByText('Practice · due dates unchanged')).toBeInTheDocument();
    expect(screen.queryByText('4 questions · 3 words')).not.toBeInTheDocument();
  });

  it('counts each result', () => {
    renderSummary();
    expect(screen.getByRole('button', { name: '2 Known' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Nearly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Not known' })).toBeInTheDocument();
  });

  it('disables a count of zero', () => {
    renderSummary({ scores: scores.filter((s) => s.result === 'pass') });
    expect(screen.getByRole('button', { name: '0 Not known' })).toBeDisabled();
  });
});

describe('TestSummary — tiles', () => {
  it('shows one tile for each question, the missed ones first', () => {
    renderSummary();
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      '护照, Not known',
      '安静, Nearly',
      '银行, Known',
      '银行, Known',
    ]);
  });

  it('turns a tile to its pinyin and meaning on a tap, one tile at a time', async () => {
    const user = userEvent.setup();
    renderSummary();
    await user.click(screen.getByRole('button', { name: '护照, Not known' }));
    const turned = screen.getByRole('button', { name: /护照, Not known: hù zhào/ });
    expect(turned).toHaveAttribute('aria-pressed', 'true');
    expect(within(turned).getByText('passport')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '安静, Nearly' }));
    expect(screen.getByRole('button', { name: '护照, Not known' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('quiet')).toBeInTheDocument();
  });

  it('turns a tile back on a second tap', async () => {
    const user = userEvent.setup();
    renderSummary();
    await user.click(screen.getByRole('button', { name: '护照, Not known' }));
    await user.click(screen.getByRole('button', { name: /护照, Not known: / }));
    expect(screen.queryByText('passport')).not.toBeInTheDocument();
  });

  it('filters the tiles by a count, and shows all again on a second tap', async () => {
    const user = userEvent.setup();
    renderSummary();
    const count = screen.getByRole('button', { name: '2 Known' });
    await user.click(count);
    expect(count).toHaveAttribute('aria-pressed', 'true');
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      '银行, Known',
      '银行, Known',
    ]);
    await user.click(count);
    expect(tiles()).toHaveLength(4);
  });
});

describe('TestSummary — buttons', () => {
  it('goes back to the Dashboard', async () => {
    const user = userEvent.setup();
    const { onHome } = renderSummary();
    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(onHome).toHaveBeenCalled();
  });

  it('closes from the session bar', async () => {
    const user = userEvent.setup();
    const { onHome } = renderSummary();
    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(onHome).toHaveBeenCalled();
  });

  it('practises the missed words', async () => {
    const user = userEvent.setup();
    const { onPracticeMissed } = renderSummary();
    await user.click(screen.getByRole('button', { name: 'Practise missed words' }));
    expect(onPracticeMissed.mock.calls[0][0].map((w: Word) => w.id)).toEqual([2, 3]);
  });

  it('has no "Practise missed words" when every question was known', () => {
    renderSummary({ scores: scores.filter((s) => s.result === 'pass') });
    expect(screen.queryByRole('button', { name: 'Practise missed words' })).not.toBeInTheDocument();
  });

  it('has no test settings in the session bar', () => {
    renderSummary();
    expect(screen.queryByRole('button', { name: 'Test settings' })).not.toBeInTheDocument();
  });
});
