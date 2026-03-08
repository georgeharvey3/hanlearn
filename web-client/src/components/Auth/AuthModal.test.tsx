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
  resetPassword: vi.fn(),
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

function renderModal(
  mode: 'login' | 'register' | 'forgot-password' = 'login',
  error: string | null = null,
  resetEmailSent = false,
) {
  const store = createTestStore({
    auth: {
      userId: null,
      loading: false,
      error,
      newSignUp: false,
      initialized: true,
      modalOpen: true,
      modalMode: mode,
      resetEmailSent,
    },
    addWords: { words: [], error: false, loading: false },
    settings: { speechAvailable: false, synthAvailable: false },
  });
  return renderWithProviders(<AuthModal />, { store });
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
    // Use delay:null to avoid timeout in coverage-instrumented runs
    const user = userEvent.setup({ delay: null });
    renderModal('login');
    const submitBtn = screen.getByRole('button', { name: /log in/i });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/email/i), 'user@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'secret123');

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('calls loginUser with email and password on form submit', async () => {
    const user = userEvent.setup({ delay: null });
    mockedAuth.loginUser.mockResolvedValue({ uid: 'user-1' } as firebaseAuth.User);
    renderModal('login');

    await user.type(screen.getByPlaceholderText(/email/i), 'user@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

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

  it('shows "Forgot password?" link in login mode', () => {
    renderModal('login');
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
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

describe('AuthModal — forgot-password mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Reset Password" heading', () => {
    renderModal('forgot-password');
    expect(screen.getByText(/reset password/i)).toBeInTheDocument();
  });

  it('shows only email field, no password field', () => {
    renderModal('forgot-password');
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/password/i)).not.toBeInTheDocument();
  });

  it('does not show Google sign-in button', () => {
    renderModal('forgot-password');
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('"Send Reset Link" button is disabled until email is valid', async () => {
    renderModal('forgot-password');
    const submitBtn = screen.getByRole('button', { name: /send reset link/i });
    expect(submitBtn).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'user@example.com');

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('calls resetPassword on submit', async () => {
    mockedAuth.resetPassword.mockResolvedValue(undefined);
    renderModal('forgot-password');

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockedAuth.resetPassword).toHaveBeenCalledWith('user@example.com');
    });
  });

  it('shows confirmation message after successful send', () => {
    renderModal('forgot-password', null, true);
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/password reset link/i)).toBeInTheDocument();
  });

  it('"Back to Log In" link is present in forgot-password mode', () => {
    renderModal('forgot-password');
    expect(screen.getByRole('button', { name: /back to log in/i })).toBeInTheDocument();
  });

  it('shows error message on failure', () => {
    renderModal('forgot-password', 'Too many failed attempts. Please try again later');
    expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
  });
});
