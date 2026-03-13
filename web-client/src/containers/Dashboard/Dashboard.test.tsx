import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import Dashboard from './Dashboard';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/dashboardService', () => ({
  getDashboardStats: vi.fn(),
}));

// Chengyu makes async calls to local data — mock it to keep tests focused
vi.mock('../../components/Home/Chengyu/Chengyu', () => ({
  default: () => React.createElement('div', { 'data-testid': 'chengyu-mock' }),
}));

import { getDashboardStats } from '../../services/dashboardService';
const mockGetDashboardStats = getDashboardStats as ReturnType<typeof vi.fn>;

const sampleStats = {
  totalWords: 50,
  dueWords: 12,
  streak: 5,
  bankDistribution: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 },
  masteredCount: 10,
  estimatedStudyTime: '~10 min',
  weeklyStats: { sessions: 4, wordsReviewed: 38 },
};

describe('Dashboard container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a spinner while loading', () => {
    mockGetDashboardStats.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the heading and stat cards after a successful load', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument(); // dueWords
    expect(screen.getByText('Words Due')).toBeInTheDocument();
    expect(screen.getByText(/out of 50 total/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // streak
  });

  it('calls getDashboardStats with the correct userId', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState('uid-xyz')),
    });
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledWith('uid-xyz', 'default'));
  });

  it('shows an error message when the stats load fails', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('offline'));
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() =>
      expect(screen.getByText(/could not load dashboard data/i)).toBeInTheDocument(),
    );
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

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
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
    // The Dashboard heading appears once loading resolves to false.
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(mockGetDashboardStats).not.toHaveBeenCalled();
  });

  it('shows the "Test Now" link when words are due', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('Test Now')).toBeInTheDocument());
  });

  it('hides the "Test Now" link when no words are due', async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...sampleStats,
      dueWords: 0,
      estimatedStudyTime: null,
    });
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.queryByText('Test Now')).not.toBeInTheDocument();
  });

  it('displays estimated study time when words are due', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('~10 min')).toBeInTheDocument());
  });

  it('renders weekly stats card with sessions and words reviewed', async () => {
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('sessions')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('words reviewed')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });

  it('shows singular "session" when weekly sessions is 1', async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...sampleStats,
      weeklyStats: { sessions: 1, wordsReviewed: 10 },
    });
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('session')).toBeInTheDocument());
  });

  it('hides estimated study time when no words are due', async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...sampleStats,
      dueWords: 0,
      estimatedStudyTime: null,
    });
    renderWithProviders(<Dashboard />, {
      store: createTestStore(authenticatedState()),
    });
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });
});
