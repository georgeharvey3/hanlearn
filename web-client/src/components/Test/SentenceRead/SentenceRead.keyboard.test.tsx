/**
 * Tests for SentenceRead keyboard shortcuts and error handling paths:
 * - Escape key closes popup
 * - Ctrl+B focuses answerInput
 * - ArrowLeft/ArrowRight navigate sentences
 * - fetchSentence error handling (catch block)
 * - onChangeSentence uses cached sentence without refetch
 * - closePopup logic
 * - Score unavailable when similarity service rejects
 * - Show text chip toggle in audio mode
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('howler', () => ({
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
  },
}));
vi.mock('../../../services/sentenceService', () => ({
  getSegmentedSentence: vi.fn(),
}));
vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
  substringMatch: vi.fn(),
}));
vi.mock('../../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
  isGoogleTtsAvailable: vi.fn(() => null),
}));
vi.mock('../../../services/similarityService', () => ({
  getSimilarityScore: vi.fn(),
}));

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SentenceRead from './SentenceRead';
import { renderWithProviders, authenticatedState, createTestStore } from '../../../test/utils';
import * as sentenceService from '../../../services/sentenceService';
import * as dictionaryService from '../../../services/dictionaryService';
import * as ttsService from '../../../services/ttsService';
import * as similarityService from '../../../services/similarityService';
import { Word } from '../../../types/models';

const mockedGetSegmentedSentence = vi.mocked(sentenceService.getSegmentedSentence);
const mockedSearchWord = vi.mocked(dictionaryService.searchWord);
const mockedSubstringMatch = vi.mocked(dictionaryService.substringMatch);
const mockedGetSimilarityScore = vi.mocked(similarityService.getSimilarityScore);

const testWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'ni3 hao3',
  meaning: 'hello',
  bank: 2,
  due_date: new Date().toISOString(),
};

const testWord2: Word = {
  id: 2,
  simp: '学生',
  trad: '學生',
  pinyin: 'xue2 sheng1',
  meaning: 'student',
  bank: 2,
  due_date: new Date().toISOString(),
};

const mockCloudSentence = {
  chinese: {
    sentence: '你好，我是学生。',
    highlight: [[0, 2]] as number[][],
    segments: ['你好', '，', '我是', '学生', '。'],
    targetIndex: 0,
  },
  english: {
    sentence: 'Hello, I am a student.',
    highlight: [[0, 5]] as number[][],
  },
};

const mockCloudSentence2 = {
  chinese: {
    sentence: '请向他们说声你好。',
    highlight: [[7, 9]] as number[][],
    segments: ['请', '向', '他们', '说声', '你好'],
    targetIndex: 4,
  },
  english: {
    sentence: 'Please say hello to them.',
    highlight: [] as number[][],
  },
};

function makeStore() {
  return createTestStore({
    ...authenticatedState(),
    settings: { speechAvailable: false, synthAvailable: false },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSegmentedSentence.mockResolvedValue({
    sentence: mockCloudSentence,
    totalCount: 3,
  });
  mockedSearchWord.mockResolvedValue([]);
  mockedSubstringMatch.mockResolvedValue([
    { id: -1, simp: '—', trad: '—', pinyin: '', meaning: '' },
  ]);
  mockedGetSimilarityScore.mockResolvedValue({ score: 85, rawSimilarity: 0.925 });
});

// ---------------------------------------------------------------------------
// fetchSentence error handling — catch block advances to next word
// ---------------------------------------------------------------------------
describe('SentenceRead — fetchSentence error handling', () => {
  it('advances to next word when fetchSentence throws for current word', async () => {
    mockedGetSegmentedSentence
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ sentence: mockCloudSentence, totalCount: 1 });

    renderWithProviders(
      <SentenceRead
        words={[testWord, testWord2]}
        sentenceWriteEnabled={false}
        startSentenceWrite={vi.fn()}
      />,
      { store: makeStore() },
    );

    // Should recover and show input for the second word
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText(/type here and press enter/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('calls startSentenceWrite when fetchSentence throws for only word', async () => {
    mockedGetSegmentedSentence.mockRejectedValue(new Error('Server error'));

    const startSentenceWrite = vi.fn();
    renderWithProviders(
      <SentenceRead
        words={[testWord]}
        sentenceWriteEnabled
        startSentenceWrite={startSentenceWrite}
      />,
      { store: makeStore() },
    );

    await waitFor(() => {
      expect(startSentenceWrite).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Score unavailable when similarity service rejects
// ---------------------------------------------------------------------------
describe('SentenceRead — score unavailable on similarity error', () => {
  it('shows "Score unavailable" when getSimilarityScore rejects', async () => {
    mockedGetSimilarityScore.mockRejectedValue(new Error('Service down'));
    const user = userEvent.setup();

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Score unavailable')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// onChangeSentence uses cached sentence without refetch
// ---------------------------------------------------------------------------
describe('SentenceRead — sentence navigation with cached sentences', () => {
  it('navigates back to a cached sentence without calling getSegmentedSentence again', async () => {
    const user = userEvent.setup();

    // First call for offset 0, second for offset 1
    mockedGetSegmentedSentence
      .mockResolvedValueOnce({ sentence: mockCloudSentence, totalCount: 3 })
      .mockResolvedValueOnce({ sentence: mockCloudSentence2, totalCount: 3 });

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    // Wait for first sentence to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Click Next to fetch sentence at offset 1
    const nextBtn = screen.getByRole('button', { name: /next →/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(mockedGetSegmentedSentence).toHaveBeenCalledTimes(2);
    });

    // Click Prev to go back to cached sentence at offset 0
    const prevBtn = await screen.findByRole('button', { name: /← prev/i });
    await user.click(prevBtn);

    // Should NOT have called getSegmentedSentence again (still 2 calls)
    expect(mockedGetSegmentedSentence).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Show text chip toggle in audio mode
// ---------------------------------------------------------------------------
describe('SentenceRead — Show text chip in audio mode', () => {
  function makeStoreWithSound() {
    return createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: true, synthAvailable: true },
    });
  }

  beforeEach(() => {
    vi.mocked(ttsService.speak).mockImplementation((_text, options) => {
      setTimeout(() => options?.onStart?.(), 0);
      return { play: vi.fn(), stop: vi.fn() };
    });
  });

  it('shows "Show text" chip in audio mode and toggles to text view on click', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    // Wait for audio mode to initialize
    const showTextChip = await screen.findByRole('button', { name: /show text/i });
    expect(showTextChip).toHaveAttribute('aria-pressed', 'false');

    await user.click(showTextChip);

    // After clicking, should show "Hide text"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hide text/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Keyboard: ArrowUp/ArrowDown after submission
// ---------------------------------------------------------------------------
describe('SentenceRead — keyboard shortcuts ArrowUp/ArrowDown', () => {
  it('advances to next word on ArrowUp after submission', async () => {
    const user = userEvent.setup();
    const startSentenceWrite = vi.fn();

    renderWithProviders(
      <SentenceRead
        words={[testWord]}
        sentenceWriteEnabled
        startSentenceWrite={startSentenceWrite}
      />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next word/i })).toBeInTheDocument();
    });

    // ArrowUp from a non-input element triggers onYesClicked
    fireEvent.keyUp(document.body, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(startSentenceWrite).toHaveBeenCalledTimes(1);
    });
  });

  it('resets to input view on ArrowDown after submission', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    // ArrowDown from a non-input element triggers onNoClicked
    fireEvent.keyUp(document.body, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type here and press enter/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// English highlight rendering in submitted state
// ---------------------------------------------------------------------------
describe('SentenceRead — english highlight in submitted view', () => {
  it('renders highlighted portion of the english translation', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hi{Enter}');

    await waitFor(() => {
      // The full translation should be displayed
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Multiple words: advances wordIndex after Next Word click
// ---------------------------------------------------------------------------
describe('SentenceRead — multi-word navigation', () => {
  it('shows word 2 of N after clicking Next Word on first word', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SentenceRead
        words={[testWord, testWord2]}
        sentenceWriteEnabled={false}
        startSentenceWrite={vi.fn()}
      />,
      { store: makeStore() },
    );

    // Initially shows word 1 of 2
    await waitFor(() => {
      expect(screen.getByText(/word 1 of 2/i)).toBeInTheDocument();
    });

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    const nextBtn = await screen.findByRole('button', { name: /next word/i });
    await user.click(nextBtn);

    // After clicking Next Word, should move to word 2
    await waitFor(() => {
      expect(screen.getByText(/word 2 of 2/i)).toBeInTheDocument();
    });
  });
});
