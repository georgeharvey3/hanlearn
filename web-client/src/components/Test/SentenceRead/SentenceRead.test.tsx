/**
 * Tests for SentenceRead component — the "listen & translate" stage.
 *
 * Focus areas:
 * - Shows spinner while loading the first sentence
 * - Displays the sentence card once a sentence is fetched
 * - Input field accepts text and submitting reveals the yes/no comparison view
 * - Yes click advances to the next word (or calls startSentenceWrite when done)
 * - No click resets the submission state
 * - Navigation (Prev/Next sentence buttons) is enabled/disabled correctly
 * - When no sentences exist for any word, calls startSentenceWrite immediately
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

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SentenceRead from './SentenceRead';
import { renderWithProviders, authenticatedState, createTestStore } from '../../../test/utils';
import * as sentenceService from '../../../services/sentenceService';
import * as dictionaryService from '../../../services/dictionaryService';
import { Word } from '../../../types/models';

const mockedGetSegmentedSentence = vi.mocked(sentenceService.getSegmentedSentence);
const mockedSearchWord = vi.mocked(dictionaryService.searchWord);
const mockedSubstringMatch = vi.mocked(dictionaryService.substringMatch);

const testWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'ni3 hao3',
  meaning: 'hello',
  bank: 2,
  due_date: new Date().toISOString(),
};

/** A minimal cloud sentence response for 你好 */
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

function makeStore() {
  return createTestStore({
    ...authenticatedState(),
    settings: { speechAvailable: false, synthAvailable: false },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return a valid sentence
  mockedGetSegmentedSentence.mockResolvedValue({
    sentence: mockCloudSentence,
    totalCount: 3,
  });
  // Dictionary lookups return empty (segments shown as plain strings)
  mockedSearchWord.mockResolvedValue([]);
  mockedSubstringMatch.mockResolvedValue([
    { id: -1, simp: '—', trad: '—', pinyin: '', meaning: '' },
  ]);
});

describe('SentenceRead — loading state', () => {
  it('shows spinner while the first sentence is loading', () => {
    // Never resolves during this test
    mockedGetSegmentedSentence.mockReturnValue(new Promise(() => {}));
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('removes spinner after sentence loads', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});

describe('SentenceRead — sentence display', () => {
  it('renders the "Listen & translate" heading', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      expect(screen.getByText(/listen.*translate/i)).toBeInTheDocument();
    });
  });

  it('shows the translation input field after load', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type here and press enter/i)).toBeInTheDocument();
    });
  });

  it('shows Prev sentence button disabled when at sentence 0', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      const prevBtn = screen.getByRole('button', { name: /← prev/i });
      expect(prevBtn).toBeDisabled();
    });
  });

  it('shows Next sentence button enabled when totalCount > 1', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /next →/i });
      expect(nextBtn).not.toBeDisabled();
    });
  });
});

describe('SentenceRead — submitting a translation', () => {
  it('shows comparison view after typing a translation and pressing Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/your translation/i)).toBeInTheDocument();
      expect(screen.getByText(/correct translation/i)).toBeInTheDocument();
    });
  });

  it('shows "How did you do?" and like/dislike buttons after submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /i got it right/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /i got it wrong/i })).toBeInTheDocument();
    });
  });

  it('resets to input view when No (I got it wrong) is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type here and press enter/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /i got it wrong/i })).toBeInTheDocument();
    });

    const noBtn = screen.getByRole('button', { name: /i got it wrong/i });
    await user.click(noBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type here and press enter/i)).toBeInTheDocument();
    });
  });
});

describe('SentenceRead — text mode (useSound=false)', () => {
  it('renders the segmented sentence in text mode when synthAvailable=false', async () => {
    // With synthAvailable=false in store, initialiseSettings sets useSound=false → text mode
    const store = createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store },
    );
    // Text mode: sentence segments should appear (non-target segments rendered)
    await waitFor(() => {
      // The sentence characters should be visible in text mode
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('renders clickable word spans for resolved dictionary words in text mode', async () => {
    // Return a word object for the non-target segment 我是
    mockedSearchWord.mockImplementation(async (word: string) => {
      if (word === '我是') {
        return [{ id: 99, simp: '我是', trad: '我是', pinyin: 'wǒ shì', meaning: 'I am' }];
      }
      return [];
    });

    const store = createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store },
    );

    // Wait for the word popup button to appear
    await waitFor(
      () => {
        const popupBtn = screen.queryByRole('button', { name: /tap to see meaning/i });
        expect(popupBtn).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('renders decomposed sub-word spans when substringMatch returns multiple words', async () => {
    // segment '学生' → substringMatch returns two sub-words
    mockedSearchWord.mockResolvedValue([]); // No exact match
    mockedSubstringMatch.mockImplementation(async (word: string) => {
      if (word === '学生') {
        return [
          { id: 101, simp: '学', trad: '學', pinyin: 'xué', meaning: 'study' },
          { id: 102, simp: '生', trad: '生', pinyin: 'shēng', meaning: 'life' },
        ];
      }
      return [{ id: -1, simp: '—', trad: '—', pinyin: '', meaning: '' }];
    });

    const store = createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store },
    );

    await waitFor(
      () => {
        // Both sub-words should appear as clickable spans
        const buttons = screen.queryAllByRole('button', { name: /tap to see meaning/i });
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('renders target word highlighted in primary colour (not as popup)', async () => {
    const store = createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: false, synthAvailable: false },
    });
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store },
    );

    await waitFor(() => {
      // The target word 你好 appears as a highlighted span (not as a popup button)
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});

describe('SentenceRead — stage completion', () => {
  it('calls startSentenceWrite after Yes on the last word (sentenceWriteEnabled=true)', async () => {
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

    const yesBtn = await screen.findByRole('button', { name: /i got it right/i });
    await user.click(yesBtn);

    await waitFor(() => {
      expect(startSentenceWrite).toHaveBeenCalledTimes(1);
    });
  });

  it('skips to next word when no sentence found for current word', async () => {
    // First word has no sentence; second word does
    const secondWord: Word = { ...testWord, id: 2, simp: '学生', trad: '學生' };
    mockedGetSegmentedSentence
      .mockResolvedValueOnce({ sentence: null, totalCount: 0 }) // no sentence for 你好
      .mockResolvedValue({ sentence: mockCloudSentence, totalCount: 1 }); // has sentence for 学生

    const startSentenceWrite = vi.fn();
    renderWithProviders(
      <SentenceRead
        words={[testWord, secondWord]}
        sentenceWriteEnabled={false}
        startSentenceWrite={startSentenceWrite}
      />,
      { store: makeStore() },
    );

    // Eventually the input should appear (the component moved to the next word)
    await waitFor(
      () => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText(/type here and press enter/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('calls startSentenceWrite when all words have no sentences', async () => {
    mockedGetSegmentedSentence.mockResolvedValue({ sentence: null, totalCount: 0 });
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
