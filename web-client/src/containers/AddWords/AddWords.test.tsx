/**
 * Tests for the word bank on /add-words: one search field that filters the
 * bank and asks the dictionary, the list chips, and the word rows.
 * Firebase is mocked at the service layer (not the Firebase SDK).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  analytics: null,
}));
vi.mock('../../services/wordService');
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));
vi.mock('../../services/streakService', () => ({
  recordTestCompletion: vi.fn(),
  getStreakData: vi.fn().mockResolvedValue([]),
  calculateStreak: vi.fn().mockReturnValue(0),
}));

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AddWords from './AddWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordService from '../../services/wordService';
import * as ttsService from '../../services/ttsService';
import { Word, WordList } from '../../types/models';
import { ListStats } from '../../types/store';
import { makeDirections } from '../../utils/directions';

const mockedWordService = vi.mocked(wordService);

const ymd = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

let nextId = 1;
const word = (
  simp: string,
  pinyin: string,
  meaning: string,
  level: number,
  dueIn: number,
  listIds = ['default'],
): Word => ({
  id: nextId++,
  simp,
  trad: simp,
  pinyin,
  meaning,
  level,
  due_date: ymd(dueIn),
  listIds,
  directions: makeDirections(level, ymd(dueIn)),
});

const LISTS: WordList[] = [
  { id: 'default', name: 'General', createdAt: '', order: 0 },
  { id: 'hsk3', name: 'HSK 3', createdAt: '', order: 1 },
];

const farWord = word('附近', 'fù jìn', 'nearby', 3, 9);
const dueWord = word('认识', 'rèn shi', 'to know', 2, 0);
const newWord = word('天气', 'tiān qì', 'weather', 1, 0);

/** Render the bank with the words the service returns for the active list. */
function renderBank(
  words: Word[] = [farWord],
  stats: Record<string, ListStats> = {
    default: { due: 1, total: words.length },
    __all__: { due: 1, total: words.length },
  },
) {
  mockedWordService.getUserWords.mockResolvedValue(words);
  mockedWordService.getListStats.mockResolvedValue(stats);
  const store = createTestStore({ ...authenticatedState() });
  renderWithProviders(<AddWords />, { store });
  return store;
}

const searchFor = async (text: string) => {
  const input = screen.getByRole('textbox', { name: 'Search a Chinese word' });
  await userEvent.clear(input);
  await userEvent.type(input, `${text}{enter}`);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedWordService.getUserWordLists.mockResolvedValue(LISTS);
  mockedWordService.searchWord.mockResolvedValue([]);
  mockedWordService.addWordToList.mockResolvedValue(null);
  mockedWordService.removeWordFromList.mockResolvedValue(true);
  mockedWordService.setListsOfWord.mockResolvedValue(undefined);
});

