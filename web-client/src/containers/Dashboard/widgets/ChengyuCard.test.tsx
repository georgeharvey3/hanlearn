/**
 * Tests for ChengyuCard — the Dashboard's chengyu of the day quiz.
 *
 * The pinyin gives away part of the answer, so it stays hidden until the
 * learner asks for it or answers (#437).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../services/wordService', () => ({
  addWordToList: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../services/chengyuSentenceService', () => ({
  getChengyuExampleSentence: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../data/chengyus', () => {
  const charPinyins = [
    { char: '独', pinyin: 'dú', meaning: 'alone' },
    { char: '一', pinyin: 'yī', meaning: 'one' },
    { char: '无', pinyin: 'wú', meaning: 'not to have' },
    { char: '二', pinyin: 'èr', meaning: 'two' },
  ];
  return {
    getDailyChengyu: vi.fn(() => ({
      chengyu: '独一无二',
      tradChengyu: '獨一無二',
      pinyin: 'dú yī wú èr',
      options: ['unique', 'to live frugally'],
      correct: 'unique',
      charPinyins,
      tradCharPinyins: charPinyins,
    })),
    convertDailyChengyu: vi.fn((daily) => ({
      chengyu: daily.chengyu,
      charPinyins: daily.charPinyins,
    })),
  };
});

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { authenticatedState, createTestStore, renderWithProviders } from '../../../test/utils';
import { copy } from '../../../copy';
import ChengyuCard from './ChengyuCard';

const text = copy.dashboard.chengyu;

const renderCard = () =>
  renderWithProviders(<ChengyuCard loading={false} />, {
    store: createTestStore(authenticatedState()),
  });

describe('ChengyuCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hides the pinyin until the learner asks for it', async () => {
    renderCard();
    expect(screen.queryByText('dú')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: text.showPinyin }));

    expect(screen.getByText('dú')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: text.showPinyin })).not.toBeInTheDocument();
  });

  it('shows the pinyin once the quiz is answered', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'to live frugally' }));

    expect(screen.getByText('dú')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: text.showPinyin })).not.toBeInTheDocument();
  });
});
