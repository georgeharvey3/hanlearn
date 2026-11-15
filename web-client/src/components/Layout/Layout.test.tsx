import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';

// The shell's auth actions initialize Firebase on import, which fails
// without the API key that CI does not have.
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

const { loadTabStatuses } = vi.hoisted(() => ({ loadTabStatuses: vi.fn() }));
vi.mock('../../services/sentenceTabsService', () => ({ loadTabStatuses }));

import Layout from './Layout';
import { useFocusMode } from './focusMode';
import { useStickyTop } from './stickyTop';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import { ListStats } from '../../types/store';

/** Make every media query match, or none, as a phone or a desktop would. */
const stubScreen = (phone: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const Session: React.FC = () => {
  useFocusMode(true);
  return <div>session</div>;
};

/** A signed-in store with 12 words due across two lists. */
const signedIn = () => {
  const state = authenticatedState();
  const stats = (due: number) => ({ due }) as ListStats;
  return {
    ...state,
    addWords: { ...state.addWords!, listStats: { a: stats(5), b: stats(7), __all__: stats(12) } },
  };
};

/** The status of the sentence tabs: Comprehend holds a word never practised there. */
const freshComprehend = {
  comprehend: { ready: true, fresh: true },
  compose: { ready: true, fresh: false },
};

beforeEach(() => {
  loadTabStatuses.mockReset();
  loadTabStatuses.mockResolvedValue({
    comprehend: { ready: false, fresh: false },
    compose: { ready: false, fresh: false },
  });
});

/** A page that shows the offset at which its pinned rows stick. */
const Pinned: React.FC = () => <div data-testid="sticky-top">{useStickyTop()}</div>;

const renderShell = (children: React.ReactNode = <div>page</div>, auth = true) =>
  renderWithProviders(<Layout>{children}</Layout>, {
    store: createTestStore(auth ? signedIn() : undefined),
  });

describe('Layout on a phone', () => {
  beforeEach(() => stubScreen(true));
  afterEach(() => vi.unstubAllGlobals());

  it('shows the tab bar with the due count on Study', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Add' })).toHaveAttribute('href', '/add-words');
    expect(within(nav).getByRole('link', { name: 'Study, 12 due' })).toHaveAttribute(
      'href',
      '/test-words',
    );
    expect(within(nav).getByRole('button', { name: 'Sentences' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('lists the sentence tabs under Sentences, with a dot on a tab that holds a new word', async () => {
    loadTabStatuses.mockResolvedValue(freshComprehend);
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: 'Sentences, new words' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Comprehend, new words' })).toHaveAttribute(
      'href',
      '/comprehend',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Compose' })).toHaveAttribute(
      'href',
      '/compose',
    );
  });

  it('opens Settings, Shortcuts and Log out from More', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = screen.getByRole('dialog', { name: 'More' });
    expect(within(sheet).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(within(sheet).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('hides the top bar and the tab bar for a session', () => {
    renderShell(<Session />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('pins a page row directly below the top bar', () => {
    renderShell(<Pinned />);
    expect(screen.getByTestId('sticky-top')).toHaveTextContent(
      'calc(48px + env(safe-area-inset-top))',
    );
  });

  it('shows Log in and Sign up to a visitor, and no tab bar', () => {
    renderShell(<div>page</div>, false);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('Layout on a desktop', () => {
  beforeEach(() => {
    stubScreen(false);
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the sidebar with Study first, and no top bar', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label') ?? l.textContent)).toEqual([
      'HanLearn',
      'Study, 12 due',
      'Comprehend',
      'Compose',
      'Home',
      'Add words',
      'Settings',
    ]);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('puts a dot and no count on a sentence tab that holds a new word', async () => {
    loadTabStatuses.mockResolvedValue(freshComprehend);
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(await within(nav).findByRole('link', { name: 'Comprehend, new words' })).toHaveAttribute(
      'href',
      '/comprehend',
    );
    expect(within(nav).getByRole('link', { name: 'Compose' })).toHaveTextContent(/^Compose$/);
    expect(within(nav).getAllByTestId('tab-dot')).toHaveLength(1);
  });

  it('collapses the sidebar to a rail and remembers it', () => {
    const { unmount } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'HanLearn home' })).toBeInTheDocument();
    unmount();

    renderShell();
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
  });

  it('pins a page row at the top of the viewport when there is no top bar', () => {
    renderShell(<Pinned />);
    expect(screen.getByTestId('sticky-top')).toHaveTextContent(
      'calc(0px + env(safe-area-inset-top))',
    );
  });

  it('pins a page row below the top bar for a visitor', () => {
    renderShell(<Pinned />, false);
    expect(screen.getByTestId('sticky-top')).toHaveTextContent(
      'calc(56px + env(safe-area-inset-top))',
    );
  });

  it('keeps the sidebar for a session', () => {
    renderShell(<Session />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
