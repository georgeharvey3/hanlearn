/**
 * Tests for resuming an unfinished session — issue #305.
 *
 * A session writes nothing to Firestore until it finishes, so closing the page
 * halfway through used to throw away every answer it had collected. The
 * container saves the session as it runs and offers it back on the next visit.
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
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({ play: vi.fn(), stop: vi.fn() })),
}));

let capturedTestProps: Record<string, unknown> = {};

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
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestWords from './TestWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import { DirectionGrade, QueuePair, Word, WordScore } from '../../types/models';
import { dayKey } from '../../utils/retention';
import {
  SAVED_SESSION_KEY,
  SAVED_SESSION_VERSION,
  SavedSession,
  VocabProgress,
  clearSavedSession,
  readSavedSession,
  saveSession,
} from '../../utils/savedSession';

const USER_ID = 'test-user-123';

beforeEach(() => {
  vi.clearAllMocks();
  capturedTestProps = {};
  clearSavedSession();
});

const dueWord = (id: number, simp: string, level = 2): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'test',
  meaning: 'test meaning',
  level,
  due_date: new Date(Date.now() - 1000).toISOString(),
});

const words = [dueWord(1, '你好'), dueWord(2, '再见'), dueWord(3, '謝謝')];

const pair = (index: string): QueuePair => ({ index, aCategory: 'M', qCategory: 'C' });

const grade: DirectionGrade = { wordId: 1, direction: 'MC', result: 'pass', toneErrors: 0 };

const savedSession = (overrides: Partial<SavedSession> = {}): SavedSession => ({
  version: SAVED_SESSION_VERSION,
  userId: USER_ID,
  listId: 'default',
  date: dayKey(new Date()),
  savedAt: new Date().toISOString(),
  stage: 'vocab',
  practiceMode: false,
  wordIds: [1, 2, 3],
  newWordIds: [],
  sentenceReadWordIds: [],
  sentenceWriteWordIds: [],
  seenOffsets: {},
  scoreList: [],
  queue: [pair('1'), pair('2')],
  gradeList: [grade],
  initialQueueLength: 3,
  ...overrides,
});

function storeWithWords() {
  const base = authenticatedState(USER_ID);
  return createTestStore({
    ...base,
    addWords: { ...base.addWords, words },
  });
}

/** The container hands this to the mocked Test; the engine calls it for real. */
function reportProgress(progress: VocabProgress): void {
  act(() => {
    (capturedTestProps.onProgress as (p: VocabProgress) => void)(progress);
  });
}

describe('TestWords — the offer to resume', () => {
  it('offers an unfinished session from earlier today', async () => {
    saveSession(savedSession());
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    expect(await screen.findByText(/unfinished session/i)).toBeInTheDocument();
    expect(screen.getByText('2 questions left')).toBeInTheDocument();
    // Nothing runs while the offer stands.
    expect(screen.queryByTestId('mock-test')).not.toBeInTheDocument();
  });

  it('hands the saved queue and grades to the session when resumed', async () => {
    const saved = savedSession();
    saveSession(saved);
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    await userEvent.click(await screen.findByRole('button', { name: /resume/i }));

    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    expect(capturedTestProps.resume).toEqual({
      queue: saved.queue,
      gradeList: saved.gradeList,
      initialQueueLength: saved.initialQueueLength,
    });
    // The queue's indexes point into the plan, so the plan has to be the words
    // the session was saved with, in the order it saved them.
    expect((capturedTestProps.plan as { words: Word[] }).words.map((w) => w.id)).toEqual([1, 2, 3]);
  });

  it('resumes at the stage the session reached', async () => {
    saveSession(savedSession({ stage: 'read', sentenceReadWordIds: [1], queue: [] }));
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    await userEvent.click(await screen.findByRole('button', { name: /resume/i }));
    expect(await screen.findByTestId('mock-sentence-read')).toBeInTheDocument();
  });

  it('discards the saved session and plans a new one on Start fresh', async () => {
    saveSession(savedSession());
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    await userEvent.click(await screen.findByRole('button', { name: /start fresh/i }));

    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    expect(capturedTestProps.resume).toBeUndefined();
  });

  it('does not offer a session saved on another day', async () => {
    saveSession(savedSession({ date: '2020-01-01' }));
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    expect(screen.queryByText(/unfinished session/i)).not.toBeInTheDocument();
  });

  it('does not offer a session whose words have since been deleted', async () => {
    saveSession(savedSession({ wordIds: [1, 2, 99] }));
    renderWithProviders(<TestWords />, { store: storeWithWords() });

    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    expect(screen.queryByText(/unfinished session/i)).not.toBeInTheDocument();
  });
});

describe('TestWords — saving the running session', () => {
  it('saves the session as soon as it starts', async () => {
    renderWithProviders(<TestWords />, { store: storeWithWords() });
    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());

    await waitFor(() => expect(readSavedSession()).not.toBeNull());
    const saved = readSavedSession()!;
    expect(saved.userId).toBe(USER_ID);
    expect(saved.listId).toBe('default');
    expect(saved.date).toBe(dayKey(new Date()));
    expect(saved.stage).toBe('vocab');
  });

  it('saves what the session has graded and what it has left', async () => {
    renderWithProviders(<TestWords />, { store: storeWithWords() });
    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());

    reportProgress({ queue: [pair('2')], gradeList: [grade], initialQueueLength: 3 });

    await waitFor(() => expect(readSavedSession()?.gradeList).toEqual([grade]));
    const saved = readSavedSession()!;
    expect(saved.queue).toEqual([pair('2')]);
    expect(saved.initialQueueLength).toBe(3);
  });

  it('clears the saved session once the learner reaches the summary', async () => {
    renderWithProviders(<TestWords />, { store: storeWithWords() });
    await waitFor(() => expect(screen.getByTestId('mock-test')).toBeInTheDocument());
    await waitFor(() => expect(readSavedSession()).not.toBeNull());

    const scores: WordScore[] = [{ char: '你好', direction: 'MC', result: 'pass' }];
    act(() => {
      (capturedTestProps.onVocabComplete as (s: WordScore[]) => void)(scores);
    });

    expect(await screen.findByTestId('mock-test-summary')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(SAVED_SESSION_KEY)).toBeNull());
  });
});
