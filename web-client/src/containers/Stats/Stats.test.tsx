import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import Stats from './Stats';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import { DIRECTIONS } from '../../types/models';
import type { SchedulerStats } from '../../services/statsService';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/statsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../services/statsService');
  return { ...actual, getSchedulerStats: vi.fn() };
});

import { getSchedulerStats } from '../../services/statsService';
const mockGetSchedulerStats = getSchedulerStats as ReturnType<typeof vi.fn>;

function sampleStats(overrides: Partial<SchedulerStats> = {}): SchedulerStats {
  return {
    directions: DIRECTIONS.map((direction) => ({
      direction,
      attempts: 100,
      reviews: 100,
      trueRetention: direction === 'CM' ? 0.62 : 0.88,
      promotionRate: 0.4,
      stallRate: 0.5,
      medianMatureInterval: direction === 'CM' ? 24 : 75,
      matureCount: 12,
    })),
    medianMatureInterval: 70,
    matureCount: 60,
    load: {
      days: Array.from({ length: 14 }, (_, offset) => ({ offset, due: offset === 0 ? 18 : 6 })),
      overdue: 3,
      perDay: 7,
    },
    daysStudied: 12,
    windowDays: 30,
    ...overrides,
  };
}

describe('Stats container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSchedulerStats.mockResolvedValue(sampleStats());
  });

  it('shows the median interval of the mature words', async () => {
    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    expect(await screen.findByText('70')).toBeInTheDocument();
    expect(screen.getByText(/median days between reviews/i)).toBeInTheDocument();
  });

  it('shows a retention figure for every question type', async () => {
    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    await screen.findByText('62%');
    expect(screen.getAllByText('88%')).toHaveLength(4);
  });

  it('names each question type as the learner sees it', async () => {
    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    expect(await screen.findByText('Meaning → Character')).toBeInTheDocument();
    expect(screen.getByText('Character → Meaning')).toBeInTheDocument();
  });

  it('shows a dash where there are too few reviews to report retention', async () => {
    const stats = sampleStats();
    stats.directions[0] = { ...stats.directions[0], reviews: 3, trueRetention: null };
    mockGetSchedulerStats.mockResolvedValue(stats);

    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('shows the load ahead, with the overdue called out', async () => {
    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    expect(await screen.findByText(/3 already overdue/)).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('says the counted metrics start from the next session when nothing is recorded', async () => {
    mockGetSchedulerStats.mockResolvedValue(sampleStats({ daysStudied: 0 }));

    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    expect(await screen.findByText(/start filling in from your next one/i)).toBeInTheDocument();
  });

  it('offers a retry when the load fails', async () => {
    mockGetSchedulerStats.mockRejectedValue(new Error('offline'));

    renderWithProviders(<Stats />, { store: createTestStore(authenticatedState()) });

    const retry = await screen.findByRole('button', { name: /try again/i });
    mockGetSchedulerStats.mockResolvedValue(sampleStats());
    await userEvent.click(retry);

    await waitFor(() => expect(screen.getByText('70')).toBeInTheDocument());
  });

  it('covers every list when the virtual all-lists selection is active', async () => {
    const state = authenticatedState();
    state.addWords!.activeListId = '__all__';

    renderWithProviders(<Stats />, { store: createTestStore(state) });

    await waitFor(() =>
      expect(mockGetSchedulerStats).toHaveBeenCalledWith('test-user-123', undefined),
    );
  });
});
