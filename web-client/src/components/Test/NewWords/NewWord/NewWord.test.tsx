import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import NewWord from './NewWord';
import { renderWithProviders } from '../../../../test/utils';
import * as dictionaryService from '../../../../services/dictionaryService';

vi.mock('../../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));

const mockSearchWord = vi.mocked(dictionaryService.searchWord);

const makeWord = (simp: string, pinyin: string, meaning: string) => ({
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
    mockSearchWord.mockResolvedValue([{ simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' }]);

    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('你'));

    await waitFor(() => {
      expect(screen.getByText('nǐ')).toBeInTheDocument();
    });
  });

  it('clicking a different character updates the details', async () => {
    mockSearchWord
      .mockResolvedValueOnce([{ simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' }])
      .mockResolvedValueOnce([{ simp: '好', trad: '好', pinyin: 'hǎo', meaning: 'good' }]);

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
    mockSearchWord.mockResolvedValue([{ simp: '妈', trad: '媽', pinyin: 'mā', meaning: 'mother' }]);

    renderWithProviders(<NewWord word={makeWord('妈妈', 'māma', 'mother')} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText('mā')).toBeInTheDocument();
    });

    // Only the first button should have the active background
    // Both buttons exist and are independently clickable
    await user.click(buttons[1]);

    await waitFor(() => {
      expect(mockSearchWord).toHaveBeenCalledTimes(2);
    });
  });
});
