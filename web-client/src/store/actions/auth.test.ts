import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore } from '../../test/utils';
import * as authActions from './auth';
import * as firebaseAuth from '../../firebase/auth';
import { FirebaseError } from 'firebase/app';

vi.mock('../../firebase/auth');

const mockedAuth = vi.mocked(firebaseAuth);

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
  addWords: { words: [], error: false, loading: false },
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
        'Firebase: Error (auth/invalid-credential).'
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

    it('dispatches AUTH_FAIL for weak-password', async () => {
      const firebaseError = new FirebaseError(
        'auth/weak-password',
        'Firebase: Password should be at least 6 characters (auth/weak-password).'
      );
      mockedAuth.registerUser.mockRejectedValue(firebaseError);
      const store = createTestStore(defaultStoreState);

      await store.dispatch(authActions.register('new@example.com', '123') as any);

      expect(store.getState().auth.error).toBe('Password is too weak');
    });

    it('dispatches AUTH_FAIL for email-already-in-use', async () => {
      const firebaseError = new FirebaseError(
        'auth/email-already-in-use',
        'Firebase: Error (auth/email-already-in-use).'
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
        'Firebase: Error (auth/popup-closed-by-user).'
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
});
