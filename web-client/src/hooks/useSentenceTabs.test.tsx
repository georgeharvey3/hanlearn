import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';

const { loadTabStatuses } = vi.hoisted(() => ({ loadTabStatuses: vi.fn() }));
vi.mock('../services/sentenceTabsService', () => ({ loadTabStatuses }));
vi.mock('../services/errorReporting', () => ({ reportError: vi.fn() }));

import { refreshSentenceTabs, useSentenceTabs } from './useSentenceTabs';
import { renderWithProviders, authenticatedState, createTestStore } from '../test/utils';

const Probe: React.FC<{ name: string }> = ({ name }) => {
  const statuses = useSentenceTabs();
  return <div>{`${name}: ${statuses?.comprehend.fresh ? 'dot' : 'none'}`}</div>;
};

describe('useSentenceTabs', () => {
  it('shares one load between the sidebar and the finish screen, and loads again on refresh', async () => {
    loadTabStatuses.mockResolvedValue({
      comprehend: { ready: true, fresh: true },
      compose: { ready: false, fresh: false },
    });
    renderWithProviders(
      <>
        <Probe name="sidebar" />
        <Probe name="summary" />
      </>,
      { store: createTestStore(authenticatedState('user-1')) },
    );

    expect(await screen.findByText('sidebar: dot')).toBeInTheDocument();
    expect(screen.getByText('summary: dot')).toBeInTheDocument();
    expect(loadTabStatuses).toHaveBeenCalledTimes(1);

    // The end of a set clears the dot of the tab.
    loadTabStatuses.mockResolvedValue({
      comprehend: { ready: true, fresh: false },
      compose: { ready: false, fresh: false },
    });
    act(() => refreshSentenceTabs());

    await waitFor(() => expect(screen.getByText('sidebar: none')).toBeInTheDocument());
    expect(screen.getByText('summary: none')).toBeInTheDocument();
    expect(loadTabStatuses).toHaveBeenCalledTimes(2);
  });
});
