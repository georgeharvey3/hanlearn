/**
 * Tests for AddWords container — the user-facing word search and add-to-list flow.
 * Firebase service layer is mocked at the service level (not Firebase SDK).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/wordService');
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));
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
import * as ttsService from '../../services/ttsService';
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

/** Submit the search form by finding the form ancestor of the given input. */
function submitSearch(input: HTMLElement) {
  const form = input.closest('form');
  if (form) fireEvent.submit(form);
}

describe('AddWords — word search and add flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
    mockedWordService.searchWord.mockResolvedValue([]);
  });

  it('renders the word search input', () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows "Add words to start learning" when user has no words', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });
    await waitFor(() => {
      expect(screen.getByText(/add words to start learning/i)).toBeInTheDocument();
    });
  });

  it('shows word list entries when words exist in the store', () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });
    expect(screen.getByText('學習')).toBeInTheDocument();
    expect(screen.getByText('xué xí')).toBeInTheDocument();
  });

  it('searching for a single-result word shows the confirm modal', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/add to word list/i)).toBeInTheDocument();
    });
  });

  it('shows a duplicate error when the searched word is already in the list', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
    // getUserWords returns the word so initWords doesn't clear the store
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/already in your list/i)).toBeInTheDocument();
    });
  });

  it('shows custom meaning input when search returns no dictionary match', async () => {
    mockedWordService.searchWord.mockResolvedValue([]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'xyz');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/word not found/i)).toBeInTheDocument();
    });
  });

  it('shows clash table when search returns multiple matches', async () => {
    const word2: Word = { ...sampleWord, id: 43, pinyin: 'xué', meaning: 'to learn' };
    mockedWordService.searchWord.mockResolvedValue([sampleWord, word2]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学');
    submitSearch(input);

    await waitFor(() => {
      expect(screen.getByText(/select entry for/i)).toBeInTheDocument();
    });
  });

  it('closes confirm modal when Cancel is clicked', async () => {
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    submitSearch(input);

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/add to word list/i)).not.toBeInTheDocument();
    });
  });
});

describe('AddWords — remove words from list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
    mockedWordService.removeWordFromList.mockResolvedValue(undefined);
  });

  it('calls removeWordFromList when the Remove icon button is clicked', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });

    const removeButton = await screen.findByRole('button', { name: /remove word/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(mockedWordService.removeWordFromList).toHaveBeenCalledWith(
        'test-user-123',
        sampleWord.id,
      );
    });
  });
});

describe('AddWords — unauthenticated state', () => {
  it('shows a spinner while auth is initializing', () => {
    const store = createTestStore({
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: false,
        modalOpen: false,
        modalMode: 'login' as const,
      },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<AddWords />, { store });
    // Spinner renders an SVG while auth initializes
    expect(document.querySelector('svg')).toBeTruthy();
  });
});

describe('AddWords — error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.searchWord.mockResolvedValue([]);
  });

  it('shows error message when addWords.error is true and words exist', () => {
    // The error text renders in the table slot, which only shows when words.length > 0
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: true,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });
    expect(screen.getByText(/error: could not fetch words/i)).toBeInTheDocument();
  });

  it('shows network error alert when word search fails', async () => {
    mockedWordService.searchWord.mockRejectedValue(new Error('Network error'));
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/could not search for word. please check your connection/i),
      ).toBeInTheDocument();
    });
  });
});

describe('AddWords — confirmAddWord with edited meaning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
  });

  it('calls onPostWord with the original word when Add is clicked without editing meaning', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    // Wait for confirm modal to appear
    await waitFor(() => screen.getByText(/add to word list/i));

    // Use the "Add" button specifically — the modal has a contained primary button
    // The MeaningEditor also renders an "Add" chip, so we find the specific modal footer button
    const allAddButtons = screen.getAllByRole('button', { name: /^add$/i });
    // The MUI Button (not Chip) has type="button" and is the last of the "Add" buttons
    const addButton = allAddButtons[allAddButtons.length - 1];
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(mockedWordService.addWordToList).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ id: 42, simp: '学习' }),
        'default',
      );
    });
  });

  it('closes the confirm modal when Add is clicked (modal dismisses)', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    // Wait for confirm modal to appear
    await waitFor(() => screen.getByText(/add to word list/i));

    // Click "Add" button in the modal footer (last of the Add buttons)
    const allAddButtons = screen.getAllByRole('button', { name: /^add$/i });
    const addButton = allAddButtons[allAddButtons.length - 1];
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.queryByText(/add to word list/i)).not.toBeInTheDocument();
    });
  });
});

