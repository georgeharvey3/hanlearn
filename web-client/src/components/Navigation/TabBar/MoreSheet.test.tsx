import React from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The auth actions transitively initialize Firebase. Mock the config module
// to prevent that in this unit test.
vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

import MoreSheet from './MoreSheet';
import { renderWithProviders } from '../../../test/utils';

describe('MoreSheet', () => {
  it('shows Settings, Shortcuts and Log out, and no sentence rows', () => {
    renderWithProviders(<MoreSheet open onClose={vi.fn()} onOpenShortcuts={vi.fn()} />);
    const sheet = screen.getByRole('dialog', { name: 'More' });

    const rows = [
      ...within(sheet).getAllByRole('link'),
      ...within(sheet).getAllByRole('button'),
    ].map((row) => row.textContent);
    expect(rows).toEqual(['Settings', 'Shortcuts', 'Log out']);
    expect(within(sheet).queryByText('Comprehend')).not.toBeInTheDocument();
    expect(within(sheet).queryByText('Compose')).not.toBeInTheDocument();
  });

  it('goes to Settings and closes', () => {
    window.history.pushState({}, '', '/');
    const onClose = vi.fn();
    renderWithProviders(<MoreSheet open onClose={onClose} onOpenShortcuts={vi.fn()} />);

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(window.location.pathname).toBe('/settings');
    expect(onClose).toHaveBeenCalled();
  });
});
