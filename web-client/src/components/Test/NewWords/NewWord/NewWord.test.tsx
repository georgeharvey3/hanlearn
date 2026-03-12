import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import NewWord from './NewWord';
import { renderWithProviders, createTestStore } from '../../../../test/utils';
import * as dictionaryService from '../../../../services/dictionaryService';
import * as decompositionService from '../../../../services/decompositionService';
import * as ttsService from '../../../../services/ttsService';
import { Word } from '../../../../types/models';

vi.mock('../../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));

vi.mock('../../../../services/decompositionService', () => ({
  decomposeCharacter: vi.fn(),
}));

vi.mock('../../../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

const mockedSpeak = vi.mocked(ttsService.speak);

const mockSearchWord = vi.mocked(dictionaryService.searchWord);
const mockDecomposeCharacter = vi.mocked(decompositionService.decomposeCharacter);

const makeWord = (simp: string, pinyin: string, meaning: string) => ({
  id: 1,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

const mockAnimateCharacter = vi.fn().mockResolvedValue(undefined);
const mockHanziWriterCreate = vi.fn().mockReturnValue({
  animateCharacter: mockAnimateCharacter,
  showCharacter: vi.fn(),
  hideCharacter: vi.fn(),
  showOutline: vi.fn(),
  hideOutline: vi.fn(),
  animateStroke: vi.fn(),
  quiz: vi.fn(),
  cancelQuiz: vi.fn(),
  setCharacter: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchWord.mockResolvedValue([]);
  mockDecomposeCharacter.mockResolvedValue([]);
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
  // Stub HanziWriter
  window.HanziWriter = {
    create: mockHanziWriterCreate,
  };
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
  function makeNoSoundStore() {
    return createTestStore({
      auth: { userId: 'test-user', loading: false, initialized: true },
      settings: { speechAvailable: false, synthAvailable: false },
    });
  }

  it('shows a loading spinner while fetching character details', async () => {
    let resolveSearch!: (value: Word[]) => void;
    mockSearchWord.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

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

    renderWithProviders(<NewWord word={makeWord('中国', 'zhōngguó', 'China')} />, {
      store: makeNoSoundStore(),
    });

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

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');

    // First click triggers the character lookup + decomposition tree lookup
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText('rén')).toBeInTheDocument();
    });
    const callCountAfterFirstClick = mockSearchWord.mock.calls.length;

    // Subsequent clicks of the same character should not re-fetch
    await user.click(buttons[1]);
    await user.click(buttons[0]);

    expect(mockSearchWord).toHaveBeenCalledTimes(callCountAfterFirstClick);
  });
});

describe('NewWord speaker button', () => {
  function makeSynthStore() {
    return createTestStore({
      auth: { userId: 'test-user', loading: false, initialized: true },
      settings: { speechAvailable: false, synthAvailable: true },
    });
  }

  beforeEach(() => {
    localStorage.setItem('useSound', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('useSound');
  });

  it('renders a speaker button when useSound is enabled', async () => {
    // Make auto-speak resolve immediately so speaker button is visible
    mockedSpeak.mockImplementation((_text, options) => {
      options?.onStart?.();
      return { play: vi.fn(), stop: vi.fn() };
    });

    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />, {
      store: makeSynthStore(),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument();
    });
  });

  it('does not render a speaker button when useSound is disabled', () => {
    localStorage.setItem('useSound', 'false');
    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />, {
      store: makeSynthStore(),
    });
    expect(screen.queryByRole('button', { name: /play pronunciation/i })).not.toBeInTheDocument();
  });

  it('shows loading spinner while TTS is loading and hides it on start', async () => {
    let capturedOnStart: (() => void) | undefined;
    mockedSpeak.mockImplementation((_text, options) => {
      capturedOnStart = options?.onStart;
      return { play: vi.fn(), stop: vi.fn() };
    });

    const user = userEvent.setup();
    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />, {
      store: makeSynthStore(),
    });

    // The auto-speak on mount triggers synthLoading
    await waitFor(() => {
      expect(mockedSpeak).toHaveBeenCalled();
    });

    // Should show spinner (synthLoading = true)
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play pronunciation/i })).not.toBeInTheDocument();

    // Simulate TTS starting playback
    capturedOnStart!();

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument();
    });
  });

  it('calls ttsService.speak when speaker button is clicked', async () => {
    // Make the initial auto-speak resolve immediately
    mockedSpeak.mockImplementation((_text, options) => {
      options?.onStart?.();
      return { play: vi.fn(), stop: vi.fn() };
    });

    const user = userEvent.setup();
    renderWithProviders(<NewWord word={makeWord('你好', 'nǐ hǎo', 'hello')} />, {
      store: makeSynthStore(),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument();
    });

    mockedSpeak.mockClear();
    await user.click(screen.getByRole('button', { name: /play pronunciation/i }));

    expect(mockedSpeak).toHaveBeenCalledWith('你好', expect.objectContaining({}));
  });
});

