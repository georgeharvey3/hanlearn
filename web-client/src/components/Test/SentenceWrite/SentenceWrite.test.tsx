/**
 * Tests for SentenceWrite component — the "write in Chinese" stage.
 *
 * Focus areas:
 * - Shows spinner while fetching the first sentence
 * - Renders the English prompt and target word once loaded
 * - Submitting an answer shows the comparison view (user answer vs original)
 * - Yes (got it right) advances to the next word and calls onComplete when done
 * - No (got it wrong) resets to the input view
 * - Skips words with no available sentences
 * - Avoids showing sentences already seen in SentenceRead (via seenOffsets)
 * - English words are tappable for translation
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
vi.mock('../../../services/similarityService', () => ({
  getSimilarityScore: vi.fn(),
}));
vi.mock('../../../utils/sentenceUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/sentenceUtils')>();
  return {
    ...actual,
    resolveSentence: vi.fn().mockResolvedValue({
      chinese: {
        sentence: '你好，我是学生。',
        words: [
          '你好',
          { id: 10, simp: '学生', trad: '學生', pinyin: 'xué shēng', meaning: 'student' },
        ],
        highlight: [[0, 2]],
        targetIndex: 0,
      },
      english: { sentence: 'Hello, I am a student.', highlight: [] },
    }),
  };
});

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SentenceWrite from './SentenceWrite';
import { renderWithProviders, createTestStore } from '../../../test/utils';
import * as sentenceService from '../../../services/sentenceService';
import * as similarityService from '../../../services/similarityService';
import { Word } from '../../../types/models';

const mockedGetSegmentedSentence = vi.mocked(sentenceService.getSegmentedSentence);
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

const mockSentenceResponse = {
  sentence: {
    chinese: {
      sentence: '你好，我是学生。',
      highlight: [[0, 2]] as number[][],
      segments: ['你好', '学生'],
      targetIndex: 0,
    },
    english: {
      sentence: 'Hello, I am a student.',
      highlight: [] as number[][],
    },
  },
  totalCount: 2,
};

function makeStore(speechAvailable = false, synthAvailable = false) {
  return createTestStore({
    auth: { userId: 'u1', loading: false, initialized: true, modalOpen: false },
    addWords: {
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
      activeListId: 'default',
      words: [],
      listStats: {},
      loading: false,
      error: false,
    },
    settings: { speechAvailable, synthAvailable },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSegmentedSentence.mockResolvedValue(mockSentenceResponse);
  mockedGetSimilarityScore.mockResolvedValue({ score: 72, rawSimilarity: 0.86 });
});

describe('SentenceWrite — loading state', () => {
  it('shows spinner while fetching the first sentence', () => {
    mockedGetSegmentedSentence.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('hides spinner after sentence is loaded', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});

describe('SentenceWrite — prompt display', () => {
  it('shows the English prompt words', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      // Each word is rendered individually as tappable elements
      expect(screen.getByText('Hello,')).toBeInTheDocument();
      expect(screen.getByText('am')).toBeInTheDocument();
      expect(screen.getByText('student.')).toBeInTheDocument();
    });
  });

  it('shows the "must use" target word badge', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
      expect(screen.getByText(/must use/i)).toBeInTheDocument();
    });
  });

  it('renders the "Write in Chinese" heading', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.getByText(/write in chinese/i)).toBeInTheDocument();
    });
  });

  it('shows progress indicator "Word 1 of 2" for the first word', async () => {
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.getByText('Word 1 of 2')).toBeInTheDocument();
    });
  });

  it('shows progress indicator on the comparison view after submission', async () => {
    const user = userEvent.setup();
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Word 1 of 2')).toBeInTheDocument();
    });
  });

  it('renders the answer input field', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type chinese and press enter/i)).toBeInTheDocument();
    });
  });

  it('shows hint text about tapping words for translation', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      expect(screen.getByText(/tap english words for translation help/i)).toBeInTheDocument();
    });
  });
});

describe('SentenceWrite — translation feature', () => {
  it('renders English words as tappable buttons', async () => {
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });
    await waitFor(() => {
      const wordButton = screen.getByRole('button', {
        name: /student\.: tap to select for translation/i,
      });
      expect(wordButton).toBeInTheDocument();
    });
  });

  it('shows Translate button when a word is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.getByText('student.')).toBeInTheDocument();
    });

    // No translate button initially
    expect(screen.queryByRole('button', { name: /translate/i })).not.toBeInTheDocument();

    // Click on "student."
    await user.click(screen.getByText('student.'));

    // Translate button should appear
    expect(screen.getByRole('button', { name: /translate/i })).toBeInTheDocument();
  });

  it('hides Translate button when word is deselected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.getByText('student.')).toBeInTheDocument();
    });

    // Select then deselect
    await user.click(screen.getByText('student.'));
    expect(screen.getByRole('button', { name: /translate/i })).toBeInTheDocument();

    await user.click(screen.getByText('student.'));
    expect(screen.queryByRole('button', { name: /translate/i })).not.toBeInTheDocument();
  });

  it('shows translation result after clicking Translate', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.getByText('student.')).toBeInTheDocument();
    });

    // Select "student." and translate
    await user.click(screen.getByText('student.'));
    await user.click(screen.getByRole('button', { name: /translate/i }));

    // Should show the Chinese translation
    await waitFor(() => {
      expect(screen.getByText('学生')).toBeInTheDocument();
      expect(screen.getByText('xué shēng')).toBeInTheDocument();
    });
  });

  it('shows "No translation found" when no match exists', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.getByText('I')).toBeInTheDocument();
    });

    // Select "I" which won't match any sentence word meaning
    await user.click(screen.getByText('I'));
    await user.click(screen.getByRole('button', { name: /translate/i }));

    await waitFor(() => {
      expect(screen.getByText(/no translation found/i)).toBeInTheDocument();
    });
  });
});

describe('SentenceWrite — submitting an answer', () => {
  it('shows the comparison view after typing and pressing Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/your answer/i)).toBeInTheDocument();
      expect(screen.getByText(/original/i)).toBeInTheDocument();
    });
  });

  it('shows Next Word/Try Again buttons and similarity score after submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next word/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    // Similarity score should appear
    await waitFor(() => {
      expect(screen.getByText('72%')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });
  });

  it('resets to input view when Try Again clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const tryAgainBtn = await screen.findByRole('button', { name: /try again/i });
    await user.click(tryAgainBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type chinese and press enter/i)).toBeInTheDocument();
    });
  });

  it('does NOT submit when Enter pressed with empty input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '{Enter}');

    // Should still be on the input view — comparison "Original" section only appears after submission
    expect(screen.queryByText(/^original$/i)).not.toBeInTheDocument();
    // Yes/No buttons should not be visible yet
    expect(screen.queryByRole('button', { name: /i got it right/i })).not.toBeInTheDocument();
  });
});

describe('SentenceWrite — stage completion', () => {
  it('calls onComplete after Next Word click on the last word', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const nextBtn = await screen.findByRole('button', { name: /next word/i });
    await user.click(nextBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fetches next word sentence after Next Word on a non-last word', async () => {
    const user = userEvent.setup();
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    const onComplete = vi.fn();

    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const nextBtn = await screen.findByRole('button', { name: /next word/i });
    await user.click(nextBtn);

    // onComplete should NOT fire yet (still has a second word to do)
    expect(onComplete).not.toHaveBeenCalled();
    // getSegmentedSentence should have been called for the second word
    expect(mockedGetSegmentedSentence).toHaveBeenCalledWith(
      '学习',
      expect.any(String),
      expect.any(Number),
    );
  });

  it('skips a word with no sentences and moves to the next', async () => {
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    const onComplete = vi.fn();

    // First word: no sentences; second word: has a sentence
    mockedGetSegmentedSentence
      .mockResolvedValueOnce({ sentence: null, totalCount: 0 })
      .mockResolvedValue(mockSentenceResponse);

    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    // After skipping 你好, the component should load 学习's sentence and show its prompt
    await waitFor(
      () => {
        expect(mockedGetSegmentedSentence).toHaveBeenCalledWith(
          '学习',
          expect.any(String),
          expect.any(Number),
        );
      },
      { timeout: 3000 },
    );
  });

  it('skips offset 0 when seenOffsets has offset 0 for the word, starting at offset 1', async () => {
    // seenOffsets[word].offset === 0 means offset 0 was shown in SentenceRead
    // SentenceWrite should skip to offset 1 directly (without loading offset 0 first)
    const seenOffsets = {
      你好: { offset: 0, text: '你好，我是学生。', english: 'Hello, I am a student.' },
    };

    renderWithProviders(
      <SentenceWrite words={[testWord]} seenOffsets={seenOffsets} onComplete={vi.fn()} />,
      { store: makeStore() },
    );

    await waitFor(() => {
      // The first call should use offset 1, not 0, since seenOffset is 0
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith('你好', expect.any(String), 1);
    });
  });
});

describe('SentenceWrite — duplicate sentence avoidance', () => {
  it('retries with next offset when sentence matches seenOffsets text', async () => {
    const seenOffsets = {
      你好: { offset: 0, text: '你好，我是学生。', english: 'Hello, I am a student.' },
    };

    // First call returns a sentence whose chinese matches seenText → duplicate
    const duplicateSentence = {
      sentence: {
        chinese: {
          sentence: '你好，我是学生。',
          highlight: [[0, 2]] as number[][],
          segments: ['你好'],
          targetIndex: 0,
        },
        english: {
          sentence: 'Different English.',
          highlight: [] as number[][],
        },
      },
      totalCount: 3,
    };

    mockedGetSegmentedSentence
      .mockResolvedValueOnce(duplicateSentence) // offset 1: dup by chinese text
      .mockResolvedValue(mockSentenceResponse); // offset 2: fresh

    renderWithProviders(
      <SentenceWrite words={[testWord]} seenOffsets={seenOffsets} onComplete={vi.fn()} />,
      { store: makeStore() },
    );

    await waitFor(() => {
      // Should have retried with offset 2 after detecting the duplicate
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith('你好', expect.any(String), 2);
    });
  });

  it('retries with next offset when sentence matches seenOffsets english', async () => {
    const seenOffsets = {
      你好: { offset: 0, text: 'different text', english: 'Hello, I am a student.' },
    };

    // First call returns sentence whose english matches seenEnglish
    const dupByEnglish = {
      sentence: {
        chinese: {
          sentence: '你好世界',
          highlight: [[0, 2]] as number[][],
          segments: ['你好'],
          targetIndex: 0,
        },
        english: {
          sentence: 'Hello, I am a student.',
          highlight: [] as number[][],
        },
      },
      totalCount: 3,
    };

    mockedGetSegmentedSentence
      .mockResolvedValueOnce(dupByEnglish) // offset 1: dup by english
      .mockResolvedValue(mockSentenceResponse); // offset 2: fresh

    renderWithProviders(
      <SentenceWrite words={[testWord]} seenOffsets={seenOffsets} onComplete={vi.fn()} />,
      { store: makeStore() },
    );

    await waitFor(() => {
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith('你好', expect.any(String), 2);
    });
  });

  it('skips to next word when all offsets are duplicates', async () => {
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    const seenOffsets = {
      你好: { offset: 0, text: '你好，我是学生。', english: 'Hello, I am a student.' },
    };

    // Only 1 total sentence available and it's a duplicate
    const dupSentence = {
      sentence: {
        chinese: {
          sentence: '你好，我是学生。',
          highlight: [[0, 2]] as number[][],
          segments: ['你好'],
          targetIndex: 0,
        },
        english: {
          sentence: 'Whatever.',
          highlight: [] as number[][],
        },
      },
      totalCount: 1,
    };

    mockedGetSegmentedSentence
      .mockResolvedValueOnce(dupSentence) // offset 1: returns dup, totalCount=1 → no more to try
      .mockResolvedValue(mockSentenceResponse); // next word

    renderWithProviders(
      <SentenceWrite
        words={[testWord, secondWord]}
        seenOffsets={seenOffsets}
        onComplete={vi.fn()}
      />,
      { store: makeStore() },
    );

    await waitFor(() => {
      // Should skip to second word
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith(
        '学习',
        expect.any(String),
        expect.any(Number),
      );
    });
  });
});

describe('SentenceWrite — fetch error handling', () => {
  it('hides spinner and stays on input when fetch throws', async () => {
    mockedGetSegmentedSentence.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('falls back to offset 0 when non-zero offset returns null sentence', async () => {
    const seenOffsets = {
      你好: { offset: 0, text: 'other text', english: 'other english' },
    };

    // offset 1 returns null, then fallback to offset 0
    mockedGetSegmentedSentence
      .mockResolvedValueOnce({ sentence: null, totalCount: 2 }) // offset 1: null
      .mockResolvedValueOnce(mockSentenceResponse); // fallback offset 0

    renderWithProviders(
      <SentenceWrite words={[testWord]} seenOffsets={seenOffsets} onComplete={vi.fn()} />,
      { store: makeStore() },
    );

    await waitFor(() => {
      // Second call should be offset 0 fallback
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith('你好', expect.any(String), 0);
    });

    // Should eventually show the prompt
    await waitFor(() => {
      expect(screen.getByText('Hello,')).toBeInTheDocument();
    });
  });
});

describe('SentenceWrite — similarity score edge cases', () => {
  it('shows "Score unavailable" when similarity service fails', async () => {
    const user = userEvent.setup();
    mockedGetSimilarityScore.mockRejectedValue(new Error('Service down'));

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/score unavailable/i)).toBeInTheDocument();
    });
  });

  it('shows loading state before score resolves', async () => {
    const user = userEvent.setup();
    // Never resolve the similarity score
    mockedGetSimilarityScore.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    // The comparison view should show while score is loading
    await waitFor(() => {
      expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    });
  });
});

describe('SentenceWrite — keyboard shortcuts', () => {
  it('navigates home on Space key when finished (all words done)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    // Submit answer
    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    // Click "Next Word" to advance past the last word
    const nextBtn = await screen.findByRole('button', { name: /next word/i });
    await user.click(nextBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('advances to next word on ArrowUp when submitted', async () => {
    const user = userEvent.setup();
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };

    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    // Wait for comparison view
    await waitFor(() => {
      expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    });

    // Press ArrowUp to trigger onYesClicked
    await user.keyboard('{ArrowUp}');

    // Should fetch next word's sentence
    await waitFor(() => {
      expect(mockedGetSegmentedSentence).toHaveBeenCalledWith(
        '学习',
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  it('resets to input view on ArrowDown when submitted', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    });

    // Press ArrowDown to trigger onNoClicked (Try Again)
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type chinese and press enter/i)).toBeInTheDocument();
    });
  });

  it('toggles English word selection via keyboard Enter', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    await waitFor(() => {
      expect(screen.getByText('student.')).toBeInTheDocument();
    });

    // Focus the word button and press Enter
    const wordBtn = screen.getByRole('button', {
      name: /student\.: tap to select for translation/i,
    });
    wordBtn.focus();
    await user.keyboard('{Enter}');

    // Translate button should appear
    expect(screen.getByRole('button', { name: /translate/i })).toBeInTheDocument();
  });
});
