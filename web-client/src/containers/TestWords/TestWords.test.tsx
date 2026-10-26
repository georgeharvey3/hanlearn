/**
 * Tests for TestWords container — the top-level test session orchestrator.
 *
 * Focus areas:
 * - Auth guard (redirect when unauthenticated)
 * - "Nothing due" screen with Add words / Practise buttons
 * - Demo mode bypass (no auth required, fixed demo words)
 * - initWords called on mount for authenticated users
 * - Practice mode starts when Practise is clicked
 * - "Practise missed words" on the summary practises those words only
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../utils/devTestMode', () => ({ getDevTestConfig: vi.fn().mockReturnValue(null) }));
vi.mock('../../store/actions/index', () => ({
  initWords: vi.fn(() => ({ type: 'INIT_WORDS_NOOP' })),
  finishTest: vi.fn(() => ({ type: 'FINISH_TEST_NOOP' })),
  postWord: vi.fn(() => ({ type: 'POST_WORD_NOOP' })),
  switchActiveList: vi.fn(() => ({ type: 'SWITCH_LIST_NOOP' })),
}));

// Howler is used by child components — mock it globally
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({ play: vi.fn(), stop: vi.fn() })),
}));

// Module-level refs for capturing props from mocked child components
let capturedTestProps: Record<string, unknown> = {};
let capturedSummaryProps: Record<string, unknown> = {};

// Heavy child components that require their own service deps — mock them out
vi.mock('../../components/Test/Test', () => ({
  default: (props: Record<string, unknown>) => {
    capturedTestProps = props;
    const words = (props.words as { simp: string }[]) ?? [];
    return <div data-testid="mock-test">Test: {words.map((w) => w.simp).join(',')}</div>;
  },
}));
vi.mock('../../components/Test/NewWords/NewWords', () => ({
  default: ({ words }: { words: { simp: string }[] }) => {
    return <div data-testid="mock-new-words">NewWords: {words.map((w) => w.simp).join(',')}</div>;
  },
}));
vi.mock('../../components/Test/SentenceRead/SentenceRead', () => ({
  default: () => <div data-testid="mock-sentence-read">SentenceRead</div>,
}));
vi.mock('../../components/Test/SentenceWrite/SentenceWrite', () => ({
  default: () => <div data-testid="mock-sentence-write">SentenceWrite</div>,
}));
vi.mock('../../components/Test/TestSummary/TestSummary', () => ({
  default: (props: Record<string, unknown>) => {
    capturedSummaryProps = props;
    return <div data-testid="mock-test-summary">TestSummary</div>;
  },
}));

import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestWords from './TestWords';
import { clearSavedSession } from '../../utils/savedSession';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordActions from '../../store/actions/index';

const mockedInitWords = vi.mocked(wordActions.initWords);

/** Walk the session to the summary: the test, then its scores. */
async function reachSummary(scores: unknown[]): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
  act(() => (capturedTestProps.onVocabComplete as (scores: unknown[]) => void)(scores));
  await waitFor(() => expect(screen.getByTestId('mock-test-summary')).toBeInTheDocument());
}

// Clear all mock state before every test to avoid cross-test contamination
beforeEach(() => {
  vi.clearAllMocks();
  capturedTestProps = {};
  capturedSummaryProps = {};
  mockedInitWords.mockReturnValue(() => {});
  // Each test starts a session, and a session that does not finish is saved so
  // that it can be resumed. Without this, every test after the first would be
  // offered the one before it rather than starting clean. See issue #305.
  clearSavedSession();
});

/** A word that is due today */
function dueWord(id: number, simp: string, level = 1): import('../../types/models').Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'test',
    meaning: 'test meaning',
    level,
    due_date: new Date(Date.now() - 1000).toISOString(),
  };
}

/**
 * Call the startSentenceStages prop the mocked Test component captured, which
 * is how the engine hands the container the words of each sentence stage.
 */
function startStages(words: {
  read: import('../../types/models').Word[];
  write: import('../../types/models').Word[];
}): void {
  (
    capturedTestProps.startSentenceStages as (w: {
      read: import('../../types/models').Word[];
      write: import('../../types/models').Word[];
    }) => void
  )(words);
}

/** A word not yet due */
function futureWord(id: number, simp: string, level = 2): import('../../types/models').Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'test',
    meaning: 'test meaning',
    level,
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
    expect(screen.queryByText(/nothing due/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add words/i })).not.toBeInTheDocument();
  });
});

