import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import Dashboard from './Dashboard';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/dashboardService', () => ({
  getDashboardStats: vi.fn(),
  getHskCoverage: vi.fn(),
}));
vi.mock('../../services/wordService', () => ({
  getUserWordLists: vi.fn(),
  getListStats: vi.fn(),
}));

// The chengyu card reads local data and an AI sentence; it is not under test here.
vi.mock('./widgets/ChengyuCard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'chengyu-mock' }),
}));

import { getDashboardStats, getHskCoverage } from '../../services/dashboardService';
import { getUserWordLists, getListStats } from '../../services/wordService';
const mockGetDashboardStats = getDashboardStats as ReturnType<typeof vi.fn>;
const mockGetHskCoverage = getHskCoverage as ReturnType<typeof vi.fn>;
const mockGetUserWordLists = getUserWordLists as ReturnType<typeof vi.fn>;
const mockGetListStats = getListStats as ReturnType<typeof vi.fn>;

const sampleLists = [
  { id: 'default', name: 'General', createdAt: '', order: 0 },
  { id: 'hsk3', name: 'HSK 3', createdAt: '', order: 1 },
];

const sampleStats = {
  totalWords: 50,
  dueWords: 12,
  streak: 5,
  levelDistribution: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 },
  directionDistribution: {
    MC: { 1: 5, 2: 5, 3: 10, 4: 10, 5: 20 },
    MP: { 1: 5, 2: 10, 3: 10, 4: 10, 5: 15 },
    PM: { 1: 10, 2: 10, 3: 15, 4: 5, 5: 10 },
    PC: { 1: 10, 2: 10, 3: 15, 4: 5, 5: 10 },
    CM: { 1: 40, 2: 5, 3: 5, 4: 0, 5: 0 },
  },
  masteredCount: 10,
  estimatedStudyTime: '~6 min',
  sessionSizes: {
    quick: { questions: 10, newWords: 1, time: '~3 min' },
    usual: { questions: 20, newWords: 3, time: '~6 min' },
    all: { questions: 34, newWords: 5, time: '~10 min' },
  },
  forecast: [12, 4, 0, 7],
  history: [],
};

