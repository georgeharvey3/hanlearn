import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore } from '../../test/utils';
import * as authActions from './auth';
import * as firebaseAuth from '../../firebase/auth';
import * as Sentry from '@sentry/react';
import { FirebaseError } from 'firebase/app';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../firebase/auth');
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
}));

const mockedAuth = vi.mocked(firebaseAuth);
const mockedSentry = vi.mocked(Sentry);

function makeUser(uid: string) {
  return { uid } as firebaseAuth.User;
}

const defaultStoreState = {
  auth: {
    userId: null,
    loading: false,
    error: null,
    newSignUp: false,
    initialized: false,
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

describe('auth action thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth (login)', () => {
    it('dispatches AUTH_START then AUTH_SUCCESS on successful login', async () => {
      mockedAuth.loginUser.mockResolvedValue(makeUser('user-abc'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('test@example.com', 'password123') as any);

      const state = store.getState().auth;
      expect(state.userId).toBe('user-abc');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.initialized).toBe(true);
    });

    it('dispatches AUTH_FAIL with friendly message on invalid-credential', async () => {
      const firebaseError = new FirebaseError(
        'auth/invalid-credential',
        'Firebase: Error (auth/invalid-credential).',
      );
      mockedAuth.loginUser.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('test@example.com', 'wrong') as any);

      const state = store.getState().auth;
      expect(state.userId).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Invalid email or password');
    });

    it('dispatches AUTH_FAIL with generic message on non-Firebase error', async () => {
      mockedAuth.loginUser.mockRejectedValue(new Error('Network failed'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('test@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('Login failed');
    });
  });

  describe('register', () => {
    it('dispatches AUTH_SUCCESS on successful registration', async () => {
      mockedAuth.registerUser.mockResolvedValue(makeUser('new-user-1'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('new@example.com', 'secure123') as any);

      const state = store.getState().auth;
      expect(state.userId).toBe('new-user-1');
      expect(state.loading).toBe(false);
    });

    it('sets newSignUp=true on successful registration', async () => {
      mockedAuth.registerUser.mockResolvedValue(makeUser('new-user-1'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('new@example.com', 'secure123') as any);

      // registerSuccess() must be dispatched so future UI can distinguish new sign-ups
      expect(store.getState().auth.newSignUp).toBe(true);
    });

    it('dispatches AUTH_FAIL for weak-password', async () => {
      const firebaseError = new FirebaseError(
        'auth/weak-password',
        'Firebase: Password should be at least 6 characters (auth/weak-password).',
      );
      mockedAuth.registerUser.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('new@example.com', '123') as any);

      expect(store.getState().auth.error).toBe('Password is too weak');
    });

    it('dispatches AUTH_FAIL for email-already-in-use', async () => {
      const firebaseError = new FirebaseError(
        'auth/email-already-in-use',
        'Firebase: Error (auth/email-already-in-use).',
      );
      mockedAuth.registerUser.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('taken@example.com', 'pw123456') as any);

      expect(store.getState().auth.error).toBe('This email is already registered');
    });
  });

  describe('logout', () => {
    it('calls logoutUser and dispatches AUTH_LOGOUT', async () => {
      mockedAuth.logoutUser.mockResolvedValue(undefined);
      const store = createTestStore({
        ...defaultStoreState,
        auth: {
          ...defaultStoreState.auth,
          userId: 'user-abc',
          initialized: true,
        },
      });

      await store.dispatch(authActions.logout() as any);

      expect(mockedAuth.logoutUser).toHaveBeenCalled();
      expect(store.getState().auth.userId).toBeNull();
    });

    it('dispatches AUTH_LOGOUT even if logoutUser throws', async () => {
      mockedAuth.logoutUser.mockRejectedValue(new Error('Firebase offline'));
      const store = createTestStore({
        ...defaultStoreState,
        auth: {
          ...defaultStoreState.auth,
          userId: 'user-abc',
          initialized: true,
        },
      });

      await store.dispatch(authActions.logout() as any);

      expect(store.getState().auth.userId).toBeNull();
    });
  });

  describe('googleSignIn', () => {
    it('dispatches AUTH_SUCCESS on successful Google sign-in', async () => {
      mockedAuth.signInWithGoogle.mockResolvedValue(makeUser('google-user-1'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(store.getState().auth.userId).toBe('google-user-1');
    });

    it('suppresses error for popup-closed-by-user', async () => {
      const firebaseError = new FirebaseError(
        'auth/popup-closed-by-user',
        'Firebase: Error (auth/popup-closed-by-user).',
      );
      mockedAuth.signInWithGoogle.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      // Empty string error means silently handled
      expect(store.getState().auth.error).toBe('');
    });
  });

  describe('initAuthListener', () => {
    it('dispatches AUTH_SUCCESS when user is authenticated', () => {
      let authCallback: ((user: firebaseAuth.User | null) => void) | null = null;
      mockedAuth.subscribeToAuthChanges.mockImplementation((cb) => {
        authCallback = cb;
        return vi.fn();
      });
      const store = createTestStore(defaultStoreState);

      store.dispatch(authActions.initAuthListener() as any);

      expect(mockedAuth.subscribeToAuthChanges).toHaveBeenCalled();

      // Simulate Firebase calling back with a user
      authCallback!(makeUser('restored-user'));
      expect(store.getState().auth.userId).toBe('restored-user');
      expect(store.getState().auth.initialized).toBe(true);
    });

    it('dispatches AUTH_INITIALIZED when no user', () => {
      let authCallback: ((user: firebaseAuth.User | null) => void) | null = null;
      mockedAuth.subscribeToAuthChanges.mockImplementation((cb) => {
        authCallback = cb;
        return vi.fn();
      });
      const store = createTestStore(defaultStoreState);

      store.dispatch(authActions.initAuthListener() as any);

      authCallback!(null);
      expect(store.getState().auth.userId).toBeNull();
      expect(store.getState().auth.initialized).toBe(true);
    });
  });

  describe('action creators', () => {
    it('openAuthModal creates correct action', () => {
      expect(authActions.openAuthModal('register')).toEqual({
        type: 'OPEN_AUTH_MODAL',
        mode: 'register',
      });
    });

    it('closeAuthModal creates correct action', () => {
      expect(authActions.closeAuthModal()).toEqual({
        type: 'CLOSE_AUTH_MODAL',
      });
    });

    it('setAuthModalMode creates correct action', () => {
      expect(authActions.setAuthModalMode('login')).toEqual({
        type: 'SET_AUTH_MODAL_MODE',
        mode: 'login',
      });
    });
  });

  describe('sendPasswordReset', () => {
    it('dispatches PASSWORD_RESET_SENT on success', async () => {
      mockedAuth.resetPassword.mockResolvedValue(undefined);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.sendPasswordReset('user@example.com') as any);

      expect(mockedAuth.resetPassword).toHaveBeenCalledWith('user@example.com');
      expect(store.getState().auth.resetEmailSent).toBe(true);
      expect(store.getState().auth.loading).toBe(false);
      expect(store.getState().auth.error).toBeNull();
    });

    it('dispatches PASSWORD_RESET_SENT for auth/user-not-found (prevents email enumeration)', async () => {
      const firebaseError = new FirebaseError(
        'auth/user-not-found',
        'Firebase: Error (auth/user-not-found).',
      );
      mockedAuth.resetPassword.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.sendPasswordReset('unknown@example.com') as any);

      // Should show success even for unknown email to prevent enumeration
      expect(store.getState().auth.resetEmailSent).toBe(true);
      expect(store.getState().auth.error).toBeNull();
    });

    it('dispatches AUTH_FAIL for other Firebase errors', async () => {
      const firebaseError = new FirebaseError(
        'auth/too-many-requests',
        'Firebase: Error (auth/too-many-requests).',
      );
      mockedAuth.resetPassword.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.sendPasswordReset('user@example.com') as any);

      expect(store.getState().auth.error).toBe('Too many failed attempts. Please try again later');
      // resetEmailSent should not have been set to true
      expect(store.getState().auth.resetEmailSent).not.toBe(true);
    });

    it('dispatches AUTH_FAIL with generic message for non-Firebase errors', async () => {
      mockedAuth.resetPassword.mockRejectedValue(new Error('Network error'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.sendPasswordReset('user@example.com') as any);

      expect(store.getState().auth.error).toBe('Failed to send reset email');
    });
  });

  describe('googleSignIn — additional error paths', () => {
    it('dispatches AUTH_FAIL with message for popup-blocked error', async () => {
      const firebaseError = new FirebaseError(
        'auth/popup-blocked',
        'Firebase: Error (auth/popup-blocked).',
      );
      mockedAuth.signInWithGoogle.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(store.getState().auth.error).toBe(
        'Please allow popups for this site to sign in with Google',
      );
      expect(store.getState().auth.userId).toBeNull();
    });

    it('dispatches AUTH_FAIL with generic message for non-Firebase errors', async () => {
      mockedAuth.signInWithGoogle.mockRejectedValue(new Error('Network failure'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(store.getState().auth.error).toBe('Google sign-in failed');
    });
  });

  describe('register — non-Firebase error path', () => {
    it('dispatches AUTH_FAIL with generic message for non-Firebase errors', async () => {
      mockedAuth.registerUser.mockRejectedValue(new Error('Network error'));
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('user@example.com', 'password') as any);

      expect(store.getState().auth.error).toBe('Registration failed');
      expect(store.getState().auth.userId).toBeNull();
    });
  });

  describe('getErrorMessage — default/fallback case', () => {
    it('shows a user-friendly message for unknown Firebase error codes', async () => {
      const unknownError = new FirebaseError('auth/unknown-code', 'Something went wrong');
      mockedAuth.loginUser.mockRejectedValue(unknownError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      // Falls through to default: error.message || 'An error occurred'
      expect(store.getState().auth.error).toBe('Something went wrong');
    });

    it('falls back to "An error occurred" when Firebase error has no message', async () => {
      const unknownError = new FirebaseError('auth/unknown-code', '');
      mockedAuth.loginUser.mockRejectedValue(unknownError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('An error occurred');
    });
  });

  describe('getErrorMessage — all Firebase error codes', () => {
    it('maps auth/operation-not-allowed to friendly message', async () => {
      const error = new FirebaseError('auth/operation-not-allowed', 'Firebase error');
      mockedAuth.loginUser.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('Email/password accounts are not enabled');
    });

    it('maps auth/user-disabled to friendly message', async () => {
      const error = new FirebaseError('auth/user-disabled', 'Firebase error');
      mockedAuth.loginUser.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('This account has been disabled');
    });

    it('maps auth/user-not-found to friendly message', async () => {
      const error = new FirebaseError('auth/user-not-found', 'Firebase error');
      mockedAuth.loginUser.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('No account found with this email');
    });

    it('maps auth/wrong-password to friendly message', async () => {
      const error = new FirebaseError('auth/wrong-password', 'Firebase error');
      mockedAuth.loginUser.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('user@example.com', 'pw') as any);

      expect(store.getState().auth.error).toBe('Invalid password');
    });

    it('maps auth/invalid-email to friendly message', async () => {
      const error = new FirebaseError('auth/invalid-email', 'Firebase error');
      mockedAuth.loginUser.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('bad-email', 'pw') as any);

      expect(store.getState().auth.error).toBe('Invalid email address');
    });

    it('maps auth/account-exists-with-different-credential to friendly message', async () => {
      const error = new FirebaseError(
        'auth/account-exists-with-different-credential',
        'Firebase error',
      );
      mockedAuth.signInWithGoogle.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(store.getState().auth.error).toBe(
        'An account already exists with this email. Please sign in with email/password',
      );
    });

    it('maps auth/cancelled-popup-request to empty string (silent)', async () => {
      const error = new FirebaseError('auth/cancelled-popup-request', 'Firebase error');
      mockedAuth.signInWithGoogle.mockRejectedValue(error);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(store.getState().auth.error).toBe('');
    });
  });

  describe('authCheckState (deprecated)', () => {
    it('delegates to initAuthListener', () => {
      mockedAuth.subscribeToAuthChanges.mockImplementation(() => vi.fn());
      const store = createTestStore(defaultStoreState);

      store.dispatch(authActions.authCheckState() as any);

      expect(mockedAuth.subscribeToAuthChanges).toHaveBeenCalled();
    });
  });

  describe('Sentry reporting', () => {
    it('does NOT report known Firebase error codes (user-input errors)', async () => {
      const knownCodes = [
        'auth/wrong-password',
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/email-already-in-use',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/weak-password',
        'auth/too-many-requests',
      ];

      for (const code of knownCodes) {
        mockedSentry.captureException.mockClear();
        mockedAuth.loginUser.mockRejectedValue(new FirebaseError(code, 'msg'));
        const store = createTestStore(defaultStoreState);

        await store.dispatch(authActions.auth('e@e.com', 'pw') as any);

        expect(
          mockedSentry.captureException,
          `expected no Sentry report for ${code}`,
        ).not.toHaveBeenCalled();
      }
    });

    it('reports unknown Firebase error codes to Sentry', async () => {
      const unknownError = new FirebaseError('auth/something-new', 'msg');
      mockedAuth.loginUser.mockRejectedValue(unknownError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('e@e.com', 'pw') as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(unknownError);
    });

    it('reports non-Firebase errors to Sentry from login', async () => {
      const networkErr = new Error('Network failed');
      mockedAuth.loginUser.mockRejectedValue(networkErr);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.auth('e@e.com', 'pw') as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(networkErr);
    });

    it('reports non-Firebase errors to Sentry from register', async () => {
      const err = new Error('boom');
      mockedAuth.registerUser.mockRejectedValue(err);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('e@e.com', 'pw') as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(err);
    });

    it('reports non-Firebase errors to Sentry from googleSignIn', async () => {
      const err = new Error('boom');
      mockedAuth.signInWithGoogle.mockRejectedValue(err);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.googleSignIn() as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(err);
    });

    it('reports non-Firebase errors to Sentry from sendPasswordReset', async () => {
      const err = new Error('boom');
      mockedAuth.resetPassword.mockRejectedValue(err);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.sendPasswordReset('e@e.com') as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(err);
    });

    it('reports logout failures to Sentry (should never happen in practice)', async () => {
      const err = new Error('Firebase offline');
      mockedAuth.logoutUser.mockRejectedValue(err);
      const store = createTestStore({
        ...defaultStoreState,
        auth: { ...defaultStoreState.auth, userId: 'u1', initialized: true },
      });

      await store.dispatch(authActions.logout() as any);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(err);
    });
  });
});