describe('TestWords — empty list / no words due', () => {
  it('shows "No words yet" when the word list is empty', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No words yet' })).toBeInTheDocument();
    });
  });

  it('shows Add words when no words are due', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add words/i })).toBeInTheDocument();
    });
  });

  it('does NOT show Practise when the list is empty', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No words yet' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Practise' })).not.toBeInTheDocument();
  });

  it('shows Practise when there are words in list but none due', async () => {
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
      expect(screen.getByRole('button', { name: 'Practise' })).toBeInTheDocument();
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
  it('shows the Test component (vocab stage) when there are due words with level > 1', async () => {
    // Words with level > 1 skip the 'new' stage and go directly to 'vocab'
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

  it('shows NewWords stage when there are level-1 words due', async () => {
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

  it('hides the stepper while the Test stage fills the screen', async () => {
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
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });
});

describe('TestWords — practice mode', () => {
  it('starts practice mode (Test stage) when Practise is clicked', async () => {
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

    const practiceBtn = await screen.findByRole('button', { name: 'Practise' });
    await user.click(practiceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
  });
});

describe('TestWords — summary', () => {
  it('hands the summary the scores, the words and the practice flag', async () => {
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
    const scores = [{ char: '你好', direction: 'MC', result: 'fail' }];
    await reachSummary(scores);
    expect(capturedSummaryProps.scores).toEqual(scores);
    expect((capturedSummaryProps.words as { simp: string }[]).map((w) => w.simp)).toEqual(['你好']);
    expect(capturedSummaryProps.practiceMode).toBe(false);
  });

  it('"Practise missed words" starts a practice test of those words only', async () => {
    const words = [dueWord(1, '你好', 2), dueWord(2, '学生', 2)];
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words,
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await reachSummary([
      { char: '你好', direction: 'MC', result: 'pass' },
      { char: '学生', direction: 'MC', result: 'fail' },
    ]);

    act(() => (capturedSummaryProps.onPracticeMissed as (w: unknown[]) => void)([words[1]]));

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toHaveTextContent('Test: 学生');
    });
    expect(capturedTestProps.practiceMode).toBe(true);
    expect(screen.queryByTestId('mock-new-words')).not.toBeInTheDocument();
  });
});

describe('TestWords — cross-list (Test All) mode', () => {
  it('names "All lists" when __all__ is active and no words are due', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'list-1', name: 'HSK 1', createdAt: '', order: 1 },
        ],
        activeListId: '__all__',
        words: [],
        listStats: {},
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [futureWord(1, '你好')] });
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nothing due in All lists' })).toBeInTheDocument();
    });
  });

  it('shows "Test all lists" when viewing one list with due words in other lists', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'list-1', name: 'HSK 1', createdAt: '', order: 1 },
        ],
        activeListId: 'default',
        words: [],
        listStats: {
          default: { due: 0, total: 3 },
          'list-1': { due: 2, total: 5 },
          __all__: { due: 2, total: 8 },
        },
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Test all lists · 2' })).toBeInTheDocument();
    });
  });
});

describe('TestWords — stage transitions', () => {
  /**
   * These tests use the capturedTestProps ref populated by the mocked Test component.
   * The mocked Test component stores every prop it receives into capturedTestProps on render,
   * so we can call startSentenceStages / onVocabComplete from the test body.
   */

  it('transitions to read stage when startSentenceStages is called from Test component', async () => {
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
      expect(typeof capturedTestProps.startSentenceStages).toBe('function');
    });

    // Simulate Test calling startSentenceStages with the words of each stage
    startStages({ read: [dueWord(2, '学生', 2)], write: [] });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
    });
  });

  it('transitions to write stage when sentenceReadEnabled=false and there are write words', async () => {
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
      expect(typeof capturedTestProps.startSentenceStages).toBe('function');
    });

    // The Read stage is off, so its words are dropped and Write runs first.
    startStages({ read: [dueWord(2, '学生', 2)], write: [dueWord(3, '老师', 3)] });

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
    )([{ char: '你好', direction: 'MC', result: 'pass' }]);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test-summary')).toBeInTheDocument();
    });
  });

  it('renders the Read stage with the Write stage off', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sentenceWrite') return 'false';
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

    // Wait for Test component to render
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(typeof capturedTestProps.startSentenceStages).toBe('function');
    });

    // Transition to SentenceRead first
    startStages({ read: [dueWord(2, '学生', 2)], write: [dueWord(3, '老师', 3)] });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});

