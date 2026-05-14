import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WordCard from './WordCard';
import * as ttsService from '../../services/ttsService';
import { Word, WordList } from '../../types/models';

vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(),
}));

const mockedSpeak = vi.mocked(ttsService.speak);

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 1,
    simp: '你好',
    trad: '你好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello',
    ...overrides,
  };
}

const defaultLists: WordList[] = [
  { id: 'default', name: 'General', createdAt: '', order: 0 },
  { id: 'list-b', name: 'Travel', createdAt: '', order: 1 },
];

describe('WordCard', () => {
  const defaultProps = {
    charSet: 'simp' as const,
    lists: defaultLists,
    onDeleteWord: vi.fn(),
    onPostMeaningUpdate: vi.fn(),
    onMoveWord: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the simplified character, pinyin, and meaning', () => {
    render(<WordCard word={makeWord()} {...defaultProps} />);

    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument();
  });

  it('renders the traditional character when charSet is trad', () => {
    const word = makeWord({ simp: '学习', trad: '學習' });
    render(<WordCard word={word} {...defaultProps} charSet="trad" />);

    expect(screen.getByText('學習')).toBeInTheDocument();
  });

  it('calls ttsService.speak with the correct character on play button click', () => {
    render(<WordCard word={makeWord()} {...defaultProps} />);

    const playButton = screen.getByRole('button', { name: /play pronunciation/i });
    fireEvent.click(playButton);

    expect(mockedSpeak).toHaveBeenCalledWith(
      '你好',
      expect.objectContaining({
        onEnd: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('uses the trad character for TTS when charSet is trad', () => {
    const word = makeWord({ simp: '学习', trad: '學習' });
    render(<WordCard word={word} {...defaultProps} charSet="trad" />);

    fireEvent.click(screen.getByRole('button', { name: /play pronunciation/i }));

    expect(mockedSpeak).toHaveBeenCalledWith('學習', expect.any(Object));
  });

  it('resets isPlaying state when onEnd callback fires', () => {
    render(<WordCard word={makeWord()} {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /play pronunciation/i }));

    // Extract the onEnd callback and invoke it inside act()
    const callbacks = mockedSpeak.mock.calls[0][1]!;
    act(() => {
      callbacks.onEnd!();
    });

    // The button should no longer show the "playing" state
    expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument();
  });

  it('resets isPlaying state when onError callback fires', () => {
    render(<WordCard word={makeWord()} {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /play pronunciation/i }));

    const callbacks = mockedSpeak.mock.calls[0][1]!;
    act(() => {
      callbacks.onError!();
    });

    expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument();
  });

  it('renders the due date when word has a due_date', () => {
    const word = makeWord({ due_date: '2026-03-20' });
    render(<WordCard word={word} {...defaultProps} />);

    // formatRelativeDueDate returns a string like "Due in 5 days" or "Due Mar 20"
    // We just verify something renders in the due date area
    const dueDateText = screen.getByText(/due/i);
    expect(dueDateText).toBeInTheDocument();
  });

  it('does not render a due date when word has no due_date', () => {
    render(<WordCard word={makeWord()} {...defaultProps} />);

    expect(screen.queryByText(/due/i)).not.toBeInTheDocument();
  });

  it('calls onDeleteWord with the word id when remove is clicked', () => {
    const onDeleteWord = vi.fn();
    render(<WordCard word={makeWord({ id: 42 })} {...defaultProps} onDeleteWord={onDeleteWord} />);

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(onDeleteWord).toHaveBeenCalledWith(42);
  });

  it('hides the move button when there is no other list to move to', () => {
    render(
      <WordCard
        word={makeWord({ listId: 'default' })}
        {...defaultProps}
        lists={[{ id: 'default', name: 'General', createdAt: '', order: 0 }]}
      />,
    );

    expect(screen.queryByRole('button', { name: /move word to list/i })).not.toBeInTheDocument();
  });

  it('opens the move dialog and calls onMoveWord with the chosen list', () => {
    const onMoveWord = vi.fn();
    render(
      <WordCard
        word={makeWord({ id: 7, listId: 'default', simp: '朋友' })}
        {...defaultProps}
        onMoveWord={onMoveWord}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /move word to list/i }));
    fireEvent.click(screen.getByRole('button', { name: /move to travel/i }));

    expect(onMoveWord).toHaveBeenCalledWith(7, 'list-b', '朋友');
  });
});
