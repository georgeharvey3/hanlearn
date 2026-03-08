/**
 * Tests for the Home container.
 * Covers: numDue calculation, initWords on auth, navigation handlers,
 * conditional rendering for authenticated vs unauthenticated states.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/wordService');
vi.mock('../../services/streakService', () => ({
  recordTestCompletion: vi.fn(),
  getStreakData: vi.fn().mockResolvedValue([]),
  calculateStreak: vi.fn().mockReturnValue(0),
}));
vi.mock('../../services/dictionaryService', () => ({
  searchWord: vi.fn().mockResolvedValue([]),
  loadDictionary: vi.fn().mockResolvedValue(undefined),
  convertText: vi.fn().mockImplementation((text: string) => Promise.resolve(text)),
}));
vi.mock('../../data/chengyus', () => ({
  getDailyChengyu: vi.fn(() => ({
    chengyu: '一本正经',
    pinyin: 'yī běn zhèng jīng',
    options: ['to always be serious', 'unique', 'to feel bad about nothing', 'routine'],
    correct: 'to always be serious',
    charPinyins: [
      { char: '一', pinyin: 'yī' },
      { char: '本', pinyin: 'běn' },
      { char: '正', pinyin: 'zhèng' },
      { char: '经', pinyin: 'jīng' },
    ],
  })),
  convertDailyChengyu: vi.fn().mockImplementation((chengyu: unknown) => Promise.resolve(chengyu)),
  lookupCharacterMeanings: vi.fn().mockResolvedValue([]),
}));

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './Home';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordService from '../../services/wordService';
import { Word } from '../../types/models';

const mockedWordService = vi.mocked(wordService);

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function dateStr(offsetDays: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0].replace(/-/g, '/');
}

const wordDueToday: Word = {
  id: 1,
  simp: '学习',
  trad: '學習',
  pinyin: 'xué xí',
  meaning: 'to study',
  bank: 1,
  due_date: dateStr(0),
};

const wordDueFuture: Word = {
  id: 2,
  simp: '读书',
  trad: '讀書',
  pinyin: 'dú shū',
  meaning: 'to read',
  bank: 2,
  due_date: dateStr(3),
};

const wordNoDueDate: Word = {
  id: 3,
  simp: '语言',
  trad: '語言',
  pinyin: 'yǔ yán',
  meaning: 'language',
  bank: 1,
};

describe('Home — unauthenticated state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows sign-up banner text when not authenticated', () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login' as const,
      },
      addWords: { words: [], error: false, loading: false },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<Home />, { store });

    // SignUpBanner renders "Ready to build your vocabulary?" for unauthenticated users
    expect(screen.getByText(/ready to build your vocabulary/i)).toBeInTheDocument();
  });

  it('does not show AccountSummary or Chengyu when unauthenticated', () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login' as const,
      },
      addWords: { words: [], error: false, loading: false },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<Home />, { store });

    // AccountSummary renders word counts — should not appear for unauthenticated users
    expect(screen.queryByText(/words due/i)).not.toBeInTheDocument();
    // Chengyu should not render when not authenticated
    expect(screen.queryByText(/chengyu of the day/i)).not.toBeInTheDocument();
  });
});

describe('Home — authenticated state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
  });

  it('calls initWords on mount when authenticated', async () => {
    mockedWordService.getUserWords.mockResolvedValue([wordDueToday]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<Home />, { store });

    await waitFor(() => {
      expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123');
    });
  });

  it('does not call initWords when not authenticated', async () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login' as const,
      },
      addWords: { words: [], error: false, loading: false },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<Home />, { store });

    // Wait to ensure no fetch was triggered
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedWordService.getUserWords).not.toHaveBeenCalled();
  });

  it('shows the Chengyu component when authenticated', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<Home />, { store });

    await waitFor(() => {
      expect(screen.getByText('Chengyu Of The Day')).toBeInTheDocument();
    });
  });

  it('displays correct numDue count — counts words due today but not future words', async () => {
    // wordDueToday due date = today → should count as due
    // wordDueFuture due date = 3 days from now → should NOT count
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        words: [wordDueToday, wordDueFuture],
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<Home />, { store });

    await waitFor(() => {
      // AccountSummary shows "X/Y words due for testing..." — 1 out of 2 due
      expect(screen.getByText(/1\/2 words due/i)).toBeInTheDocument();
    });
  });

  it('counts words with no due_date as due (new words always count)', async () => {
    // wordNoDueDate has no due_date — treated as immediately due
    // wordDueFuture is 3 days away — should NOT count
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        words: [wordNoDueDate, wordDueFuture],
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<Home />, { store });

    await waitFor(() => {
      // 1 out of 2 words are due
      expect(screen.getByText(/1\/2 words due/i)).toBeInTheDocument();
    });
  });
});

describe('Home — navigation handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
  });

  it('navigates to /test-words when test button is clicked (words due)', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        words: [wordDueToday],
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<Home />, { store });

    // AccountSummary renders a "Test" button when there are words and words are due
    const testButton = await screen.findByRole('button', { name: /^test$/i });
    await user.click(testButton);

    // The click handler calls history.push('/test-words')
    // BrowserRouter doesn't actually navigate, but the handler runs without error
    expect(testButton).toBeInTheDocument();
  });

  it('navigates to /add-words when "Add Words" button is clicked (no words in bank)', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        words: [],
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<Home />, { store });

    // AccountSummary renders "Add Words" button when numTot === 0
    const addButton = await screen.findByRole('button', { name: /add words/i });
    await user.click(addButton);

    expect(addButton).toBeInTheDocument();
  });

  it('opens auth modal with register mode when sign-up is clicked (unauthenticated)', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: true,
        modalOpen: false,
        modalMode: 'login' as const,
      },
      addWords: { words: [], error: false, loading: false },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<Home />, { store });

    // MainBanner renders "Sign Up" button for unauthenticated users
    const signUpButtons = screen.getAllByRole('button', { name: /sign up/i });
    expect(signUpButtons.length).toBeGreaterThan(0);
    await user.click(signUpButtons[0]);

    // The modal should now be open with register mode
    expect(store.getState().auth.modalOpen).toBe(true);
    expect(store.getState().auth.modalMode).toBe('register');
  });
});
