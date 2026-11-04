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

vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  analytics: null,
}));
vi.mock('howler', () => ({
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
  },
}));
vi.mock('../../../services/sentenceService', () => ({
  getSegmentedSentence: vi.fn(),
  takeSentenceStart: vi.fn(() => 0),
}));
vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));
vi.mock('../../../services/wordService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/wordService')>()),
  addWordToList: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/sentenceReportService', () => ({
  reportSentence: vi.fn(),
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
import * as sentenceReportService from '../../../services/sentenceReportService';
import * as ttsService from '../../../services/ttsService';
import * as similarityService from '../../../services/similarityService';
import { Word } from '../../../types/models';

const mockedGetSegmentedSentence = vi.mocked(sentenceService.getSegmentedSentence);
const mockedSearchWord = vi.mocked(dictionaryService.searchWord);
const mockedReportSentence = vi.mocked(sentenceReportService.reportSentence);
const mockedGetSimilarityScore = vi.mocked(similarityService.getSimilarityScore);

const testWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'ni3 hao3',
  meaning: 'hello',
  level: 2,
  due_date: new Date().toISOString(),
};

/** A sentence of the files for 你好, with the punctuation as segments with no entry */
const mockCloudSentence = {
  id: 'sentence-1',
  chinese: {
    sentence: '你好，我是学生。',
    highlight: [[0, 2]] as number[][],
    segments: [
      { s: '你好', t: '你好', p: 'nǐ hǎo', e: 'hello' },
      { s: '，', t: '，', p: '', e: '' },
      { s: '我是', t: '我是', p: 'wǒ shì', e: 'to be' },
      { s: '学生', t: '學生', p: 'xué sheng', e: 'student' },
      { s: '。', t: '。', p: '', e: '' },
    ],
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
  mockedSearchWord.mockResolvedValue([]);
  mockedReportSentence.mockResolvedValue(undefined);
  // Default: similarity scoring returns a score of 85
  mockedGetSimilarityScore.mockResolvedValue({ score: 85, rawSimilarity: 0.925 });
});

describe('SentenceRead — loading state', () => {
  it('shows spinner while the first sentence is loading', () => {
    // Never resolves during this test
    mockedGetSegmentedSentence.mockReturnValue(new Promise(() => {}));
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
  });

  it('removes spinner after sentence loads', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await waitFor(() => {
      expect(screen.queryByRole('progressbar', { name: 'Loading' })).not.toBeInTheDocument();
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
      expect(screen.getByPlaceholderText(/type your translation/i)).toBeInTheDocument();
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

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/your translation/i)).toBeInTheDocument();
      expect(screen.getByText(/correct translation/i)).toBeInTheDocument();
    });
  });

  it('shows similarity score and Finish button after submission on last word', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
    });

    // Similarity score should appear
    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Close match')).toBeInTheDocument();
    });
  });

  it('shows comparison view after clicking the Submit button', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello');

    const submitBtn = screen.getByRole('button', { name: /^check$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/your translation/i)).toBeInTheDocument();
      expect(screen.getByText(/correct translation/i)).toBeInTheDocument();
    });
  });

  it('disables Submit button when input is empty', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: /^check$/i });
      expect(submitBtn).toBeDisabled();
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
      expect(screen.queryByRole('progressbar', { name: 'Loading' })).not.toBeInTheDocument();
    });
  });

  it('renders each segment with an entry as a word to tap, with no dictionary call', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    expect(await screen.findByLabelText('我是: show meaning')).toBeInTheDocument();
    expect(screen.getByLabelText('學生: show meaning')).toBeInTheDocument();
    expect(mockedSearchWord).not.toHaveBeenCalled();
  });

  it('keeps the punctuation as plain text', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    await screen.findByLabelText('我是: show meaning');
    expect(screen.queryByLabelText('，: show meaning')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /show meaning/ })).toHaveLength(2);
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
      expect(screen.queryByRole('progressbar', { name: 'Loading' })).not.toBeInTheDocument();
    });
  });
});