describe('AddWords — clash table row interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
  });

  it('clicking a clash table row opens the confirm modal for that word', async () => {
    const word2: Word = { ...sampleWord, id: 43, pinyin: 'xué', meaning: 'to learn' };
    mockedWordService.searchWord.mockResolvedValue([sampleWord, word2]);
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    // Wait for clash table
    await waitFor(() => screen.getByText(/select entry for/i));

    // Click the first clash row (sampleWord's pinyin)
    const pinyinCell = await screen.findByText('xué xí');
    await userEvent.click(pinyinCell);

    // The confirm modal should now be shown
    await waitFor(() => {
      expect(screen.getByText(/add to word list/i)).toBeInTheDocument();
    });
  });
});

describe('AddWords — toggle show/hide table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
    mockedWordService.removeWordFromList.mockResolvedValue(undefined);
  });

  it('hides the word table when "Hide Table" is clicked and restores it when "Show Table" is clicked', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });

    // Initially the table should be visible
    expect(screen.getByText('學習')).toBeInTheDocument();

    // Click "Hide Table"
    const hideBtn = screen.getByRole('button', { name: /hide table/i });
    await userEvent.click(hideBtn);

    // Table should be hidden now
    await waitFor(() => {
      expect(screen.queryByText('xué xí')).not.toBeInTheDocument();
    });

    // Click "Show Table"
    const showBtn = screen.getByRole('button', { name: /show table/i });
    await userEvent.click(showBtn);

    // Table should reappear
    await waitFor(() => {
      expect(screen.getByText('xué xí')).toBeInTheDocument();
    });
  });
});

describe('AddWords — search error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
  });

  it('shows an error alert when searchWord throws', async () => {
    mockedWordService.searchWord.mockRejectedValue(new Error('Network error'));
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not search/i);
  });
});

describe('AddWords — confirm modal: adding word with edited meaning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.addWordToList.mockResolvedValue(undefined);
    mockedWordService.searchWord.mockResolvedValue([sampleWord]);
  });

  it('shows "Add to Word List?" heading in confirm modal', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/add to word list\?/i)).toBeInTheDocument();
    });
  });

  it('calls addWordToList when Add is confirmed', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '学习');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    // Wait for confirm modal
    await waitFor(() => screen.getByText(/add to word list\?/i));
    // The "Add" button is the primary action in the modal footer
    // Use getAllByRole to find the correct one (not the MUI Chip "Add" icon)
    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    // The primary Add button is an <button> element (not a chip), so filter by tagName
    const addBtn = addButtons.find(
      (btn) => btn.tagName === 'BUTTON' && btn.getAttribute('type') === 'button',
    );
    if (addBtn) await userEvent.click(addBtn);

    await waitFor(() => {
      expect(mockedWordService.addWordToList).toHaveBeenCalled();
    });
  });
});

describe('AddWords — pronunciation playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([sampleWord]);
  });

  it('calls ttsService.speak when the play pronunciation button is clicked', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [sampleWord],
        listStats: {},
        error: false,
        loading: false,
      },
    });
    renderWithProviders(<AddWords />, { store });

    const playButtons = await screen.findAllByRole('button', { name: /play pronunciation/i });
    expect(playButtons.length).toBeGreaterThan(0);
    await userEvent.click(playButtons[0]);

    expect(ttsService.speak).toHaveBeenCalledWith(
      '學習',
      expect.objectContaining({ onEnd: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});

describe('AddWords — custom word (meaning input flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWordService.getUserWords.mockResolvedValue([]);
    mockedWordService.searchWord.mockResolvedValue([]);
    mockedWordService.addCustomWord.mockResolvedValue({
      id: 99,
      simp: 'xyz',
      trad: 'xyz',
      pinyin: '',
      meaning: 'a test meaning',
      level: 1,
      due_date: new Date().toISOString(),
    });
  });

  it('can type a custom meaning and submit it', async () => {
    const store = createTestStore({ ...authenticatedState() });
    renderWithProviders(<AddWords />, { store });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'xyz');
    const form = input.closest('form');
    if (form) fireEvent.submit(form);

    // Wait for the custom meaning input to appear
    await waitFor(() => {
      expect(screen.getByText(/word not found/i)).toBeInTheDocument();
    });

    const meaningInput = screen.getByLabelText(/enter word meaning/i);
    await userEvent.type(meaningInput, 'a test meaning');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockedWordService.addCustomWord).toHaveBeenCalled();
    });
  });
});
