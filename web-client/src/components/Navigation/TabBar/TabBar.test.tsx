import React from 'react';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The auth actions transitively initialize Firebase. Mock the config module
// to prevent that in this unit test.
vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

const { sentenceTabs } = vi.hoisted(() => ({
  sentenceTabs: {
    current: null as TabStatuses | null,
  },
}));
vi.mock('../../../hooks/useSentenceTabs', () => ({
  useSentenceTabs: () => sentenceTabs.current,
}));

import TabBar from './TabBar';
import type { TabStatuses } from '../../../services/sentenceTabsService';
import { renderWithProviders } from '../../../test/utils';

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return renderWithProviders(<TabBar onOpenShortcuts={vi.fn()} />);
};

const tabBar = () => screen.getByRole('navigation', { name: 'Main' });

const statuses = (comprehend: boolean, compose: boolean): TabStatuses => ({
  comprehend: { ready: true, fresh: comprehend },
  compose: { ready: true, fresh: compose },
});

describe('TabBar', () => {
  beforeEach(() => {
    sentenceTabs.current = null;
  });

  it('shows Home, Add, Study, Sentences and More, in that order', () => {
    renderAt('/');
    const labels = Array.from(tabBar().children).map((tab) => tab.textContent);
    expect(labels).toEqual(['Home', 'Add', 'Study', 'Sentences', 'More']);
  });

  it('opens a menu of Comprehend and Compose from Sentences, and a row goes to its tab', async () => {
    renderAt('/');
    fireEvent.click(within(tabBar()).getByRole('button', { name: 'Sentences' }));

    const menu = screen.getByRole('menu');
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Comprehend', 'Compose']);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Compose' }));
    expect(window.location.pathname).toBe('/compose');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes the menu on Escape', async () => {
    renderAt('/');
    fireEvent.click(within(tabBar()).getByRole('button', { name: 'Sentences' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(window.location.pathname).toBe('/');
  });

  it('closes the menu on a tap outside it', async () => {
    renderAt('/');
    fireEvent.click(within(tabBar()).getByRole('button', { name: 'Sentences' }));
    // The backdrop of the menu covers the rest of the screen.
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(window.location.pathname).toBe('/');
  });

  it('puts the dot on Sentences, and on the row of the fresh tab only', () => {
    sentenceTabs.current = statuses(false, true);
    renderAt('/');

    const sentences = within(tabBar()).getByRole('button', { name: 'Sentences, new words' });
    expect(within(sentences).getByTestId('tab-dot')).toBeInTheDocument();
    expect(within(tabBar()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(tabBar()).queryAllByTestId('tab-dot')).toHaveLength(1);

    fireEvent.click(sentences);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Comprehend' })).not.toContainElement(
      within(menu).queryByTestId('tab-dot'),
    );
    const compose = within(menu).getByRole('menuitem', { name: 'Compose, new words' });
    expect(within(compose).getByTestId('tab-dot')).toBeInTheDocument();
    expect(within(menu).getAllByTestId('tab-dot')).toHaveLength(1);
  });

  it.each(['/comprehend', '/compose'])('marks Sentences as the current page on %s', (path) => {
    renderAt(path);
    const sentences = within(tabBar()).getByRole('button', { name: 'Sentences' });
    expect(sentences).toHaveAttribute('aria-current', 'page');
    expect(within(tabBar()).getByRole('button', { name: 'More' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks More as the current page on Settings', () => {
    renderAt('/settings');
    expect(within(tabBar()).getByRole('button', { name: 'More' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabBar()).getByRole('button', { name: 'Sentences' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows no dot when neither sentence tab is fresh', () => {
    sentenceTabs.current = statuses(false, false);
    renderAt('/');
    expect(within(tabBar()).getByRole('button', { name: 'Sentences' })).toBeInTheDocument();
    expect(within(tabBar()).queryAllByTestId('tab-dot')).toHaveLength(0);
  });
});
