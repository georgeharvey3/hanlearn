/**
 * Tests for NothingDue — the Test page when no word is due: one card with the
 * next due count, the other lists with words due, and the ways on.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NothingDue from './NothingDue';
import { renderWithProviders } from '../../../test/utils';

const renderEmpty = (props: Partial<React.ComponentProps<typeof NothingDue>> = {}) => {
  const handlers = {
    onSwitchList: vi.fn(),
    onTestAll: vi.fn(),
    onPractise: vi.fn(),
    onAddWords: vi.fn(),
    onHome: vi.fn(),
  };
  renderWithProviders(
    <NothingDue
      listName="HSK 3"
      hasWords
      next={{ count: 8, days: 1 }}
      otherLists={[]}
      totalDue={0}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('NothingDue', () => {
  it('names the list and gives the next due count', () => {
    renderEmpty();
    expect(screen.getByRole('heading', { name: 'Nothing due in HSK 3' })).toBeInTheDocument();
    expect(screen.getByText('8 due tomorrow')).toBeInTheDocument();
  });

  it('gives a count further ahead in days', () => {
    renderEmpty({ next: { count: 3, days: 4 } });
    expect(screen.getByText('3 due in 4 days')).toBeInTheDocument();
  });

  it('says nothing is due this week when nothing comes up', () => {
    renderEmpty({ next: null });
    expect(screen.getByText('Nothing due this week')).toBeInTheDocument();
  });

  it('offers Practise and Add words', async () => {
    const user = userEvent.setup();
    const { onPractise, onAddWords } = renderEmpty();
    await user.click(screen.getByRole('button', { name: 'Practise' }));
    await user.click(screen.getByRole('button', { name: 'Add words' }));
    expect(onPractise).toHaveBeenCalled();
    expect(onAddWords).toHaveBeenCalled();
  });

  it('has only Add words when the list has no words', () => {
    renderEmpty({ hasWords: false, next: null });
    expect(screen.getByRole('heading', { name: 'No words yet' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing due this week')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Practise' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add words' })).toBeInTheDocument();
  });

  it('lists the other lists with words due, and switches to one on a tap', async () => {
    const user = userEvent.setup();
    const { onSwitchList } = renderEmpty({
      otherLists: [
        { id: 'travel', name: 'Travel', due: 14 },
        { id: 'food', name: 'Food', due: 6 },
      ],
      totalDue: 20,
    });
    expect(screen.getByText('Other lists')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Travel.*14 due/ }));
    expect(onSwitchList).toHaveBeenCalledWith('travel');
  });

  it('tests all lists when other lists have words due', async () => {
    const user = userEvent.setup();
    const { onTestAll } = renderEmpty({
      otherLists: [{ id: 'travel', name: 'Travel', due: 14 }],
      totalDue: 14,
    });
    await user.click(screen.getByRole('button', { name: 'Test all lists · 14' }));
    expect(onTestAll).toHaveBeenCalled();
  });

  it('has no Test all lists when nothing is due anywhere', () => {
    renderEmpty();
    expect(screen.queryByRole('button', { name: /Test all lists/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Other lists')).not.toBeInTheDocument();
  });

  it('closes from the session bar, which has no test settings', async () => {
    const user = userEvent.setup();
    const { onHome } = renderEmpty();
    expect(screen.queryByRole('button', { name: 'Test settings' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(onHome).toHaveBeenCalled();
  });

  it('never shows a word', () => {
    renderEmpty();
    // The seal is the only hanzi, and it is decoration.
    expect(screen.getByText('休')).toHaveAttribute('aria-hidden', 'true');
  });
});
