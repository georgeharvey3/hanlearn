/**
 * Additional TestWords tests — covering stage transitions and settings combinations
 * not exercised by the main test file:
 *   - newWordsEnabled=false skips straight to vocab
 *   - Practice mode with level-1 words shows new words stage
 *   - SentenceWrite → summary transition via onComplete callback
 *   - SentenceRead passes sentenceWriteEnabled prop correctly
 *   - finalStage=true when both sentence stages disabled
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../utils/devTestMode', () => ({ getDevTestConfig: vi.fn().mockReturnValue(null) }));
vi.mock('../../store/actions/index', () => ({
  initWords: vi.fn(() => ({ type: 'INIT_WORDS_NOOP' })),
  finishTest: vi.fn(() => ({ type: 'FINISH_TEST_NOOP' })),
  postWord: vi.fn(() => ({ type: 'POST_WORD_NOOP' })),
  switchActiveList: vi.fn(() => ({ type: 'SWITCH_LIST_NOOP' })),
}));

vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({ play: vi.fn(), stop: vi.fn() })),
}));

// Capture props from mocked child components to invoke callbacks
let capturedTestProps: Record<string, unknown> = {};
let capturedReadProps: Record<string, unknown> = {};
let capturedWriteProps: Record<string, unknown> = {};

vi.mock('../../components/Test/Test', () => ({
  default: (props: Record<string, unknown>) => {
    capturedTestProps = props;
    return <div data-testid="mock-test">Test</div>;
  },
}));
vi.mock('../../components/Test/NewWords/NewWords', () => ({
  default: ({ words, startTest }: { words: { simp: string }[]; startTest: () => void }) => (
    <div data-testid="mock-new-words">
      NewWords: {words.map((w) => w.simp).join(',')}
      <button data-testid="start-test-btn" onClick={startTest}>
        Start
      </button>
    </div>
  ),
}));
vi.mock('../../components/Test/SentenceRead/SentenceRead', () => ({
  default: (props: Record<string, unknown>) => {
    capturedReadProps = props;
    return <div data-testid="mock-sentence-read">SentenceRead</div>;
  },
}));
vi.mock('../../components/Test/SentenceWrite/SentenceWrite', () => ({
  default: (props: Record<string, unknown>) => {
    capturedWriteProps = props;
    return <div data-testid="mock-sentence-write">SentenceWrite</div>;
  },
}));
vi.mock('../../components/Test/TestSummary/TestSummary', () => ({
  default: () => <div data-testid="mock-test-summary">TestSummary</div>,
}));

import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestWords from './TestWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import type { Word } from '../../types/models';

beforeEach(() => {
  vi.clearAllMocks();
  capturedTestProps = {};
  capturedReadProps = {};
  capturedWriteProps = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

function dueWord(id: number, simp: string, level = 1, daysAgo = 0): Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'test',
    meaning: 'test meaning',
    level,
    due_date: new Date(Date.now() - 1000 - daysAgo * 86400000).toISOString(),
  };
}

function futureWord(id: number, simp: string, level = 2): Word {
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

function makeStore(overrides: Partial<ReturnType<typeof authenticatedState>['addWords']> = {}) {
  return createTestStore({
    ...authenticatedState(),
    addWords: {
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
      activeListId: 'default',
      words: [],
      listStats: {},
      loading: false,
      error: false,
      ...overrides,
    },
  });
}

describe('TestWords — the Learn stage teaches what the queue asks', () => {
  // A default session is numWords=5, and the budget is five questions per word,
  // so 25 questions. Every word costs one question, review or new.

  it('teaches no new word when older review words take the whole budget', async () => {
    const reviews = Array.from({ length: 25 }, (_, i) => dueWord(i + 100, `旧${i}`, 2, 10));
    const store = makeStore({ words: [...reviews, dueWord(1, '新一'), dueWord(2, '新二')] });

    renderWithProviders(<TestWords />, { store });

    // Before this was coupled, the Learn stage taught five new words and the
    // queue asked none of them.
    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    expect(screen.queryByTestId('mock-new-words')).not.toBeInTheDocument();
    expect((capturedTestProps.plan as { newWords: Word[] }).newWords).toHaveLength(0);
  });

  it('teaches exactly the new words the queue admits', async () => {
    const reviews = Array.from({ length: 24 }, (_, i) => dueWord(i + 100, `旧${i}`, 2, 10));
    const store = makeStore({
      words: [...reviews, dueWord(1, '新一', 1, 5), dueWord(2, '新二', 1, 0)],
    });

    renderWithProviders(<TestWords />, { store });

    // 24 review pairs of 25 leave room for one new word. 新一 has waited five
    // days and 新二 came due today, so the due date takes 新一.
    const learn = await screen.findByTestId('mock-new-words');
    expect(learn).toHaveTextContent('NewWords: 新一');
    expect(learn).not.toHaveTextContent('新二');
  });

  it('takes a new word before a review word that came due later', async () => {
    const reviews = Array.from({ length: 25 }, (_, i) => dueWord(i + 100, `旧${i}`, 2, 0));
    const store = makeStore({ words: [...reviews, dueWord(1, '新一', 1, 10)] });

    renderWithProviders(<TestWords />, { store });

    // The new word has waited ten days, so it outranks every review word and
    // the budget cuts a review word instead of the new word.
    const learn = await screen.findByTestId('mock-new-words');
    expect(learn).toHaveTextContent('NewWords: 新一');
  });

  it('gives the Test component the same plan the Learn stage taught from', async () => {
    const store = makeStore({ words: [dueWord(1, '新一'), dueWord(2, '新二')] });

    renderWithProviders(<TestWords />, { store });

    await userEvent.click(await screen.findByTestId('start-test-btn'));

    const plan = capturedTestProps.plan as { newWords: Word[]; queue: unknown[] };
    expect(plan.newWords.map((w) => w.simp)).toEqual(['新一', '新二']);
    // One question per word now, not one per direction.
    expect(plan.queue).toHaveLength(2);
  });
});

describe('TestWords — newWordsEnabled=false skips Learn stage', () => {
  it('goes directly to vocab stage when newWords setting is disabled', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'newWords') return 'false';
      return null;
    });

    const store = makeStore({ words: [dueWord(1, '你好', 1)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      // Should skip NewWords and go straight to Test
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mock-new-words')).not.toBeInTheDocument();
  });

  it('does not show Learn step in stepper when newWords is disabled', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'newWords') return 'false';
      return null;
    });

    const store = makeStore({ words: [dueWord(1, '你好', 1)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
    expect(screen.queryByText('Learn')).not.toBeInTheDocument();
  });
});

describe('TestWords — practice mode with level-1 words', () => {
  it('shows NewWords stage in practice mode when level-1 words exist and newWords enabled', async () => {
    const user = userEvent.setup();
    // All words are future (not due), so the "no words due" screen shows with Practice button.
    // The future words have level=1.
    const store = makeStore({ words: [futureWord(1, '你好', 1)] });
    renderWithProviders(<TestWords />, { store });

    const practiceBtn = await screen.findByRole('button', { name: /practice/i });
    await user.click(practiceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-new-words')).toBeInTheDocument();
    });
  });

  it('skips to vocab in practice mode when newWords disabled even with level-1 words', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'newWords') return 'false';
      return null;
    });

    const store = makeStore({ words: [futureWord(1, '你好', 1)] });
    renderWithProviders(<TestWords />, { store });

    const practiceBtn = await screen.findByRole('button', { name: /practice/i });
    await user.click(practiceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
  });
});

describe('TestWords — finalStage prop', () => {
  it('passes finalStage=true to Test when both sentence stages are disabled', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sentenceRead') return 'false';
      if (key === 'sentenceWrite') return 'false';
      return null;
    });

    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(capturedTestProps.finalStage).toBe(true);
    });
  });

  it('passes finalStage=false when sentenceRead is enabled', async () => {
    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(capturedTestProps.finalStage).toBe(false);
    });
  });
});

describe('TestWords — SentenceWrite to summary transition', () => {
  it('transitions to summary when SentenceWrite calls onComplete', async () => {
    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    // Wait for Test component
    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(typeof capturedTestProps.startSentenceRead).toBe('function');
    });

    // Transition to SentenceRead
    const sentenceWords = [dueWord(2, '学生', 2)];
    act(() => {
      (capturedTestProps.startSentenceRead as (words: Word[]) => void)(sentenceWords);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
    });

    // Transition to SentenceWrite via startSentenceWrite callback
    act(() => {
      (capturedReadProps.startSentenceWrite as (offsets: Record<string, unknown>) => void)({});
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-write')).toBeInTheDocument();
    });

    // Transition to summary via onComplete callback
    act(() => {
      (capturedWriteProps.onComplete as () => void)();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test-summary')).toBeInTheDocument();
    });
  });
});

describe('TestWords — SentenceRead receives sentenceWriteEnabled prop', () => {
  it('passes sentenceWriteEnabled=true by default', async () => {
    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(typeof capturedTestProps.startSentenceRead).toBe('function');
    });

    act(() => {
      (capturedTestProps.startSentenceRead as (words: Word[]) => void)([dueWord(2, '学生')]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
      expect(capturedReadProps.sentenceWriteEnabled).toBe(true);
    });
  });

  it('passes sentenceWriteEnabled=false when localStorage disables it', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sentenceWrite') return 'false';
      return null;
    });

    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(typeof capturedTestProps.startSentenceRead).toBe('function');
    });

    act(() => {
      (capturedTestProps.startSentenceRead as (words: Word[]) => void)([dueWord(2, '学生')]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-sentence-read')).toBeInTheDocument();
      expect(capturedReadProps.sentenceWriteEnabled).toBe(false);
    });
  });
});

describe('TestWords — NewWords to vocab transition', () => {
  it('transitions from NewWords to Test when startTest callback is invoked', async () => {
    const user = userEvent.setup();
    const store = makeStore({ words: [dueWord(1, '你好', 1)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-new-words')).toBeInTheDocument();
    });

    // Click the Start button rendered by the mocked NewWords
    await user.click(screen.getByTestId('start-test-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
    });
  });
});

describe('TestWords — practiceMode prop', () => {
  it('passes practiceMode=true to Test component when started via Practice button', async () => {
    const user = userEvent.setup();
    const store = makeStore({ words: [futureWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    const practiceBtn = await screen.findByRole('button', { name: /practice/i });
    await user.click(practiceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(capturedTestProps.practiceMode).toBe(true);
    });
  });
});

describe('TestWords — sentenceStagesForAllWords prop', () => {
  it('passes sentenceStagesForAllWords=false by default', async () => {
    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(capturedTestProps.sentenceStagesForAllWords).toBe(false);
    });
  });

  it('passes sentenceStagesForAllWords=true when localStorage setting is enabled', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sentenceStagesForAllWords') return 'true';
      return null;
    });

    const store = makeStore({ words: [dueWord(1, '你好', 2)] });
    renderWithProviders(<TestWords />, { store });

    await waitFor(() => {
      expect(screen.getByTestId('mock-test')).toBeInTheDocument();
      expect(capturedTestProps.sentenceStagesForAllWords).toBe(true);
    });
  });
});
