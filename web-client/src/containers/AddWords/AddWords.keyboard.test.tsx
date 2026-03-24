/**
 * Tests for AddWords container — keyboard interactions and navigation paths
 * that are not covered by AddWords.test.tsx:
 *
 * 1. Clash table row keyboard navigation (Enter/Space selects the entry)
 * 2. Custom word meaning submission via Enter key
 * 3. Escape key dismisses open modals
 * 4. "Test" button navigates to /test-words
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/wordService');
vi.mock('../../services/streakService', () => ({
  recordTestCompletion: vi.fn(),
  getStreakData: vi.fn().mockResolvedValue([]),
  calculateStreak: vi.fn().mockReturnValue(0),
}));

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AddWords from './AddWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordService from '../../services/wordService';
import { Word } from '../../types/models';

const mockedWordService = vi.mocked(wordService);

const sampleWord: Word = {
  id: 42,
  simp: '学习',
  trad: '學習',
  pinyin: 'xué xí',
  meaning: 'to study',
  level: 1,
  due_date: '2026/03/10',
};

const sampleWord2: Word = {
  id: 43,
  simp: '学习',
  trad: '學習',
  pinyin: 'xué',
  meaning: 'to learn',
  level: 1,
  due_date: '2026/03/10',
};

function submitSearch(input: HTMLElement) {
  const form = input.closest('form');
  if (form) fireEvent.submit(form);
}

// ---------------------------------------------------------------------------
// Clash table row: keyboard navigation (Enter/Space)
// ---------------------------------------------------------------------------
describe('AddWords — clash table row keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
  });

  it('selecting a clash row with Enter key opens the confirm modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord, sampleWord2]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    // Wait for clash table
    await waitFor(() => screen.getByText(/select entry for/i));

    // Find the first clash row by pinyin text and fire Enter keydown
    const pinyinCell = await screen.findByText('xué xí');
    const row = pinyinCell.closest('tr');
    expect(row).toBeTruthy();

    // Fire Enter keydown on the row
    fireEvent.keyDown(row!, { key: 'Enter', code: 'Enter' });

    // The confirm modal should now be shown
    await waitFor(() => {
      expect(screen.getByText(/add to word list\?/i)).toBeInTheDocument();
    });
  });

  it('selecting a clash row with Space key opens the confirm modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord, sampleWord2]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => screen.getByText(/select entry for/i));

    const pinyinCell = await screen.findByText('xué xí');
    const row = pinyinCell.closest('tr');
    expect(row).toBeTruthy();

    fireEvent.keyDown(row!, { key: ' ', code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText(/add to word list\?/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Custom word: Enter key submits the meaning
// ---------------------------------------------------------------------------
describe('AddWords — custom word: Enter key submits meaning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addCustomWord.mockResolvedValue({
      id: 99,
      simp: 'testword',
      trad: 'testword',
      pinyin: '',
      meaning: 'a custom meaning',
      level: 1,
    });
  });

  it('pressing Enter in the meaning input submits the custom word', async () => {
    mockedWordService.searchWord.mockResolvedValue([]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'testword');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/word not found/i)).toBeInTheDocument();
    });

    const meaningInput = screen.getByLabelText(/enter word meaning/i);
    await userEvent.type(meaningInput, 'a custom meaning');

    // Submit via Enter key instead of clicking the Submit button
    fireEvent.keyDown(meaningInput, { key: 'Enter', code: 'Enter' });
    // The meaningKeyPressed handler fires on keydown of Enter
    // We need to also fire keyup to match the full event sequence
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockedWordService.addCustomWord).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Escape key: dismisses open modals
// ---------------------------------------------------------------------------
describe('AddWords — Escape key dismisses modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
  });

  it('Escape key dismisses the error/duplicate modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
    const store = createTestStore({
      ...authenticatedState(),
      addWords: { words: [sampleWord], error: false, loading: false },
    });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    // Should show duplicate error modal
    await waitFor(() => {
      expect(screen.getByText(/already in your list/i)).toBeInTheDocument();
    });

    // Press Escape to dismiss
    fireEvent.keyUp(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/already in your list/i)).not.toBeInTheDocument();
    });
  });

  it('Escape key dismisses the custom meaning input modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'unknownword');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/word not found/i)).toBeInTheDocument();
    });

    fireEvent.keyUp(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/word not found/i)).not.toBeInTheDocument();
    });
  });

  it('Escape key dismisses the clash table modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord, sampleWord2]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/select entry for/i)).toBeInTheDocument();
    });

    fireEvent.keyUp(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/select entry for/i)).not.toBeInTheDocument();
    });
  });

  it('Escape key dismisses the confirm-add modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/add to word list\?/i)).toBeInTheDocument();
    });

    fireEvent.keyUp(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/add to word list\?/i)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// "Test" button navigates to /test-words
// ---------------------------------------------------------------------------
describe('AddWords — "Test" button navigates to test page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
  });

  it('renders the "Test" button when words are in the list', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: { words: [sampleWord], error: false, loading: false },
    });

    renderWithProviders(<AddWords />, { store });

    const testButton = await screen.findByRole('button', { name: /^test$/i });
    expect(testButton).toBeInTheDocument();
  });

  it('clicking the "Test" button does not throw and changes location', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: { words: [sampleWord], error: false, loading: false },
    });

    renderWithProviders(<AddWords />, { store });

    const testButton = await screen.findByRole('button', { name: /^test$/i });
    // Should not throw
    await userEvent.click(testButton);

    // With BrowserRouter in jsdom, window.location.pathname updates
    expect(window.location.pathname).toBe('/test-words');
  });
});
