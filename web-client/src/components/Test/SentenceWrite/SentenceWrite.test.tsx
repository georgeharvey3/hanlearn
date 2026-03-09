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
import { Word } from '../../../types/models';

const mockedGetSegmentedSentence = vi.mocked(sentenceService.getSegmentedSentence);

const testWord: Word = {
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'ni3 hao3',
  meaning: 'hello',
  bank: 2,
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
    addWords: { words: [], loading: false, error: false },
    settings: { speechAvailable, synthAvailable },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSegmentedSentence.mockResolvedValue(mockSentenceResponse);
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

  it('shows yes/no buttons after submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /i got it right/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /i got it wrong/i })).toBeInTheDocument();
    });
  });

  it('resets to input view when No clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={vi.fn()} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const noBtn = await screen.findByRole('button', { name: /i got it wrong/i });
    await user.click(noBtn);

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
  it('calls onComplete after Yes click on the last word', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithProviders(<SentenceWrite words={[testWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const yesBtn = await screen.findByRole('button', { name: /i got it right/i });
    await user.click(yesBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fetches next word sentence after Yes on a non-last word', async () => {
    const user = userEvent.setup();
    const secondWord: Word = { ...testWord, id: 2, simp: '学习', trad: '學習' };
    const onComplete = vi.fn();

    renderWithProviders(<SentenceWrite words={[testWord, secondWord]} onComplete={onComplete} />, {
      store: makeStore(),
    });

    const input = await screen.findByPlaceholderText(/type chinese and press enter/i);
    await user.type(input, '你好{Enter}');

    const yesBtn = await screen.findByRole('button', { name: /i got it right/i });
    await user.click(yesBtn);

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