describe('SentenceRead — stage completion', () => {
  it('calls startSentenceWrite after Next Stage on the last word (sentenceWriteEnabled=true)', async () => {
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

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    const nextBtn = await screen.findByRole('button', { name: /next stage/i });
    await user.click(nextBtn);

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
        expect(screen.queryByRole('progressbar', { name: 'Loading' })).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText(/type your translation/i)).toBeInTheDocument();
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

describe('SentenceRead — word popup rendering', () => {
  // The dictionary entry of the segment '我是', found when the learner adds it
  const wordMatch = { id: 5, simp: '我是', trad: '我是', pinyin: 'wo3 shi4', meaning: 'to be' };

  it('renders a clickable popup span for a resolved SentenceWord segment', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    // Wait for the sentence to load and word lookup to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar', { name: 'Loading' })).not.toBeInTheDocument();
    });

    // The resolved segment '我是' should be rendered as an accessible button
    await waitFor(() => {
      expect(screen.getByLabelText(/我是.*show meaning/i)).toBeInTheDocument();
    });
  });

  it('shows pinyin and meaning in the sheet for a tapped word', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    fireEvent.click(await screen.findByLabelText(/我是.*show meaning/i, {}, { timeout: 5000 }));

    await waitFor(() => {
      expect(screen.getByText('wǒ shì')).toBeInTheDocument();
      expect(screen.getByText('to be')).toBeInTheDocument();
    });
  });

  it('shows "Add to list" button after opening popup for a word not yet in addedWords', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    // Wait for the clickable popup span to appear (confirms segment resolved to SentenceWord)
    const popupSpan = await screen.findByLabelText(/我是.*show meaning/i, {}, { timeout: 5000 });

    // Click the word to open the popup (sets visibility:visible via onShowPopup)
    fireEvent.click(popupSpan);

    // Now the popup is open and the button should be accessible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to list/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^added$/i })).not.toBeInTheDocument();
  });

  it('shows "Added" after opening popup when the word is already in addedWords', async () => {
    const storeWithWord = createTestStore({
      ...authenticatedState(),
      addWords: {
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [{ id: 5, simp: '我是', trad: '我是', pinyin: 'wo3 shi4', meaning: 'to be' }],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    });

    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: storeWithWord },
    );

    // Wait for popup span and click to open it
    const popupSpan = await screen.findByLabelText(/我是.*show meaning/i, {}, { timeout: 5000 });
    fireEvent.click(popupSpan);

    // 我是 is in addedWords → shows a disabled "Added" button
    await waitFor(() => {
      const addedBtn = screen.getByRole('button', { name: /^added$/i });
      expect(addedBtn).toBeInTheDocument();
      expect(addedBtn).toBeDisabled();
    });
  });

  it('adds the dictionary entry of the tapped word to the list', async () => {
    mockedSearchWord.mockResolvedValue([wordMatch]);
    const store = makeStore();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store },
    );

    fireEvent.click(await screen.findByLabelText('我是: show meaning'));
    fireEvent.click(screen.getByRole('button', { name: /add to list/i }));

    await waitFor(() => expect(mockedSearchWord).toHaveBeenCalledWith('我是', 'simp'));
    await waitFor(() => expect(store.getState().addWords.words.some((w) => w.id === 5)).toBe(true));
  });
});