describe('NewWord character decomposition', () => {
  function makeNoSoundStore() {
    return createTestStore({
      auth: { userId: 'test-user', loading: false, initialized: true },
      settings: { speechAvailable: false, synthAvailable: false },
    });
  }

  it('shows Decompose button after clicking a character', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '爱', trad: '愛', pinyin: 'ài', meaning: 'to love' },
    ]);

    renderWithProviders(<NewWord word={makeWord('爱你', 'ài nǐ', 'love you')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('爱'));

    await waitFor(() => {
      expect(screen.getByText('ài')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /decompose/i })).toBeInTheDocument();
  });

  it('shows component rows inline when Decompose is clicked', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '爱', trad: '愛', pinyin: 'ài', meaning: 'to love' },
    ]);

    mockDecomposeCharacter.mockResolvedValue([
      { char: '爫', meaning: 'claw', pinyin: null },
      { char: '冖', meaning: 'cover', pinyin: 'mì' },
      { char: '友', meaning: 'friend', pinyin: 'yǒu' },
    ]);

    renderWithProviders(<NewWord word={makeWord('爱你', 'ài nǐ', 'love you')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('爱'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decompose/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /decompose/i }));

    // Components should appear inline as rows
    await waitFor(() => {
      expect(screen.getByText('爫')).toBeInTheDocument();
      expect(screen.getByText('claw')).toBeInTheDocument();
      expect(screen.getByText('冖')).toBeInTheDocument();
      expect(screen.getByText('cover')).toBeInTheDocument();
      expect(screen.getByText('友')).toBeInTheDocument();
      expect(screen.getByText('friend')).toBeInTheDocument();
    });

    expect(mockDecomposeCharacter).toHaveBeenCalledWith('爱');
  });

  it('toggles decomposition off when Decompose is clicked again', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '爱', trad: '愛', pinyin: 'ài', meaning: 'to love' },
    ]);

    mockDecomposeCharacter.mockResolvedValue([{ char: '友', meaning: 'friend', pinyin: 'yǒu' }]);

    renderWithProviders(<NewWord word={makeWord('爱你', 'ài nǐ', 'love you')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('爱'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decompose/i })).toBeInTheDocument();
    });

    // Open decomposition
    await user.click(screen.getByRole('button', { name: /decompose/i }));
    await waitFor(() => {
      expect(screen.getByText('友')).toBeInTheDocument();
    });

    // Close decomposition by clicking the top-level Decompose button again
    const decomposeButtons = screen.getAllByRole('button', { name: /decompose/i });
    await user.click(decomposeButtons[0]);
    await waitFor(() => {
      expect(screen.queryByText('friend')).not.toBeInTheDocument();
    });
  });

  it('shows "No decomposition available" when components are empty', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' },
    ]);

    mockDecomposeCharacter.mockResolvedValue([]);

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decompose/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /decompose/i }));

    await waitFor(() => {
      expect(screen.getByText('No decomposition available')).toBeInTheDocument();
    });
  });

  it('allows recursive decomposition of component characters', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '爱', trad: '愛', pinyin: 'ài', meaning: 'to love' },
    ]);

    mockDecomposeCharacter.mockImplementation(async (char) => {
      if (char === '爱') return [{ char: '友', meaning: 'friend', pinyin: 'yǒu' }];
      if (char === '友') return [{ char: '又', meaning: 'again', pinyin: 'yòu' }];
      return [];
    });

    renderWithProviders(<NewWord word={makeWord('爱你', 'ài nǐ', 'love you')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('爱'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decompose/i })).toBeInTheDocument();
    });

    // Open top-level decomposition
    await user.click(screen.getByRole('button', { name: /decompose/i }));

    await waitFor(() => {
      expect(screen.getByText('友')).toBeInTheDocument();
    });

    // Find and click the Decompose button on the 友 component row
    const decomposeButtons = screen.getAllByRole('button', { name: /decompose/i });
    // First is the top-level (now active/contained), second is on the 友 row
    const friendDecompBtn = decomposeButtons[decomposeButtons.length - 1];
    await user.click(friendDecompBtn);

    // Should show nested decomposition of 友
    await waitFor(() => {
      expect(screen.getByText('又')).toBeInTheDocument();
      expect(screen.getByText('again')).toBeInTheDocument();
    });
  });
});