describe('TestWords — other lists with due words', () => {
  it('lists the other lists that have due words', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'hsk1', name: 'HSK 1', createdAt: '', order: 1 },
          { id: 'hsk2', name: 'HSK 2', createdAt: '', order: 2 },
        ],
        activeListId: 'default',
        words: [],
        listStats: {
          hsk1: { due: 3, total: 10 },
          hsk2: { due: 0, total: 5 },
        },
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No words yet' })).toBeInTheDocument();
    });

    // HSK 1 has due words; HSK 2 has none
    expect(screen.getByText('Other lists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HSK 13 due' })).toBeInTheDocument();
    expect(screen.queryByText(/HSK 2/)).not.toBeInTheDocument();
  });

  it('shows no other lists and no "Test all lists" when nothing is due anywhere', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'hsk1', name: 'HSK 1', createdAt: '', order: 1 },
        ],
        activeListId: 'default',
        words: [],
        listStats: {
          hsk1: { due: 0, total: 5 },
        },
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No words yet' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Other lists')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Test all lists/ })).not.toBeInTheDocument();
  });

  it('calls switchActiveList when another list is clicked', async () => {
    const user = userEvent.setup();
    const mockedSwitchList = vi.mocked(wordActions.switchActiveList);
    mockedSwitchList.mockReturnValue({ type: 'SWITCH_LIST_NOOP' } as any);

    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'hsk1', name: 'HSK 1', createdAt: '', order: 1 },
        ],
        activeListId: 'default',
        words: [],
        listStats: {
          hsk1: { due: 5, total: 10 },
        },
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });

    const chip = await screen.findByRole('button', { name: 'HSK 15 due' });
    await user.click(chip);

    expect(mockedSwitchList).toHaveBeenCalledWith('hsk1');
  });
});

describe('TestWords — loading state', () => {
  it('shows the loading screen when words are loading and no words selected yet', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    });
  });

  it('does not flash "Nothing due" while words are being initialised', async () => {
    // Simulate words already loaded but not yet processed into selectedWords.
    // Before the fix this would briefly show the "Nothing due" screen.
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

    // The test component should appear (after initialization), never the "nothing due" text
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
    // Verify "Nothing due" was never shown
    expect(screen.queryByText(/nothing due/i)).not.toBeInTheDocument();
  });
});

describe('TestWords — Test all lists', () => {
  it('calls switchActiveList with __all__ when "Test all lists" is clicked', async () => {
    const user = userEvent.setup();
    const mockedSwitchList = vi.mocked(wordActions.switchActiveList);
    mockedSwitchList.mockReturnValue({ type: 'SWITCH_LIST_NOOP' } as any);

    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'list-1', name: 'HSK 1', createdAt: '', order: 1 },
        ],
        activeListId: 'default',
        words: [],
        listStats: {
          default: { due: 0, total: 3 },
          'list-1': { due: 2, total: 5 },
          __all__: { due: 2, total: 8 },
        },
        loading: true,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await act(async () => {
      store.dispatch({ type: 'SET_WORDS', words: [] });
    });

    const chip = await screen.findByRole('button', { name: 'Test all lists · 2' });
    await user.click(chip);

    expect(mockedSwitchList).toHaveBeenCalledWith('__all__');
  });
});

describe('TestWords — chengyus in main test', () => {
  it('includes chengyu words (4+ characters) in the test session', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '一举两得', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(screen.getByText(/一举两得/)).toBeInTheDocument();
    });
  });

  it('mixes chengyus and regular words in the same test session', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 2), dueWord(2, '一举两得', 2)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
    // The mocked Test component renders all word simps joined by commas
    const testEl = screen.getByTestId('mock-test');
    expect(testEl.textContent).toContain('你好');
    expect(testEl.textContent).toContain('一举两得');
  });

  it('shows Practise when only chengyu words are in list', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [futureWord(1, '一举两得')],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Practise' })).toBeInTheDocument();
    });
  });
});

describe('TestWords — new words enabled stage', () => {
  it('shows NewWords stage when level-1 words are due and newWordsEnabled is true (default)', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [dueWord(1, '你好', 1), dueWord(2, '学生', 1)],
        listStats: {},
        loading: false,
        error: false,
      },
    });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-new-words')).toBeInTheDocument();
    });
    // The stage has its own session bar, so the stepper is hidden
    expect(screen.queryByText('Learn')).not.toBeInTheDocument();
  });
});
