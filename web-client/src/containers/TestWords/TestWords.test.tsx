/**
 * Tests for TestWords container — the top-level test session orchestrator.
 *
 * Focus areas:
 * - Auth guard (redirect when unauthenticated)
 * - "No words due" empty state with Add Words / Practice buttons
 * - Demo mode bypass (no auth required, fixed demo words)
 * - initWords called on mount for authenticated users
 * - Practice mode starts when Practice button clicked
 * - Stage transitions via stepper labels
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../utils/devTestMode', () => ({ getDevTestConfig: vi.fn().mockReturnValue(null) }));
vi.mock('../../store/actions/index', () => ({
  initWords: vi.fn(() => ({ type: 'INIT_WORDS_NOOP' })),
  finishTest: vi.fn(() => ({ type: 'FINISH_TEST_NOOP' })),
  postWord: vi.fn(() => ({ type: 'POST_WORD_NOOP' })),
}));

// Howler is used by child components — mock it globally
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({ play: vi.fn(), stop: vi.fn() })),
}));

// Module-level refs for capturing props from mocked child components
let capturedTestProps: Record<string, unknown> = {};

// Heavy child components that require their own service deps — mock them out
vi.mock('../../components/Test/Test', () => ({
  default: (props: Record<string, unknown>) => {
    capturedTestProps = props;
    const words = (props.words as { simp: string }[]) ?? [];
    return <div data-testid="mock-test">Test: {words.map((w) => w.simp).join(',')}</div>;
  },
}));
vi.mock('../../components/Test/NewWords/NewWords', () => ({
  default: ({ words }: { words: { simp: string }[] }) => (
    <div data-testid="mock-new-words">NewWords: {words.map((w) => w.simp).join(',')}</div>
  ),
}));
vi.mock('../../components/Test/SentenceRead/SentenceRead', () => ({
  default: () => <div data-testid="mock-sentence-read">SentenceRead</div>,
}));
vi.mock('../../components/Test/SentenceWrite/SentenceWrite', () => ({
  default: () => <div data-testid="mock-sentence-write">SentenceWrite</div>,
}));
vi.mock('../../components/Test/TestSummary/TestSummary', () => ({
  default: () => <div data-testid="mock-test-summary">TestSummary</div>,
}));

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestWords from './TestWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordActions from '../../store/actions/index';

const mockedInitWords = vi.mocked(wordActions.initWords);

// Clear all mock state before every test to avoid cross-test contamination
beforeEach(() => {
  vi.clearAllMocks();
  capturedTestProps = {};
  mockedInitWords.mockReturnValue({ type: 'INIT_WORDS_NOOP' } as ReturnType<
    typeof wordActions.initWords
  >);
});

/** A word that is due today */
function dueWord(id: number, simp: string, bank = 1): import('../../types/models').Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'test',
    meaning: 'test meaning',
    bank,
    due_date: new Date(Date.now() - 1000).toISOString(),
  };
}

/** A word not yet due */
function futureWord(id: number, simp: string, bank = 2): import('../../types/models').Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'test',
    meaning: 'test meaning',
    bank,
    due_date: new Date(Date.now() + 86400000 * 30).toISOString(),
  };
}

describe('TestWords — auth guard', () => {
  it('redirects to / when user is not authenticated', () => {
    const store = createTestStore({
      auth: { userId: null, loading: false, initialized: true, modalOpen: false },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<TestWords />, { store });
    // BrowserRouter rewrites to /, so the TestWords content should not be visible
    expect(screen.queryByText(/no words due/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add words/i })).not.toBeInTheDocument();
  });
});

describe('TestWords — empty bank / no words due', () => {
  it('shows "No words due in active list" when word list is empty', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByText(/no words due in/i)).toBeInTheDocument();
    });
  });

  it('shows Add Words button when no words are due', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add words/i })).toBeInTheDocument();
    });
  });

  it('does NOT show Practice button when bank is empty', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByText(/no words due in/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /practice/i })).not.toBeInTheDocument();
  });

  it('shows Practice button when there are words in bank but none due', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [futureWord(1, '你好')],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /practice/i })).toBeInTheDocument();
    });
  });
});

describe('TestWords — initWords side-effect', () => {
  it('calls initWords on mount when authenticated', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(mockedInitWords).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call initWords in demo mode', async () => {
    renderWithProviders(<TestWords isDemo />, { store: createTestStore() });
    // Small async settle — no calls should happen
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedInitWords).not.toHaveBeenCalled();
  });
});

describe('TestWords — demo mode', () => {
  it('renders demo word without requiring authentication', async () => {
    // No userId in store — demo should bypass auth
    const store = createTestStore({
      auth: { userId: null, loading: false, initialized: true, modalOpen: false },
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: false,
        error: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(<TestWords isDemo />, { store });
    // In demo mode the NewWords stage is shown with the demo word 你好
    await waitFor(() => {
      expect(screen.getByTestId('mock-new-words')).toBeInTheDocument();
    });
  });
});

describe('TestWords — active session with due words', () => {
  it('shows the Test component (vocab stage) when there are due words with bank > 1', async () => {
    // Words with bank > 1 skip the 'new' stage and go directly to 'vocab'
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
  });

  it('shows NewWords stage when there are bank-1 words due', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 1)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByTestId('mock-new-words')).toBeInTheDocument();
    });
  });

  it('renders the stepper with Test and Done steps for bank>1 words', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('renders Learn step in stepper when bank-1 words are included', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 1)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByText('Learn')).toBeInTheDocument();
    });
  });
});

describe('TestWords — practice mode', () => {
  it('starts practice mode (Test stage) when Practice button clicked', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [futureWord(1, '你好')],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    const practiceBtn = await screen.findByRole('button', { name: /practice/i });
    await user.click(practiceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
  });
});

describe('TestWords — stage transitions', () => {
  /**
   * These tests use the capturedTestProps ref populated by the mocked Test component.
   * The mocked Test component stores every prop it receives into capturedTestProps on render,
   * so we can call startSentenceRead / onVocabComplete from the test body.
   */

  it('transitions to read stage when startSentenceRead is called from Test component', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    // Wait for Test to render and capturedTestProps to be populated
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(typeof capturedTestProps.startSentenceRead).toBe('function');
    });

    // Simulate Test calling startSentenceRead with sentence words
    const sentenceWords = [dueWord(2, '学生', 2)];
    (capturedTestProps.startSentenceRead as (words: import('../../types/models').Word[]) => void)(
      sentenceWords,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
    });
  });

  it('transitions to write stage when sentenceReadEnabled=false and startSentenceRead is called', async () => {
    // Disable sentenceRead via localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sentenceRead') return 'false';
      return null;
    });

    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(typeof capturedTestProps.startSentenceRead).toBe('function');
    });

    const sentenceWords = [dueWord(2, '学生', 2)];
    (capturedTestProps.startSentenceRead as (words: import('../../types/models').Word[]) => void)(
      sentenceWords,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-write')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('shows summary stage when onVocabComplete is called from Test component', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(typeof capturedTestProps.onVocabComplete).toBe('function');
    });

    (
      capturedTestProps.onVocabComplete as (
        scores: import('../../types/models').WordScore[],
      ) => void
    )([{ char: '你好', score: 'Strong' }]);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test-summary')).toBeInTheDocument();
    });
  });

  it('shows Practice step in stepper when sentenceReadEnabled=true', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      // Practice step should appear in the stepper (sentenceRead is enabled by default)
      expect(screen.getByText('Practice')).toBeInTheDocument();
    });
  });
});