describe('NewWord stroke order animation', () => {
  function makeNoSoundStore() {
    return createTestStore({
      auth: { userId: 'test-user', loading: false, initialized: true },
      settings: { speechAvailable: false, synthAvailable: false },
    });
  }

  it('shows Stroke Order button after clicking a character', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' },
    ]);

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stroke order/i })).toBeInTheDocument();
    });
  });

  it('creates HanziWriter and animates when Stroke Order is clicked', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' },
    ]);

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stroke order/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /stroke order/i }));

    await waitFor(() => {
      expect(screen.getByTestId('stroke-order-container')).toBeInTheDocument();
    });

    expect(mockHanziWriterCreate).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      '大',
      expect.objectContaining({
        width: 120,
        height: 120,
        showOutline: true,
      }),
    );
    expect(mockAnimateCharacter).toHaveBeenCalled();
  });

  it('toggles stroke order off when button is clicked again', async () => {
    mockSearchWord.mockResolvedValue([
      { id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' },
    ]);

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stroke order/i })).toBeInTheDocument();
    });

    // Open stroke order
    await user.click(screen.getByRole('button', { name: /stroke order/i }));
    await waitFor(() => {
      expect(screen.getByTestId('stroke-order-container')).toBeInTheDocument();
    });

    // Close stroke order
    await user.click(screen.getByRole('button', { name: /stroke order/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('stroke-order-container')).not.toBeInTheDocument();
    });
  });

  it('re-creates HanziWriter when a different character is clicked', async () => {
    mockSearchWord.mockImplementation(async (char) => {
      if (char === '大') return [{ id: 1, simp: '大', trad: '大', pinyin: 'dà', meaning: 'big' }];
      if (char === '家') return [{ id: 2, simp: '家', trad: '家', pinyin: 'jiā', meaning: 'home' }];
      return [];
    });

    renderWithProviders(<NewWord word={makeWord('大家', 'dàjiā', 'everyone')} />, {
      store: makeNoSoundStore(),
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('大'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stroke order/i })).toBeInTheDocument();
    });

    // Open stroke order for 大
    await user.click(screen.getByRole('button', { name: /stroke order/i }));
    await waitFor(() => {
      expect(mockHanziWriterCreate).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        '大',
        expect.any(Object),
      );
    });

    mockHanziWriterCreate.mockClear();
    mockAnimateCharacter.mockClear();

    // Click a different character — stroke order should update
    await user.click(screen.getByText('家'));

    await waitFor(() => {
      expect(mockHanziWriterCreate).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        '家',
        expect.any(Object),
      );
    });
    expect(mockAnimateCharacter).toHaveBeenCalled();
  });
});