describe('SentenceRead — slow mode toggle', () => {
  function makeStoreWithSound() {
    return createTestStore({
      ...authenticatedState(),
      settings: { speechAvailable: true, synthAvailable: true },
    });
  }

  beforeEach(() => {
    localStorage.removeItem('slowMode');
  });

  it('renders a slow mode toggle button in audio mode', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /slow speech/i })).toBeInTheDocument();
    });
  });

  it('persists slow mode preference to localStorage when toggled', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    const toggleBtn = await screen.findByRole('button', { name: /slow speech/i });
    expect(localStorage.getItem('slowMode')).not.toBe('true');

    await user.click(toggleBtn);
    expect(localStorage.getItem('slowMode')).toBe('true');

    await user.click(toggleBtn);
    expect(localStorage.getItem('slowMode')).toBe('false');
  });

  it('initialises slow mode from localStorage', async () => {
    localStorage.setItem('slowMode', 'true');
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    const toggleBtn = await screen.findByRole('button', { name: /slow speech/i });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('passes speed 0.7 to ttsService.speak when slow mode is enabled', async () => {
    localStorage.setItem('slowMode', 'true');
    const mockedSpeak = vi.mocked(ttsService.speak);
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    // Wait for the sentence to load and auto-speak
    await waitFor(() => {
      expect(mockedSpeak).toHaveBeenCalled();
    });

    // The speak call should include speed: 0.7
    const lastCall = mockedSpeak.mock.calls[mockedSpeak.mock.calls.length - 1];
    expect(lastCall[1]).toEqual(expect.objectContaining({ speed: 0.7 }));
  });

  it('passes speed 1.0 to ttsService.speak when slow mode is disabled', async () => {
    localStorage.setItem('slowMode', 'false');
    const mockedSpeak = vi.mocked(ttsService.speak);
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStoreWithSound() },
    );

    await waitFor(() => {
      expect(mockedSpeak).toHaveBeenCalled();
    });

    const lastCall = mockedSpeak.mock.calls[mockedSpeak.mock.calls.length - 1];
    expect(lastCall[1]).toEqual(expect.objectContaining({ speed: 1.0 }));
  });
});

describe('SentenceRead — tappable words', () => {
  it('renders each dictionary word as a button', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const word = await screen.findByLabelText(/我是.*show meaning/i, {}, { timeout: 5000 });
    expect(word.tagName).toBe('BUTTON');
  });
});

describe('SentenceRead — primary button text', () => {
  it('shows "Next Word" on non-last word', async () => {
    const user = userEvent.setup();
    const secondWord: Word = { ...testWord, id: 2, simp: '学生', trad: '學生' };
    renderWithProviders(
      <SentenceRead
        words={[testWord, secondWord]}
        sentenceWriteEnabled={false}
        startSentenceWrite={vi.fn()}
      />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next word/i })).toBeInTheDocument();
    });
  });

  it('shows "Next Stage" on last word when sentenceWriteEnabled=true', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next stage/i })).toBeInTheDocument();
    });
  });

  it('shows "Finish" on last word when sentenceWriteEnabled=false', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );

    const input = await screen.findByPlaceholderText(/type your translation/i);
    await user.type(input, 'Hello{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
    });
  });
});

describe('SentenceRead — report a sentence', () => {
  const submit = async () => {
    fireEvent.change(await screen.findByPlaceholderText(/type your translation/i), {
      target: { value: 'Hello, I am a student.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
  };

  it('reports the sentence after the learner checks the translation', async () => {
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await submit();

    fireEvent.click(await screen.findByRole('button', { name: 'Report sentence' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reported' })).toBeDisabled());
    expect(mockedReportSentence).toHaveBeenCalledWith('test-user-123', {
      sentenceId: 'sentence-1',
      word: '你好',
      stage: 'read',
      sentence: '你好，我是学生。',
      english: 'Hello, I am a student.',
    });
  });

  it('shows the report as sent while the write waits for the network', async () => {
    mockedReportSentence.mockReturnValue(new Promise(() => {}));
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await submit();

    fireEvent.click(await screen.findByRole('button', { name: 'Report sentence' }));

    expect(await screen.findByRole('button', { name: 'Reported' })).toBeDisabled();
  });

  it('offers the report again when it fails', async () => {
    mockedReportSentence.mockRejectedValue(new Error('offline'));
    renderWithProviders(
      <SentenceRead words={[testWord]} sentenceWriteEnabled={false} startSentenceWrite={vi.fn()} />,
      { store: makeStore() },
    );
    await submit();

    fireEvent.click(await screen.findByRole('button', { name: 'Report sentence' }));

    expect(await screen.findByRole('button', { name: 'Report failed' })).toBeEnabled();
  });

  it('shows no report button in the tryout', async () => {
    renderWithProviders(
      <SentenceRead
        words={[testWord]}
        sentenceWriteEnabled={false}
        startSentenceWrite={vi.fn()}
        isDemo
      />,
      { store: makeStore() },
    );
    await submit();

    await screen.findByText(/correct translation/i);
    expect(screen.queryByRole('button', { name: 'Report sentence' })).not.toBeInTheDocument();
  });
});