describe('AddWords — the word rows', () => {
  it('shows a word that is not due soon', async () => {
    renderBank([farWord]);
    expect(await screen.findByText('附近')).toBeInTheDocument();
    expect(screen.getByText('fù jìn')).toBeInTheDocument();
    expect(screen.getByText('nearby')).toBeInTheDocument();
  });

  it('heads the list with its name and word count', async () => {
    renderBank([farWord, newWord]);
    expect(await screen.findByRole('heading', { name: 'General · 2 words' })).toBeInTheDocument();
  });

  it('covers a word due soon until the learner taps it', async () => {
    renderBank([dueWord]);
    const cover = await screen.findByRole('button', { name: 'Due soon. Show the word' });
    expect(screen.queryByText('认识')).not.toBeInTheDocument();
    expect(screen.queryByText('to know')).not.toBeInTheDocument();

    await userEvent.click(cover);
    expect(screen.getByText('认识')).toBeInTheDocument();
    expect(screen.getByText('to know')).toBeInTheDocument();
  });

  it('never covers a new word', async () => {
    renderBank([newWord]);
    expect(await screen.findByText('天气')).toBeInTheDocument();
  });

  it('flags a leech, and names its directions when opened', async () => {
    const leech = word('已经', 'yǐ jīng', 'already', 3, 5);
    leech.directions!.MC = { ...leech.directions!.MC, lapses: 9 };
    renderBank([leech]);

    expect(await screen.findByText('Hard to recall')).toBeInTheDocument();
    await userEvent.click(screen.getByText('已经'));
    expect(screen.getByText('Hard to recall: Character → Meaning')).toBeInTheDocument();
  });

  it('opens a row to play the word and to put it into a second list', async () => {
    renderBank([farWord]);
    await userEvent.click(await screen.findByText('附近'));

    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(ttsService.speak).toHaveBeenCalledWith('附近', expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lists for 附近' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'HSK 3' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockedWordService.setListsOfWord).toHaveBeenCalledWith('test-user-123', farWord.id, [
        'default',
        'hsk3',
      ]),
    );
  });

  it('does not let the learner clear the last list of a word', async () => {
    renderBank([farWord]);
    await userEvent.click(await screen.findByText('附近'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lists for 附近' });
    expect(within(dialog).getByRole('checkbox', { name: 'General' })).toBeDisabled();
  });

  it('asks before it deletes a word that no other list holds', async () => {
    renderBank([farWord]);
    await userEvent.click(await screen.findByText('附近'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mockedWordService.removeWordFromList).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', { name: 'Delete 附近?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mockedWordService.removeWordFromList).toHaveBeenCalledWith(
        'test-user-123',
        farWord.id,
        'default',
      ),
    );
  });

  it('takes a word in two lists out of the active list without asking', async () => {
    const shared = word('朋友', 'péng you', 'friend', 3, 9, ['default', 'hsk3']);
    mockedWordService.removeWordFromList.mockResolvedValue(false);
    renderBank([shared]);
    await userEvent.click(await screen.findByText('朋友'));

    expect(screen.getByText('General, HSK 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from General' }));
    await waitFor(() =>
      expect(mockedWordService.removeWordFromList).toHaveBeenCalledWith(
        'test-user-123',
        shared.id,
        'default',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AddWords — the search', () => {
  const hao = word('好', 'hǎo', 'good; well', 1, 0);
  const hao4 = word('好', 'hào', 'to be fond of', 1, 0);

  it('lists the dictionary entries, with an Add button on each', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockResolvedValue([hao, hao4]);

    await searchFor('好');
    expect(await screen.findByRole('button', { name: 'Add 好, hǎo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 好, hào' })).toBeInTheDocument();
    // The results take the place of the word list.
    expect(screen.queryByText('附近')).not.toBeInTheDocument();
  });

  it('adds an entry in one tap and marks it Added', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockResolvedValue([hao, hao4]);

    await searchFor('好');
    await userEvent.click(await screen.findByRole('button', { name: 'Add 好, hǎo' }));

    await waitFor(() =>
      expect(mockedWordService.addWordToList).toHaveBeenCalledWith('test-user-123', hao, 'default'),
    );
    expect(await screen.findByText('Added')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 好, hào' })).toBeInTheDocument();
    expect(screen.getByText('In your bank')).toBeInTheDocument();
  });

  it('marks an entry the bank already holds as Added', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockResolvedValue([{ ...farWord, id: 999 }]);

    await searchFor('附近');
    expect(await screen.findByText('Added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add 附近/ })).not.toBeInTheDocument();
  });

  it('keeps a word due soon covered when the search finds it', async () => {
    renderBank([dueWord]);
    await screen.findByRole('button', { name: 'Due soon. Show the word' });
    mockedWordService.searchWord.mockResolvedValue([{ ...dueWord, id: 999 }]);

    await searchFor('认识');
    expect(await screen.findByText('Added')).toBeInTheDocument();
    expect(screen.queryByText('rèn shi')).not.toBeInTheDocument();
    expect(screen.queryByText('to know')).not.toBeInTheDocument();
  });

  it('does not find a word due soon by its meaning', async () => {
    renderBank([dueWord, farWord]);
    await screen.findByText('附近');

    await searchFor('know');
    expect(screen.queryByText('In your bank')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Due soon. Show the word' }),
    ).not.toBeInTheDocument();
  });

  it('says No match, with no own-word form, when a search in pinyin or English finds nothing', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');

    await searchFor('zzz');
    expect(await screen.findByText('No match')).toBeInTheDocument();
    expect(mockedWordService.searchWord).toHaveBeenCalledWith('zzz', 'trad');
    expect(screen.queryByText(/No entry for/)).not.toBeInTheDocument();
  });

  it('asks the dictionary for a search in pinyin or English', async () => {
    const hao = word('好', 'hǎo', 'good; well', 1, 9);
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockResolvedValue([hao]);

    await searchFor('hao');
    expect(await screen.findByRole('button', { name: 'Add 好, hǎo' })).toBeInTheDocument();
  });

  it('filters the bank only for one Latin letter', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');

    await searchFor('f');
    expect(await screen.findByText('In your bank')).toBeInTheDocument();
    expect(mockedWordService.searchWord).not.toHaveBeenCalled();
  });

  it('focuses the search field on Ctrl+B', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(screen.getByRole('textbox', { name: 'Search a Chinese word' })).toHaveFocus();
  });

  it('shows the bank words that match under "In your bank"', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');

    await searchFor('附');
    expect(await screen.findByText('In your bank')).toBeInTheDocument();
    expect(screen.getByText('附近')).toBeInTheDocument();
  });

  it('offers a meaning field when the dictionary has no entry', async () => {
    mockedWordService.addCustomWord.mockResolvedValue(word('囧', '', 'awkward', 1, 0));
    renderBank([farWord]);
    await screen.findByText('附近');

    await searchFor('囧');
    expect(await screen.findByText(/No entry for/)).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', { name: 'Add as your own word' }), 'awkward');
    await userEvent.click(add);
    await waitFor(() =>
      expect(mockedWordService.addCustomWord).toHaveBeenCalledWith(
        'test-user-123',
        '囧',
        'awkward',
        expect.any(String),
        'default',
      ),
    );
  });

  it('says the search failed and retries it', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockRejectedValue(new Error('offline'));

    await searchFor('好');
    expect(await screen.findByText('Search failed')).toBeInTheDocument();

    mockedWordService.searchWord.mockResolvedValue([hao]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Add 好, hǎo' })).toBeInTheDocument();
  });

  it('clears the search and brings the list back', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    mockedWordService.searchWord.mockResolvedValue([hao]);

    await searchFor('好');
    await screen.findByRole('button', { name: 'Add 好, hǎo' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('textbox', { name: 'Search a Chinese word' })).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'General · 1 word' })).toBeInTheDocument();
  });
});

