import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The auth actions transitively initialize Firebase. Mock the config module
// to prevent that in this unit test.
vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

import Toolbar from './Toolbar';
import { renderWithProviders } from '../../../test/utils';

describe('Toolbar', () => {
  it('renders the brand as a native link to home', () => {
    renderWithProviders(<Toolbar isAuth phone />);
    const logo = screen.getByRole('link', { name: 'HanLearn' });
    expect(logo.tagName).toBe('A');
    expect(logo).toHaveAttribute('href', '/');
  });

  it('opens the auth modal from Log in and Sign up', () => {
    const { store } = renderWithProviders(<Toolbar isAuth={false} phone={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(store.getState().auth.modalOpen).toBe(true);
    expect(store.getState().auth.modalMode).toBe('register');
  });
});
