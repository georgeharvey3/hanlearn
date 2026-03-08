import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import NewWord from './NewWord';
import { renderWithProviders } from '../../../../test/utils';
import * as dictionaryService from '../../../../services/dictionaryService';
import { Word } from '../../../../types/models';

vi.mock('../../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));

vi.mock('../../../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

const mockSearchWord = vi.mocked(dictionaryService.searchWord);

const makeWord = (simp: string, pinyin: string, meaning: string) => ({
  id: 1,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchWord.mockResolvedValue([]);
  // Stub speechSynthesis
  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
  } as unknown as SpeechSynthesis;
  // Stub SpeechSynthesisUtterance
  global.SpeechSynthesisUtterance = class {
    lang = '';
    voice = null;
    onerror = null;
  } as unknown as typeof SpeechSynthesisUtterance;
});

describe('NewWord character interaction', () => {
  it('renders each character as a button', () => {
    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]).toHaveTextContent('你');
    expect(buttons[1]).toHaveTextContent('好');
  });

  it('clicking a character reveals its details', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' },
    ]);

    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('你'));

    await waitFor(() => {
      expect(screen.getByText('nǐ')).toBeInTheDocument();
    });
  });

  it('clicking a different character updates the details', async () => {
    mockSearchWord.mockImplementation(async (char) => {
      if (char === '你') return [{ id: 1, simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' }];
      if (char === '好') return [{ id: 2, simp: '好', trad: '好', pinyin: 'hǎo', meaning: 'good' }];
      return [];
    });

    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('你'));

    await waitFor(() => {
      expect(screen.getByText('nǐ')).toBeInTheDocument();
    });

    await user.click(screen.getByText('好'));

    await waitFor(() => {
      expect(screen.getByText('hǎo')).toBeInTheDocument();
    });
  });

  it('duplicate characters can be independently selected', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '妈', trad: '媽', pinyin: 'mā', meaning: 'mother' },
    ]);

    renderWithProviders(<NewWord word={makeWord('妈妈', 'māma', 'mother')} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText('mā')).toBeInTheDocument();
    });

    // Both buttons exist and are independently clickable
    await user.click(buttons[1]);

    // Only one unique character '妈', so searchWord is called once by pre-fetch
    // (or on click if pre-fetch hasn't resolved yet). Clicks use the cache.
    await waitFor(() => {
      expect(mockSearchWord).toHaveBeenCalled();
    });
  });
});

describe('NewWord loading indicator', () => {
  it('shows a loading spinner while fetching character details', async () => {
    let resolveSearch!: (value: Word[]) => void;
    mockSearchWord.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    // Loading spinner should appear
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Resolve the search
    resolveSearch([{ id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' }]);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Character details now shown (meaning chip appears)
    expect(screen.getByText('big')).toBeInTheDocument();
  });

  it('uses pre-fetched cache and skips loading indicator', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '中', trad: '中', pinyin: 'zhōng', meaning: 'middle' },
    ]);

    renderWithProviders(<NewWord word={makeWord('中国', 'zhōngguó', 'China')} />);

    // Wait for pre-fetch to complete
    await waitFor(() => {
      expect(mockSearchWord).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('中'));

    // Should show details immediately without spinner
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    // The meaning chip from charData should be visible
    expect(screen.getByText('middle')).toBeInTheDocument();
  });

  it('does not re-fetch on repeated clicks of the same character', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '人', trad: '人', pinyin: 'rén', meaning: 'person' },
    ]);

    renderWithProviders(<NewWord word={makeWord('人人', 'rénrén', 'everyone')} />);

    // Wait for pre-fetch
    await waitFor(() => {
      expect(mockSearchWord).toHaveBeenCalled();
    });
    const callCountAfterPrefetch = mockSearchWord.mock.calls.length;

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');

    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(buttons[0]);

    // No additional calls beyond the pre-fetch
    expect(mockSearchWord).toHaveBeenCalledTimes(callCountAfterPrefetch);
  });
});