describe('Dashboard container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserWordLists.mockResolvedValue(sampleLists);
    mockGetListStats.mockResolvedValue({ default: { due: 3, total: 20 } });
    mockGetHskCoverage.mockResolvedValue(null);
  });

  it('shows a spinner while loading', () => {
    mockGetDashboardStats.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('loads the word lists so the list selector can render', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState('uid-lists')),
    });
    await waitFor(() => expect(mockGetUserWordLists).toHaveBeenCalledWith('uid-lists'));
    expect(mockGetListStats).toHaveBeenCalledWith('uid-lists');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'List: General' })).toBeInTheDocument(),
    );
  });

  it('keeps the heading and list selector visible while the stats load', async () => {
    mockGetDashboardStats.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'List: General' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('shows the spinner again while stats reload for another list', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    const store = createTestStore({
      ...authenticatedState(),
      addWords: { ...authenticatedState().addWords, lists: sampleLists },
    });
    renderWithProviders(<Dashboard />, { store });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Study' })).toBeInTheDocument());

    let resolveSecondLoad: (value: typeof sampleStats) => void = () => {};
    mockGetDashboardStats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondLoad = resolve;
        }),
    );
    store.dispatch({ type: 'SET_ACTIVE_LIST', listId: 'hsk3' });

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^List:/ })).toBeInTheDocument();

    resolveSecondLoad(sampleStats);
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument(),
    );
    expect(mockGetDashboardStats).toHaveBeenLastCalledWith('test-user-123', 'hsk3');
  });

  it('renders the heading and the session sizes after a successful load', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument(),
    );
    expect(await screen.findByRole('button', { name: /Usual/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('20 questions')).toBeInTheDocument();
    expect(screen.getByText('Includes 3 new words')).toBeInTheDocument();
  });

  it('calls getDashboardStats with the correct userId', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState('uid-xyz')),
    });
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledWith('uid-xyz', 'default'));
  });

  it('passes undefined instead of the __all__ sentinel so stats cover every list', async () => {
    // Regression (#297): '__all__' is a virtual list id. Passing it straight through
    // made Firestore query listId == '__all__', which matches no words, so the
    // dashboard reported 0 due and 0 total while a single list showed the real count.
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    const baseState = authenticatedState('uid-all');
    const allListsState = {
      ...baseState,
      addWords: {
        ...baseState.addWords,
        lists: [
          { id: 'default', name: 'General', createdAt: '', order: 0 },
          { id: 'puerh', name: 'Puerh book', createdAt: '', order: 1 },
        ],
        activeListId: '__all__',
      },
    };
    renderWithProviders(<Dashboard />, {
      store: createTestStore(allListsState),
    });
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledWith('uid-all', undefined));
  });

  it('shows an error message when the stats load fails', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('offline'));
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load"));
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('retries loading when "Try again" is clicked and shows stats on success', async () => {
    const user = userEvent.setup();
    mockGetDashboardStats
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(sampleStats);

    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });

    await waitFor(() => expect(screen.getByText(/try again/i)).toBeInTheDocument());
    await user.click(screen.getByText(/try again/i));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Study' })).toBeInTheDocument());
    expect(mockGetDashboardStats).toHaveBeenCalledTimes(2);
  });

  it('does not call getDashboardStats when userId is null', async () => {
    const unauthState = {
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
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    };
    renderWithProviders(<Dashboard />, {
      store: createTestStore(unauthState),
    });
    await waitFor(() => expect(mockGetDashboardStats).not.toHaveBeenCalled());
  });

  it('loading resolves (not stuck) when userId is null — regression', async () => {
    // Regression: loadStats previously returned early without calling setLoading(false),
    // so a retry triggered while unauthenticated would leave the spinner showing forever.
    // After the fix, loading becomes false even when userId is null, so the
    // Dashboard heading (not the spinner) is eventually rendered.
    const unauthState = {
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
        lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
        activeListId: 'default',
        words: [],
        listStats: {},
        error: false,
        loading: false,
      },
      settings: { speechAvailable: false, synthAvailable: false },
    };
    renderWithProviders(<Dashboard />, {
      store: createTestStore(unauthState),
    });
    // The spinner disappears once loading resolves to false.
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(mockGetDashboardStats).not.toHaveBeenCalled();
  });

  it('offers the three sizes of session and starts the chosen one', async () => {
    const user = userEvent.setup();
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    window.history.pushState({}, '', '/');
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });

    await user.click(await screen.findByRole('button', { name: /Quick/ }));
    await user.click(screen.getByRole('button', { name: 'Study' }));

    expect(window.location.pathname).toBe('/test-words');
    // BrowserRouter keeps the route state under `state` in the history entry.
    expect(window.history.state.state).toEqual({ size: 'quick' });
  });

  it('offers to add words when the list has none', async () => {
    mockGetDashboardStats.mockResolvedValue({ ...sampleStats, totalWords: 0, dueWords: 0 });
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });

    expect(await screen.findByRole('button', { name: 'Add words' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Study' })).not.toBeInTheDocument();
  });

  describe('HSK coverage card', () => {
    const levels = { 1: 2, 2: 1, 3: 0, 4: 0, 5: 1 };
    const coverage = ['1', '2', '3', '4', '5', '6', '7-9'].map((n) => ({
      listId: `hsk-${n}`,
      name: `HSK ${n.replace('-', '–')}`,
      total: 100,
      notAdded: 96,
      levels,
    }));

    it('shows one row for each HSK level below the Progress card, for the whole collection', async () => {
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockResolvedValue(coverage);
      renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState('uid-hsk')),
      });

      const card = await screen.findByRole('region', { name: 'HSK coverage' });
      expect(within(card).getAllByRole('button')).toHaveLength(7);
      expect(within(card).getAllByText('4 of 100')).toHaveLength(7);
      expect(mockGetHskCoverage).toHaveBeenCalledWith('uid-hsk');
      const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(headings.indexOf('HSK coverage')).toBe(headings.indexOf('Progress') + 1);
    });

    it('keeps loading the card when the learner switches lists before it is in', async () => {
      let resolve: (value: typeof coverage) => void = () => {};
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockImplementation(() => new Promise((r) => (resolve = r)));
      const { store } = renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState()),
      });

      await screen.findByRole('button', { name: 'Study' });
      await waitFor(() => expect(mockGetHskCoverage).toHaveBeenCalled());
      act(() => {
        store.dispatch({ type: 'SET_ACTIVE_LIST', listId: 'hsk3' });
      });
      await screen.findByRole('button', { name: 'Study' });
      await act(async () => resolve(coverage));

      expect(await screen.findByRole('region', { name: 'HSK coverage' })).toBeInTheDocument();
      expect(mockGetDashboardStats).toHaveBeenLastCalledWith('test-user-123', 'hsk3');
    });

    it('opens the premade list of a row', async () => {
      const user = userEvent.setup();
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockResolvedValue(coverage);
      window.history.pushState({}, '', '/');
      renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState()),
      });

      await user.click(await screen.findByRole('button', { name: /^HSK 3,/ }));
      expect(window.location.pathname).toBe('/add-words/premade/hsk-3');
    });

    it('is hidden when the collection is empty', async () => {
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockResolvedValue(null);
      renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState()),
      });

      await screen.findByRole('button', { name: 'Study' });
      await waitFor(() => expect(mockGetHskCoverage).toHaveBeenCalled());
      expect(screen.queryByRole('region', { name: 'HSK coverage' })).not.toBeInTheDocument();
    });

    it('is hidden when the HSK index does not load, and the rest still works', async () => {
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockRejectedValue(new Error('offline'));
      renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState()),
      });

      await waitFor(() => expect(mockGetHskCoverage).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: 'Study' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'HSK coverage' })).not.toBeInTheDocument();
    });

    it('renders the Today card before the HSK index loads', async () => {
      mockGetDashboardStats.mockResolvedValue(sampleStats);
      mockGetHskCoverage.mockImplementation(() => new Promise(() => {}));
      renderWithProviders(<Dashboard />, {
        store: createTestStore(authenticatedState()),
      });

      expect(await screen.findByRole('button', { name: 'Study' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'HSK coverage' })).not.toBeInTheDocument();
    });
  });
});