describe('AddWords — the lists', () => {
  it('shows a chip for each list, with its word count', async () => {
    // farWord is in both lists, so All lists counts it one time.
    renderBank([farWord], {
      default: { due: 0, total: 1 },
      hsk3: { due: 2, total: 5 },
      __all__: { due: 2, total: 5 },
    });
    const tabs = await screen.findByRole('tablist', { name: 'Lists' });
    await waitFor(() =>
      expect(within(tabs).getByRole('tab', { name: 'HSK 3 5' })).toBeInTheDocument(),
    );
    expect(within(tabs).getByRole('tab', { name: 'All lists 5' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'General 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches the list on a tap of its chip', async () => {
    renderBank([farWord]);
    await userEvent.click(await screen.findByRole('tab', { name: /HSK 3/ }));
    await waitFor(() =>
      expect(mockedWordService.getUserWords).toHaveBeenCalledWith('test-user-123', 'hsk3'),
    );
  });

  it('creates a list', async () => {
    mockedWordService.createWordList.mockResolvedValue({
      id: 'food',
      name: 'Food',
      createdAt: '',
      order: 2,
    });
    renderBank([farWord]);
    await userEvent.click(await screen.findByRole('button', { name: 'New list' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'List name' }), 'Food');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(mockedWordService.createWordList).toHaveBeenCalledWith('test-user-123', 'Food'),
    );
  });

  it('has no list menu on General', async () => {
    renderBank([farWord]);
    await screen.findByText('附近');
    expect(screen.queryByRole('button', { name: 'List actions' })).not.toBeInTheDocument();
  });

  it('renames and deletes a list from its menu', async () => {
    mockedWordService.renameWordList.mockResolvedValue(undefined);
    mockedWordService.deleteWordList.mockResolvedValue(undefined);
    const hskWord = word('检查', 'jiǎn chá', 'to check', 4, 30, ['hsk3']);
    const shared = word('朋友', 'péng you', 'friend', 3, 9, ['default', 'hsk3']);
    renderBank([hskWord, shared]);
    await userEvent.click(await screen.findByRole('tab', { name: /HSK 3/ }));

    await userEvent.click(await screen.findByRole('button', { name: 'List actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const name = screen.getByRole('textbox', { name: 'List name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'HSK 4');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockedWordService.renameWordList).toHaveBeenCalledWith(
        'test-user-123',
        'hsk3',
        'HSK 4',
      ),
    );

    // The rename dialog hides the page until its exit transition ends.
    await userEvent.click(await screen.findByRole('button', { name: 'List actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    // The shared word stays in General, so the delete counts one word.
    expect(screen.getByText('Deletes 1 word.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mockedWordService.deleteWordList).toHaveBeenCalledWith('test-user-123', 'hsk3'),
    );
  });
});

describe('AddWords — empty, loading and error', () => {
  it('says there are no words yet, and a suggestion searches for itself', async () => {
    renderBank([], {});
    expect(await screen.findByText('No words yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '你好' }));
    await waitFor(() => expect(mockedWordService.searchWord).toHaveBeenCalledWith('你好', 'trad'));
  });

  it('says a list is empty when other lists hold words', async () => {
    renderBank([], {
      default: { due: 0, total: 0 },
      hsk3: { due: 0, total: 4 },
      __all__: { due: 0, total: 4 },
    });
    expect(await screen.findByText('This list is empty')).toBeInTheDocument();
  });

  it('says the words did not load, and retries', async () => {
    mockedWordService.getUserWords.mockRejectedValueOnce(new Error('offline'));
    mockedWordService.getListStats.mockResolvedValue({});
    const store = createTestStore({ ...authenticatedState() });
    mockedWordService.getUserWords.mockResolvedValue([farWord]);
    renderWithProviders(<AddWords />, { store });

    expect(await screen.findByText('Your words didn’t load')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('附近')).toBeInTheDocument();
  });

  it('shows a spinner while auth is initializing', () => {
    const store = createTestStore({
      ...authenticatedState(),
      auth: {
        userId: null,
        loading: false,
        error: null,
        newSignUp: false,
        initialized: false,
        modalOpen: false,
        modalMode: 'login' as const,
      },
    });
    renderWithProviders(<AddWords />, { store });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
