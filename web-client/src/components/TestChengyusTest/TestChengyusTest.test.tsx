import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { renderWithProviders } from '../../test/utils';
import TestChengyusTest from './TestChengyusTest';
import { Word } from '../../types/models';
import * as ttsService from '../../services/ttsService';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
}));

const mockWords: Word[] = [
  {
    id: 1,
    simp: '一石二鸟',
    trad: '一石二鳥',
    pinyin: 'yī shí èr niǎo',
    meaning: 'kill two birds with one stone',
  },
  {
    id: 2,
    simp: '半途而废',
    trad: '半途而廢',
    pinyin: 'bàn tú ér fèi',
    meaning: 'give up halfway',
  },
  {
    id: 3,
    simp: '画蛇添足',
    trad: '畫蛇添足',
    pinyin: 'huà shé tiān zú',
    meaning: 'to draw a snake and add feet/to overdo it',
  },
];

const storeState = {
  settings: { speechAvailable: false, synthAvailable: true, voice: null, lang: 'zh-CN' },
  auth: {
    userId: null,
    loading: false,
    error: null,
    newSignUp: false,
    initialized: true,
    modalOpen: false,
    modalMode: 'login' as const,
  },
  addWords: {
    lists: [],
    activeListId: 'default',
    words: [],
    listStats: {},
    error: false,
    loading: false,
  },
};

describe('TestChengyusTest', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the first word characters', () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();
    expect(screen.getByLabelText('Show details for 石')).toBeInTheDocument();
  });

  it('shows an error message when character lookup returns non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByLabelText('Show details for 一'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error looking up character');
    });
  });

  it('shows an error message when character lookup network request fails (regression: unhandled rejection)', async () => {
    // Before fix: fetch().then() without .catch() caused unhandled promise rejection on network failure
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByLabelText('Show details for 一'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error looking up character');
    });
  });

  it('toggles chengyu meaning when Show Answer is clicked', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    expect(screen.queryByText('kill two birds with one stone')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Show Answer'));

    expect(screen.getByText(/kill two birds with one stone/)).toBeInTheDocument();
  });

  it('displays character data when lookup succeeds', async () => {
    const charData = {
      simp: '石',
      pinyins: ['shí'],
      meanings: ['stone', 'rock', 'CL:塊|块'],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(charData),
    });

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByLabelText('Show details for 石'));

    await waitFor(() => {
      // The char info section shows pinyin and filtered meanings
      expect(screen.getByText('(shí)')).toBeInTheDocument();
      // CL: meanings should be filtered out
      expect(screen.getByText('stone / rock')).toBeInTheDocument();
    });
  });

  it('navigates to next word when Next button is clicked', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // First word characters visible
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Next'));

    // Second word characters visible
    expect(screen.getByLabelText('Show details for 半')).toBeInTheDocument();
    expect(screen.getByLabelText('Show details for 途')).toBeInTheDocument();
  });

  it('navigates to previous word when Previous button is clicked', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // Go to second word first
    await userEvent.click(screen.getByText('Next'));
    expect(screen.getByLabelText('Show details for 半')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Previous'));

    // Back to first word
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();
  });

  it('disables Previous button on first word', () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button on last word', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // Navigate to last word
    await userEvent.click(screen.getByText('Next'));
    await userEvent.click(screen.getByText('Next'));

    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('clears charData and meaning when navigating to next word', async () => {
    const charData = {
      simp: '一',
      pinyins: ['yī'],
      meanings: ['one'],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(charData),
    });

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // Look up a character and show meaning
    await userEvent.click(screen.getByLabelText('Show details for 一'));
    await waitFor(() => {
      expect(screen.getByText('(yī)')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Show Answer'));

    // Navigate to next word
    await userEvent.click(screen.getByText('Next'));

    // Char data and meaning should be cleared
    expect(screen.queryByText('(yī)')).not.toBeInTheDocument();
    expect(screen.queryByText(/kill two birds with one stone/)).not.toBeInTheDocument();
  });

  it('toggles answer text between Show and Hide', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    expect(screen.getByText('Show Answer')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Show Answer'));

    expect(screen.getByText('Hide Answer')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Hide Answer'));

    expect(screen.getByText('Show Answer')).toBeInTheDocument();
  });

  it('shows pinyin and meaning when answer is toggled on', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByText('Show Answer'));

    expect(screen.getByText('(yī shí èr niǎo)')).toBeInTheDocument();
    expect(screen.getByText(/kill two birds with one stone/)).toBeInTheDocument();
  });

  it('speaks pinyin when character is clicked and useSound is true', async () => {
    localStorage.setItem('useSound', 'true');

    renderWithProviders(<TestChengyusTest words={mockWords} />, {
      store: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ simp: '石', pinyins: ['shí'], meanings: ['stone'] }),
    });

    await userEvent.click(screen.getByLabelText('Show details for 石'));

    expect(ttsService.speak).toHaveBeenCalledWith(
      '石',
      expect.objectContaining({ fallbackLang: expect.any(String) }),
    );
  });

  it('calls startTest when pressing ArrowRight on last word', async () => {
    const startTest = vi.fn();
    renderWithProviders(<TestChengyusTest words={mockWords} startTest={startTest} />);

    // Navigate to last word
    await userEvent.click(screen.getByText('Next'));
    await userEvent.click(screen.getByText('Next'));

    // Press ArrowRight on last word
    await userEvent.keyboard('{ArrowRight}');

    expect(startTest).toHaveBeenCalled();
  });

  it('navigates with ArrowLeft and ArrowRight keyboard keys', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // First word
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();

    // ArrowRight to go to second word
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByLabelText('Show details for 半')).toBeInTheDocument();

    // ArrowLeft to go back
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();
  });

  it('toggles answer with Space key', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    expect(screen.queryByText(/kill two birds with one stone/)).not.toBeInTheDocument();

    await userEvent.keyboard(' ');

    expect(screen.getByText(/kill two birds with one stone/)).toBeInTheDocument();
  });

  it('does not navigate left past the first word', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    // Already on first word, pressing ArrowLeft should do nothing
    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();
  });

  it('renders baidu lookup link for current word', () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    const link = screen.getByText('Lookup chengyu information');
    expect(link).toHaveAttribute('href', 'https://baike.baidu.com/item/一石二鸟');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('speaks character in demo mode when synthAvailable is true', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ simp: '一', pinyins: ['yī'], meanings: ['one'] }),
    });

    // Turn off useSound but enable demo + synth
    localStorage.setItem('useSound', 'false');

    const demoStore = {
      ...storeState,
      settings: { ...storeState.settings, synthAvailable: true },
    };

    renderWithProviders(<TestChengyusTest words={mockWords} isDemo />, {
      store: undefined,
    });

    // Clear calls from initial render auto-speak
    vi.mocked(ttsService.speak).mockClear();

    await userEvent.click(screen.getByLabelText('Show details for 一'));

    // In demo mode with synthAvailable, should speak even if useSound is false
    expect(ttsService.speak).toHaveBeenCalledWith('一', expect.any(Object));
  });
});
