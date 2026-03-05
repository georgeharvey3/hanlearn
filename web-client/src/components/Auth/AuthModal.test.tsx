/**
 * Tests for AuthModal component — the login/register UI entry point for all users.
 * Covers form validation, submission dispatching, and mode switching.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../firebase/auth', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
  signInWithGoogle: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => vi.fn()),
  getCurrentUser: vi.fn(() => null),
}));
vi.mock('../../services/wordService');
vi.mock('../../services/streakService', () => ({
  recordTestCompletion: vi.fn(),
  getStreakData: vi.fn().mockResolvedValue([]),
  calculateStreak: vi.fn().mockReturnValue(0),
}));

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AuthModal from './AuthModal';
import { renderWithProviders, createTestStore } from '../../test/utils';
import * as firebaseAuth from '../../firebase/auth';

const mockedAuth = vi.mocked(firebaseAuth);

function renderModal(mode: 'login' | 'register' = 'login', error: string | null = null) {
  const store = createTestStore({
    auth: {
      userId: null,
      loading: false,
      error,
      newSignUp: false,
      initialized: true,
      modalOpen: true,
      modalMode: mode,
    },
    addWords: { words: [], error: false, loading: false },
    settings: { speechAvailable: false, synthAvailable: false },
  });
  return { store, ...renderWithProviders(<AuthModal />, { store }) };
}

describe('AuthModal — login mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Welcome Back" heading in login mode', () => {
    renderModal('login');
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('shows "Log In" submit button in login mode', () => {
    renderModal('login');
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('Log In button is disabled until email and password are valid', async () => {
    renderModal('login');
    const submitBtn = screen.getByRole('button', { name: /log in/i });
    expect(submitBtn).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'secret123');

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('calls loginUser with email and password on form submit', async () => {
    mockedAuth.loginUser.mockResolvedValue({ uid: 'user-1' } as firebaseAuth.User);
    renderModal('login');

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockedAuth.loginUser).toHaveBeenCalledWith('user@example.com', 'secret123');
    });
  });

  it('shows a Firebase error message when login fails', () => {
    renderModal('login', 'Invalid email or password');
    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('shows "Sign Up" link to switch to register mode', () => {
    renderModal('login');
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });
});

describe('AuthModal — register mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Create Account" heading in register mode', () => {
    renderModal('register');
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  it('shows "Sign Up" submit button in register mode', () => {
    renderModal('register');
    // The submit button says "Sign Up" (not the switch link)
    const buttons = screen.getAllByRole('button', { name: /sign up/i });
    // The submit button is the last one (the link comes first in DOM order, submit last)
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls registerUser with email and password on form submit', async () => {
    mockedAuth.registerUser.mockResolvedValue({ uid: 'new-user' } as firebaseAuth.User);
    renderModal('register');

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    const submitBtn = screen.getByRole('button', { name: /sign up/i, hidden: false });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedAuth.registerUser).toHaveBeenCalledWith('new@example.com', 'password123');
    });
  });

  it('shows a "Log In" link to switch back to login mode', () => {
    renderModal('register');
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('validates password length for registration (< 6 chars)', async () => {
    renderModal('register');
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), '123');

    // The submit button should remain disabled
    const signUpButtons = screen.getAllByRole('button');
    const submitBtn = signUpButtons.find((btn) => btn.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDisabled();
  });
});

describe('AuthModal — Google sign-in', () => {
  it('calls signInWithGoogle when "Continue with Google" is clicked', async () => {
    mockedAuth.signInWithGoogle.mockResolvedValue({ uid: 'google-user' } as firebaseAuth.User);
    renderModal('login');

    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(mockedAuth.signInWithGoogle).toHaveBeenCalled();
    });
  });
});
