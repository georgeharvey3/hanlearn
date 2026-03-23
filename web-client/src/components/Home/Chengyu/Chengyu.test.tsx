/**
 * Tests for Chengyu component — the daily chengyu multiple-choice challenge.
 *
 * Focus areas:
 * - Renders the chengyu characters and "Chengyu Of The Day" heading
 * - Shows answer options from the daily chengyu
 * - Clicking the correct answer transitions to the "finished" state
 * - Clicking an incorrect answer marks it as incorrect (turns red) without finishing
 * - After finishing, shows character breakdown (charPinyins details)
 * - After finishing, shows the correct meaning text
 * - Multiple wrong clicks are tracked individually
 * - Traditional characters display immediately when charSet is 'trad'
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../services/wordService', () => ({
  addWordToList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/chengyuSentenceService', () => ({
  getChengyuExampleSentence: vi.fn().mockResolvedValue({
    chinese: '这个人真是独一无二的天才。',
    pinyin: 'zhè ge rén zhēn shì dú yī wú èr de tiān cái.',
    english: 'This person is truly a one-of-a-kind genius.',
  }),
}));

// Mock the data module to provide deterministic chengyu data
vi.mock('../../../data/chengyus', () => ({
  getDailyChengyu: vi.fn(() => ({
    chengyu: '独一无二',
    tradChengyu: '獨一無二',
    pinyin: 'dú yī wú èr',
    options: ['unique', 'to be together forever', 'to live frugally', 'to be graceful'],
    correct: 'unique',
    charPinyins: [
      { char: '独', pinyin: 'dú', meaning: 'alone; independent; single' },
      { char: '一', pinyin: 'yī', meaning: 'one; single; a (article)' },
      { char: '无', pinyin: 'wú', meaning: 'not to have; no; none' },
      { char: '二', pinyin: 'èr', meaning: 'two; 2; (Beijing dialect) stupid' },
    ],
    tradCharPinyins: [
      { char: '獨', pinyin: 'dú', meaning: 'alone; independent; single' },
      { char: '一', pinyin: 'yī', meaning: 'one; single; a (article)' },
      { char: '無', pinyin: 'wú', meaning: 'not to have; no; none' },
      { char: '二', pinyin: 'èr', meaning: 'two; 2; (Beijing dialect) stupid' },
    ],
  })),
  convertDailyChengyu: vi.fn((dailyChengyu, charSet) => {
    if (charSet === 'trad') {
      return { chengyu: dailyChengyu.tradChengyu, charPinyins: dailyChengyu.tradCharPinyins };
    }
    return { chengyu: dailyChengyu.chengyu, charPinyins: dailyChengyu.charPinyins };
  }),
}));

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import Chengyu from './Chengyu';
import { renderWithProviders, createTestStore } from '../../../test/utils';
import { getChengyuExampleSentence } from '../../../services/chengyuSentenceService';

function makeStore(overrides?: { userId?: string | null; words?: Array<Record<string, unknown>> }) {
  return createTestStore({
    auth: {
      userId: overrides?.userId ?? null,
      loading: false,
      initialized: true,
      modalOpen: false,
    },
    addWords: {
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
      activeListId: 'default',
      words: overrides?.words ?? [],
      listStats: {},
      loading: false,
      error: false,
    },
    settings: { speechAvailable: false, synthAvailable: false },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Chengyu — accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Chengyu />, { store: makeStore() });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Chengyu — initial render', () => {
  it('renders the "Chengyu Of The Day" heading', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.getByText(/chengyu of the day/i)).toBeInTheDocument();
  });

  it('displays the chengyu characters', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.getByText('独一无二')).toBeInTheDocument();
  });

  it('renders all four answer options', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.getByRole('button', { name: /^unique$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /to be together forever/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /to live frugally/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /to be graceful/ })).toBeInTheDocument();
  });

  it('shows "Choose the correct translation" prompt', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.getByText(/choose the correct translation/i)).toBeInTheDocument();
  });
});

describe('Chengyu — traditional characters', () => {
  it('displays traditional characters immediately when charSet is trad', () => {
    localStorage.setItem('charSet', 'trad');
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.getByText('獨一無二')).toBeInTheDocument();
  });
});

describe('Chengyu — answering correctly', () => {
  it('marks the correct option with correct aria-label after clicking it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const correctBtn = screen.getByRole('button', { name: /^unique$/ });
    await user.click(correctBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unique.*correct/i })).toBeInTheDocument();
    });
  });

  it('shows the character breakdown after selecting the correct answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const correctBtn = screen.getByRole('button', { name: /^unique$/ });
    await user.click(correctBtn);

    // Character breakdown aria-label list should appear
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });
  });

  it('displays individual characters in the breakdown after finishing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByText('独')).toBeInTheDocument();
      expect(screen.getByText('一')).toBeInTheDocument();
    });
  });

  it('applies white text color to the revealed correct answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const correctBtn = screen.getByRole('button', { name: /^unique$/ });
    await user.click(correctBtn);

    await waitFor(() => {
      const revealed = screen.getByRole('button', { name: /unique.*correct/i });
      const style = window.getComputedStyle(revealed);
      // MUI resolves 'common.white' to rgb(255, 255, 255)
      expect(style.color).toBe('rgb(255, 255, 255)');
    });
  });

  it('shows the correct answer meaning in the aria-live region after finishing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      // The aria-live region announces the correct answer
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toMatch(/correct/i);
    });
  });
});

describe('Chengyu — answering incorrectly', () => {
  it('marks an incorrect option with incorrect aria-label after clicking it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const wrongBtn = screen.getByRole('button', { name: /to be together forever/ });
    await user.click(wrongBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /to be together forever.*incorrect/i }),
      ).toBeInTheDocument();
    });
  });

  it('does not show the character breakdown after an incorrect answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const wrongBtn = screen.getByRole('button', { name: /to be together forever/ });
    await user.click(wrongBtn);

    // Character breakdown should not appear
    expect(screen.queryByRole('list', { name: /character breakdown/i })).not.toBeInTheDocument();
  });

  it('does not remove correct option after incorrect answer — correct still clickable', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    const wrongBtn = screen.getByRole('button', { name: /to be together forever/ });
    await user.click(wrongBtn);

    // The correct answer should still be present
    expect(screen.getByRole('button', { name: /^unique$/ })).toBeInTheDocument();
  });

  it('can still select the correct answer after a wrong guess', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    // Click wrong first
    await user.click(screen.getByRole('button', { name: /to be together forever/ }));
    // Then click correct
    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });
  });
});

describe('Chengyu — character meanings after completion', () => {
  it('shows pre-loaded character meanings instantly after finishing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByText(/alone; independent/i)).toBeInTheDocument();
      expect(screen.getByText(/one; single/i)).toBeInTheDocument();
      expect(screen.getByText(/not to have; no; none/i)).toBeInTheDocument();
    });
  });
});

describe('Chengyu — example sentence after completion', () => {
  it('displays example sentence after selecting the correct answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByText('这个人真是独一无二的天才。')).toBeInTheDocument();
      expect(screen.getByText('zhè ge rén zhēn shì dú yī wú èr de tiān cái.')).toBeInTheDocument();
      expect(screen.getByText('This person is truly a one-of-a-kind genius.')).toBeInTheDocument();
    });
  });

  it('shows the "Example" label in the sentence block', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByText('Example')).toBeInTheDocument();
    });
  });

  it('does not show example sentence before answering', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });
    expect(screen.queryByText('Example')).not.toBeInTheDocument();
  });

  it('handles sentence fetch failure gracefully', async () => {
    vi.mocked(getChengyuExampleSentence).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    // Should still show the character breakdown without crashing
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });
    // No example sentence block
    expect(screen.queryByText('Example')).not.toBeInTheDocument();
  });

  it('fetches sentence with the correct chengyu string', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(getChengyuExampleSentence).toHaveBeenCalledWith('独一无二', 'simp');
    });
  });
});

describe('Chengyu — persistence of revealed state', () => {
  it('persists revealed state to localStorage when correct answer is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });

    const storedDate = localStorage.getItem('chengyuRevealedDate');
    const today = new Date().toISOString().slice(0, 10);
    expect(storedDate).toBe(today);
  });

  it("starts in revealed state when localStorage has today's date", async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('chengyuRevealedDate', today);

    renderWithProviders(<Chengyu />, { store: makeStore() });

    // Should immediately show the character breakdown without clicking
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });
  });

  it('does not start revealed when localStorage has a past date', () => {
    localStorage.setItem('chengyuRevealedDate', '2020-01-01');

    renderWithProviders(<Chengyu />, { store: makeStore() });

    expect(screen.queryByRole('list', { name: /character breakdown/i })).not.toBeInTheDocument();
  });

  it('does not start revealed when localStorage has no date', () => {
    renderWithProviders(<Chengyu />, { store: makeStore() });

    expect(screen.queryByRole('list', { name: /character breakdown/i })).not.toBeInTheDocument();
  });
});

describe('Chengyu — save to word list', () => {
  it('does not show save button when user is not authenticated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore() });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /character breakdown/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /save to my words/i })).not.toBeInTheDocument();
  });

  it('shows save button after correct answer when authenticated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore({ userId: 'test-user' }) });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save to my words/i })).toBeInTheDocument();
    });
  });

  it('changes button text to "Saved!" after clicking save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chengyu />, { store: makeStore({ userId: 'test-user' }) });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save to my words/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save to my words/i }));

    expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saved!/i })).toBeDisabled();
  });

  it('shows "Already saved" when chengyu is already in word list', async () => {
    const user = userEvent.setup();
    const store = makeStore({
      userId: 'test-user',
      words: [
        { id: 1, simp: '独一无二', trad: '獨一無二', pinyin: 'dú yī wú èr', meaning: 'unique' },
      ],
    });
    renderWithProviders(<Chengyu />, { store });

    await user.click(screen.getByRole('button', { name: /^unique$/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /already saved/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /already saved/i })).toBeDisabled();
  });

  it('does not show save button before answering correctly', () => {
    renderWithProviders(<Chengyu />, { store: makeStore({ userId: 'test-user' }) });

    expect(screen.queryByRole('button', { name: /save to my words/i })).not.toBeInTheDocument();
  });
});
