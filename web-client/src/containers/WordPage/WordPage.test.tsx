/**
 * Tests for the word page at /word/:id (#562). The page renders as the
 * learner sees it. The mocks are at the service layer.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  analytics: null,
}));
vi.mock('../../services/wordService');
vi.mock('../../services/dictionaryService', () => ({
  getEntry: vi.fn(),
  searchWord: vi.fn(),
}));
vi.mock('../../services/sentenceService', () => ({
  getSegmentedSentence: vi.fn(),
}));
vi.mock('../../services/breakdownService', () => ({
  breakdownOf: vi.fn(),
}));
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));
vi.mock('../../services/errorReporting', () => ({
  reportError: vi.fn(),
}));
vi.mock('../../utils/charDataLoader', () => ({
  loadCharData: vi.fn(),
  onCharDataError: vi.fn(),
}));

import React from 'react';
import { Route } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WordPage, { WordPageLocationState } from './WordPage';
import { copy } from '../../copy';
import { authenticatedState, createTestStore, renderWithProviders } from '../../test/utils';
import * as wordService from '../../services/wordService';
import { getEntry, searchWord } from '../../services/dictionaryService';
import { getSegmentedSentence } from '../../services/sentenceService';
import { breakdownOf } from '../../services/breakdownService';
import { loadCharData } from '../../utils/charDataLoader';
import { clearReadingLookups } from '../../components/WordPage/useCharacterReadings';
import { Word } from '../../types/models';
import { makeDirections } from '../../utils/directions';
import { SegmentedSentence } from '../../utils/sentenceUtils';

const mockedWordService = vi.mocked(wordService);
const mockedGetEntry = vi.mocked(getEntry);
const mockedSearchWord = vi.mocked(searchWord);
const mockedSentence = vi.mocked(getSegmentedSentence);
const mockedBreakdownOf = vi.mocked(breakdownOf);

const ymd = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

/** 学习 at level 3, due in 9 days, with a leech on CM and an edited meaning. */
const studied = (overrides: Partial<Word> = {}): Word => {
  const directions = makeDirections(3, ymd(9));
  directions.CM = { level: 2, dueDate: ymd(5), lapses: 9 };
  directions.PC = { level: 2, dueDate: ymd(4), lapses: 2 };
  return {
    id: 101,
    simp: '学习',
    trad: '學習',
    pinyin: 'xue2 xi2',
    meaning: 'to learn/to study',
    level: 3,
    due_date: ymd(4),
    listIds: ['default'],
    directions,
    ...overrides,
  };
};

/** 银行 yín háng, which the learner does not have. */
const BANK: Word = { id: 202, simp: '银行', trad: '銀行', pinyin: 'yin2 hang2', meaning: 'bank' };

/** The dictionary entries of each character, as the exact lookup gives them. */
const LOOKUP: Record<string, Word[]> = {
  學: [{ id: 1, simp: '学', trad: '學', pinyin: 'xue2', meaning: 'to learn/to study' }],
  習: [{ id: 2, simp: '习', trad: '習', pinyin: 'xi2', meaning: 'to practice/habit' }],
  銀: [{ id: 3, simp: '银', trad: '銀', pinyin: 'yin2', meaning: 'silver' }],
  行: [
    { id: 4, simp: '行', trad: '行', pinyin: 'xing2', meaning: 'to walk/to go' },
    { id: 5, simp: '行', trad: '行', pinyin: 'hang2', meaning: 'row/line/profession' },
  ],
  銀行: [BANK],
  學習: [studied()],
};

const sentenceOf = (target: string): SegmentedSentence => ({
  id: 's1',
  chinese: {
    sentence: `我${target}`,
    simplified: `我${target}`,
    highlight: [],
    segments: [
      { s: '我', t: '我', p: 'wǒ', e: 'I' },
      { s: target, t: target, p: '', e: '' },
    ],
    targetIndex: 1,
  },
  english: { sentence: 'I study.', highlight: [] },
});

