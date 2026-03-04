import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// NavigationItems imports auth actions which transitively initialize Firebase.
// Mock the config module to prevent that in this unit test.
vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

import Toolbar from './Toolbar';
import { renderWithProviders } from '../../../test/utils';

describe('Toolbar', () => {
  it('renders the logo as a native link with href="/"', () => {
    renderWithProviders(<Toolbar />);
    const logo = screen.getByRole('link', { name: /hanlearn/i });
    expect(logo).toBeInTheDocument();
    expect(logo.tagName).toBe('A');
    expect(logo).toHaveAttribute('href', '/');
  });

  it('logo does not have redundant role="link" or manual tabIndex', () => {
    renderWithProviders(<Toolbar />);
    const logo = screen.getByRole('link', { name: /hanlearn/i });
    expect(logo).not.toHaveAttribute('role');
    expect(logo).not.toHaveAttribute('tabindex', '0');
  });

  it('renders a nav landmark for unauthenticated desktop navigation', () => {
    renderWithProviders(<Toolbar />);
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
  });
});
