/**
 * Tests for the Premade lists tab: the catalogue, one list with its words, the
 * words the learner has, the cover on a held word that is due soon, and Add.
 * Firebase is mocked at the service layer (not the Firebase SDK).
 */
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  analytics: null,
}));
vi.mock('../../services/wordService');
vi.mock('../../services/premadeListService', () => ({
  loadCatalogue: vi.fn(),
  loadPremadeEntries: vi.fn(),
}));

import React from 'react';
import { Route } from 'react-router-dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PremadeList from './PremadeList';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import * as wordService from '../../services/wordService';
import * as premadeListService from '../../services/premadeListService';
import { Word } from '../../types/models';
import { makeDirections } from '../../utils/directions';

const ymd = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const entry = (id: number, simp: string, pinyin: string, meaning: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning,
});

const held = (e: Word, dueIn: number): Word => ({
  ...e,
  level: 3,
  due_date: ymd(dueIn),
  directions: makeDirections(3, ymd(dueIn)),
});

const LIST = { id: 'hsk-1', name: 'HSK 1', size: 3 };
const LIST_2 = { id: 'hsk-2', name: 'HSK 2', size: 1 };
const ai = entry(1, '爱', 'ai4', 'to love');
const ba = entry(2, '八', 'ba1', 'eight');
const baba = entry(3, '爸爸', 'ba4 ba5', 'father');
const ENTRIES = [ai, ba, baba];
const ENTRIES_2 = [entry(4, '帮助', 'bang1 zhu4', 'to help')];

function renderPage(heldWords: Word[], path = '/add-words/premade/hsk-1') {
  vi.mocked(wordService.getHeldWords).mockResolvedValue(heldWords);
  localStorage.setItem('charSet', 'simp');
  window.history.pushState({}, '', path);
  renderWithProviders(
    <Route path="/add-words/premade/:listId?">
      <PremadeList />
    </Route>,
    { store: createTestStore({ ...authenticatedState() }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(premadeListService.loadCatalogue).mockResolvedValue([LIST, LIST_2]);
  vi.mocked(premadeListService.loadPremadeEntries).mockImplementation(async (id) =>
    id === 'hsk-1' ? ENTRIES : ENTRIES_2,
  );
});

describe('PremadeList — the catalogue', () => {
  it('lists each premade list with its size and the words the learner has', async () => {
    renderPage([held(ba, 20)], '/add-words/premade');

    expect(await screen.findByRole('button', { name: /HSK 1.*3 words · 2 new/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /HSK 2.*1 words$/ })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Premade lists' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens a list on a tap', async () => {
    renderPage([], '/add-words/premade');

    await userEvent.click(await screen.findByRole('button', { name: /HSK 2/ }));

    expect(window.location.pathname).toBe('/add-words/premade/hsk-2');
    expect(await screen.findByRole('tab', { name: 'HSK 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('帮助')).toBeInTheDocument();
  });
});

describe('PremadeList — one list', () => {
  it('shows the words of the list before the learner adds it', async () => {
    renderPage([]);

    expect(await screen.findByRole('tab', { name: 'HSK 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const words = screen.getByRole('list', { name: 'Words' });
    expect(within(words).getAllByRole('listitem')).toHaveLength(3);
    expect(within(words).getByText('爸爸')).toBeInTheDocument();
    expect(within(words).getByText('father')).toBeInTheDocument();
    expect(screen.getByText('new words')).toBeInTheDocument();
  });

  it('marks the words the learner has, and filters by them', async () => {
    renderPage([held(ba, 20)]);

    const words = await screen.findByRole('list', { name: 'Words' });
    const row = within(words).getByText('八').closest('li')!;
    expect(within(row).getByText('Added')).toBeInTheDocument();
    expect(within(row).getByText('eight')).toBeInTheDocument();
    expect(screen.getByText('new words · 1 added')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New 2' }));
    expect(
      within(screen.getByRole('list', { name: 'Words' })).getAllByRole('listitem'),
    ).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Added 1' }));
    const added = within(screen.getByRole('list', { name: 'Words' })).getAllByRole('listitem');
    expect(added).toHaveLength(1);
    expect(within(added[0]).getByText('八')).toBeInTheDocument();
  });

  it('covers the pinyin and meaning of a held word that is due soon', async () => {
    renderPage([held(ai, 0)]);

    const words = await screen.findByRole('list', { name: 'Words' });
    expect(within(words).getByText('爱')).toBeInTheDocument();
    expect(within(words).queryByText('ai4')).not.toBeInTheDocument();
    expect(within(words).queryByText('to love')).not.toBeInTheDocument();
  });

  it('adds the list with its words', async () => {
    vi.mocked(wordService.addPremadeList).mockRejectedValue(new Error('offline'));
    renderPage([]);

    await userEvent.click(await screen.findByRole('button', { name: 'Add list' }));

    expect(wordService.addPremadeList).toHaveBeenCalledWith('test-user-123', 'HSK 1', ENTRIES);
  });

  it('has no Add when the learner has every word', async () => {
    renderPage(ENTRIES.map((e) => held(e, 20)));

    expect(await screen.findByRole('button', { name: 'Add list' })).toBeDisabled();
  });

  it('switches to another list on a tap of its chip', async () => {
    renderPage([]);

    await userEvent.click(await screen.findByRole('tab', { name: 'HSK 2' }));

    expect(window.location.pathname).toBe('/add-words/premade/hsk-2');
    expect(await screen.findByText('帮助')).toBeInTheDocument();
  });

  it('goes back to the catalogue', async () => {
    renderPage([]);

    await userEvent.click(await screen.findByRole('button', { name: 'All lists' }));

    expect(window.location.pathname).toBe('/add-words/premade');
  });

  it('offers a retry when the list does not load', async () => {
    vi.mocked(premadeListService.loadPremadeEntries).mockRejectedValueOnce(new Error('offline'));
    renderPage([]);

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('list', { name: 'Words' })).toBeInTheDocument();
  });
});
