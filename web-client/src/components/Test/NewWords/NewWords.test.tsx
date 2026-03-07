/**
 * Tests for NewWords component — the "learn new vocabulary" stage.
 *
 * Focus areas:
 * - Renders "New Words" heading and subtitle
 * - Previous Word button is disabled on the first word
 * - Button label is "Next Word" when more words remain, "Start Test" on the last
 * - Next Word button advances through words
 * - Start Test button (last word) calls startTest
 * - ArrowRight key advances word, or calls startTest when already at the last word
 * - ArrowLeft key navigates backwards (no-op when at first word)
 * - Single word: only shows "Start Test"
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('howler', () => ({
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
  },
}));
vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn().mockResolvedValue([]),
  substringMatch: vi.fn().mockResolvedValue([]),
}));

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NewWords from './NewWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../../test/utils';
import { Word } from '../../../types/models';

const makeWord = (id: number, simp: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'ni3',
  meaning: `meaning ${id}`,
  bank: 1,
  due_date: new Date().toISOString(),
});

const word1 = makeWord(1, '一');
const word2 = makeWord(2, '二');
const word3 = makeWord(3, '三');

function makeStore() {
  return createTestStore({
    ...authenticatedState(),
    settings: { speechAvailable: false, synthAvailable: false, voice: null, lang: 'zh-CN' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewWords — heading and subtitle', () => {
  it('renders "New Words" heading', () => {
    renderWithProviders(<NewWords words={[word1]} />, { store: makeStore() });
    expect(screen.getByRole('heading', { name: /new words/i })).toBeInTheDocument();
  });

  it('renders the "click on a character" subtitle', () => {
    renderWithProviders(<NewWords words={[word1]} />, { store: makeStore() });
    expect(screen.getByText(/click on a character/i)).toBeInTheDocument();
  });
});

describe('NewWords — navigation buttons', () => {
  it('Previous Word button is disabled on the first word', () => {
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });
    expect(screen.getByRole('button', { name: /previous word/i })).toBeDisabled();
  });

  it('shows "Next Word" when there are more words ahead', () => {
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });
    expect(screen.getByRole('button', { name: /next word/i })).toBeInTheDocument();
  });

  it('shows "Start Test" on the last word instead of "Next Word"', () => {
    renderWithProviders(<NewWords words={[word1]} />, { store: makeStore() });
    expect(screen.getByRole('button', { name: /start test/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next word/i })).not.toBeInTheDocument();
  });

  it('clicking Next Word advances to the second word', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /next word/i }));

    // Previous Word should now be enabled (we are no longer at index 0)
    expect(screen.getByRole('button', { name: /previous word/i })).not.toBeDisabled();
  });

  it('clicking Start Test calls startTest on the last word', async () => {
    const user = userEvent.setup();
    const startTest = vi.fn();
    renderWithProviders(<NewWords words={[word1]} startTest={startTest} />, {
      store: makeStore(),
    });

    await user.click(screen.getByRole('button', { name: /start test/i }));
    expect(startTest).toHaveBeenCalledTimes(1);
  });

  it('clicking Next Word on the last word calls startTest', async () => {
    const user = userEvent.setup();
    const startTest = vi.fn();
    // Navigate to the last word first, then click the primary button
    renderWithProviders(<NewWords words={[word1, word2]} startTest={startTest} />, {
      store: makeStore(),
    });

    // Advance to word2 (the last word)
    await user.click(screen.getByRole('button', { name: /next word/i }));
    // Now the button label should be "Start Test"
    await user.click(screen.getByRole('button', { name: /start test/i }));
    expect(startTest).toHaveBeenCalledTimes(1);
  });

  it('Previous Word button re-enables after advancing then going back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewWords words={[word1, word2, word3]} />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /next word/i }));
    expect(screen.getByRole('button', { name: /previous word/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /previous word/i }));
    expect(screen.getByRole('button', { name: /previous word/i })).toBeDisabled();
  });
});

describe('NewWords — keyboard navigation', () => {
  it('ArrowRight key advances to the next word', () => {
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });

    fireEvent.keyDown(document, { key: 'ArrowRight' });

    // Previous button should now be enabled (we moved off the first word)
    expect(screen.getByRole('button', { name: /previous word/i })).not.toBeDisabled();
  });

  it('ArrowRight on the last word calls startTest', () => {
    const startTest = vi.fn();
    renderWithProviders(<NewWords words={[word1]} startTest={startTest} />, {
      store: makeStore(),
    });

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(startTest).toHaveBeenCalledTimes(1);
  });

  it('ArrowLeft is a no-op when already at the first word', () => {
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });

    // At index 0 — ArrowLeft should do nothing
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /previous word/i })).toBeDisabled();
  });

  it('ArrowLeft goes back after ArrowRight advanced the index', () => {
    renderWithProviders(<NewWords words={[word1, word2]} />, { store: makeStore() });

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /previous word/i })).not.toBeDisabled();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /previous word/i })).toBeDisabled();
  });
});