const renderPage = (
  id: number,
  { words = [] as Word[], state }: { words?: Word[]; state?: WordPageLocationState } = {},
) => {
  window.history.pushState({ key: 'test', state }, '', `/word/${id}`);
  const preloaded = authenticatedState();
  const store = createTestStore({
    ...preloaded,
    addWords: { ...preloaded.addWords!, words },
  });
  return renderWithProviders(
    <Route path="/word/:id">
      <WordPage />
    </Route>,
    { store },
  );
};

describe('WordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearReadingLookups();
    localStorage.setItem('charSet', 'trad');
    mockedSearchWord.mockImplementation(async (text: string) => LOOKUP[text] ?? []);
    mockedSentence.mockImplementation(async (word: string) => ({
      sentence: sentenceOf(word),
      totalCount: 2,
    }));
    mockedBreakdownOf.mockImplementation(async (char: string) => ({ c: char, p: null }));
    vi.mocked(loadCharData).mockImplementation(() => undefined);
    mockedWordService.getUserWord.mockResolvedValue(null);
    mockedWordService.addWordToList.mockResolvedValue(null);
  });

  it('shows a word of the learner, its sentence and its progress, with no dictionary entry call', async () => {
    const user = userEvent.setup();
    renderPage(101, { words: [studied()] });

    expect(screen.getByRole('heading', { name: '學習' })).toBeInTheDocument();
    expect(screen.getByText('xué xí')).toBeInTheDocument();
    const senses = screen.getByRole('list', { name: copy.wordPage.meaningTab });
    expect(
      within(senses)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['to learn', 'to study']);
    expect(await screen.findByTestId('word-sentence')).toHaveTextContent('I study.');
    expect(
      screen.getByRole('button', { name: copy.wordPage.openCharacter('學') }),
    ).toHaveTextContent('xué');
    expect(screen.queryByRole('button', { name: copy.wordPage.add })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: copy.wordPage.progressTab }));
    expect(screen.getAllByText('Familiar').length).toBeGreaterThan(0);
    expect(screen.getByText(copy.wordPage.next('Due in 4 days'))).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(mockedGetEntry).not.toHaveBeenCalled();
    expect(mockedWordService.getUserWord).not.toHaveBeenCalled();
  });

  it('flags a leech direction with "Hard to recall"', async () => {
    const user = userEvent.setup();
    renderPage(101, { words: [studied()] });

    await user.click(screen.getByRole('tab', { name: copy.wordPage.progressTab }));

    expect(
      within(screen.getByTestId('direction-CM')).getByText(copy.wordBank.leech),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('direction-CM')).getByText(copy.wordPage.lapses(9)),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('direction-PC')).queryByText(copy.wordBank.leech)).toBeNull();
  });

  it('reads the word from another list when the store does not hold it', async () => {
    mockedWordService.getUserWord.mockResolvedValue(studied());
    renderPage(101);

    expect(await screen.findByRole('tab', { name: copy.wordPage.progressTab })).toBeInTheDocument();
    expect(mockedGetEntry).not.toHaveBeenCalled();
  });

  it('shows Add and no progress for an entry that the learner does not have', async () => {
    renderPage(202, { state: { entry: BANK } });

    expect(await screen.findByRole('heading', { name: '銀行' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.wordPage.add })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: copy.wordPage.progressTab })).not.toBeInTheDocument();
    expect(mockedGetEntry).not.toHaveBeenCalled();
  });

  it('gives each character the reading of the word: 行 in 银行 reads háng', async () => {
    renderPage(202, { state: { entry: BANK } });

    const row = await screen.findByRole('button', { name: copy.wordPage.openCharacter('行') });
    await waitFor(() => expect(row).toHaveTextContent('háng'));
    expect(row).toHaveTextContent('row · line · profession');
  });

  it('adds the word to the active list, then shows its progress', async () => {
    const user = userEvent.setup();
    renderPage(202, { state: { entry: BANK } });

    await user.click(await screen.findByRole('button', { name: copy.wordPage.add }));

    expect(mockedWordService.addWordToList).toHaveBeenCalledWith('test-user-123', BANK, 'default');
    expect(await screen.findByRole('tab', { name: copy.wordPage.progressTab })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.wordPage.add })).not.toBeInTheDocument();
  });

  it('loads the entry again after a reload, with no router state', async () => {
    mockedGetEntry.mockResolvedValue(BANK);
    renderPage(202);

    expect(await screen.findByRole('heading', { name: '銀行' })).toBeInTheDocument();
    expect(mockedGetEntry).toHaveBeenCalledWith(202);
  });

  it('shows an error with a retry when the entry does not load', async () => {
    const user = userEvent.setup();
    mockedGetEntry.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(BANK);
    renderPage(202);

    await user.click(await screen.findByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByRole('heading', { name: '銀行' })).toBeInTheDocument();
  });

  it('opens covered from search when the word is due soon, and one tap shows it', async () => {
    const user = userEvent.setup();
    mockedBreakdownOf.mockImplementation(async (char: string) => ({
      c: char,
      p: [{ c: '子', s: [0, 1, 2], l: 'child' }],
      o: { t: ['Children ', { c: '子', s: [0, 1, 2] }, ' study'] },
    }));
    renderPage(101, { words: [studied({ due_date: ymd(0) })] });

    expect(screen.queryByRole('heading', { name: '學習' })).not.toBeInTheDocument();
    expect(screen.queryByText('to learn')).not.toBeInTheDocument();
    // The origin gives the meaning away, so it stays under the cover too.
    expect(screen.queryByTestId('origin')).not.toBeInTheDocument();
    expect(screen.getByText(copy.wordBank.dueSoon)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(copy.wordBank.showWord) }));

    expect(screen.getByRole('heading', { name: '學習' })).toBeInTheDocument();
  });

  it('opens uncovered when the word row passes the "shown" flag', () => {
    renderPage(101, { words: [studied({ due_date: ymd(0) })], state: { shown: true } });

    expect(screen.getByRole('heading', { name: '學習' })).toBeInTheDocument();
  });

  it('shows the edited meaning above the dictionary senses', () => {
    renderPage(101, { words: [studied({ ammended_meaning: 'to study (a subject)' })] });

    expect(screen.getByTestId('own-meaning')).toHaveTextContent('to study (a subject)');
  });

  it('shows the meaning of a custom word under the "Own word" tag', async () => {
    const custom = studied({
      id: -3,
      simp: '老铁',
      trad: '老鐵',
      pinyin: 'lao3 tie3',
      meaning: 'close friend (slang)',
    });
    renderPage(-3, { words: [custom] });

    expect(screen.getByText(copy.wordPage.ownWord)).toBeInTheDocument();
    expect(screen.getByTestId('own-meaning')).toHaveTextContent('close friend (slang)');
    expect(screen.queryByRole('list', { name: copy.wordPage.meaningTab })).not.toBeInTheDocument();
    expect(mockedSentence).not.toHaveBeenCalled();
  });

  it('has no sentence for a word with none', async () => {
    mockedSentence.mockResolvedValue({ sentence: null, totalCount: 0 });
    renderPage(101, { words: [studied()] });

    await waitFor(() => expect(mockedSentence).toHaveBeenCalled());
    expect(screen.queryByTestId('word-sentence')).not.toBeInTheDocument();
  });

  it('switches the whole page to the other character set', async () => {
    const user = userEvent.setup();
    renderPage(101, { words: [studied()] });

    await user.click(screen.getByRole('radio', { name: copy.wordPage.simplified }));

    expect(screen.getByRole('heading', { name: '学习' })).toBeInTheDocument();
  });

  it('opens a character from the table in the Characters tab, with no block for a non-hanzi', async () => {
    const user = userEvent.setup();
    const karaoke = studied({ id: 303, simp: '卡拉OK', trad: '卡拉OK', pinyin: 'ka3 la1 O K' });
    renderPage(303, { words: [karaoke] });

    await user.click(screen.getByRole('button', { name: copy.wordPage.openCharacter('拉') }));

    expect(screen.getByRole('tab', { name: copy.wordPage.charactersTab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('radio', { name: '拉' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      '卡',
      '拉',
    ]);
    expect(await screen.findByTestId('character-panel-拉')).toBeInTheDocument();
    // A character with no breakdown shows no switch and no placeholder.
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
