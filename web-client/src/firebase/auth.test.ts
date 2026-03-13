/**
 * Tests for firebase/auth.ts — the auth service layer.
 * Firebase Auth SDK and Firestore SDK are mocked at the module level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCreateUser,
  mockSignIn,
  mockSignOut,
  mockOnAuthStateChanged,
  mockSignInWithPopup,
  mockSendPasswordResetEmail,
  mockGetDoc,
  mockSetDoc,
  mockDoc,
  mockServerTimestamp,
  mockAuthCurrentUser,
} = vi.hoisted(() => {
  const mockAuthCurrentUser = { value: null as unknown };
  return {
    mockCreateUser: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignOut: vi.fn(),
    mockOnAuthStateChanged: vi.fn(),
    mockSignInWithPopup: vi.fn(),
    mockSendPasswordResetEmail: vi.fn(),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
    mockServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    mockAuthCurrentUser,
  };
});

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mockCreateUser,
  signInWithEmailAndPassword: mockSignIn,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: mockSignInWithPopup,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('./config', () => ({
  get auth() {
    return {
      get currentUser() {
        return mockAuthCurrentUser.value;
      },
    };
  },
  db: {},
}));

import {
  registerUser,
  loginUser,
  logoutUser,
  subscribeToAuthChanges,
  getCurrentUser,
  signInWithGoogle,
  resetPassword,
} from './auth';

function makeUser(uid: string, email = 'test@example.com', displayName: string | null = null) {
  return { uid, email, displayName } as any;
}

describe('registerUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createUserWithEmailAndPassword and returns the user', async () => {
    const user = makeUser('new-uid');
    mockCreateUser.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    const result = await registerUser('test@example.com', 'password123');

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'password123',
    );
    expect(result).toBe(user);
  });

  it('creates a Firestore user document when none exists', async () => {
    const user = makeUser('new-uid', 'test@example.com', null);
    mockCreateUser.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await registerUser('test@example.com', 'password123');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const docData = mockSetDoc.mock.calls[0][1];
    expect(docData.email).toBe('test@example.com');
    expect(docData.username).toBe('test@example.com'); // displayName is null, falls back to email
    expect(docData.createdAt).toBe('SERVER_TIMESTAMP');
  });

  it('skips creating Firestore document when it already exists', async () => {
    const user = makeUser('existing-uid');
    mockCreateUser.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => true });

    await registerUser('existing@example.com', 'password123');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('uses displayName as username when available', async () => {
    const user = makeUser('uid-1', 'u@example.com', 'Alice');
    mockCreateUser.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await registerUser('u@example.com', 'pw');

    const docData = mockSetDoc.mock.calls[0][1];
    expect(docData.username).toBe('Alice');
  });
});

describe('loginUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithEmailAndPassword and returns user', async () => {
    const user = makeUser('uid-login');
    mockSignIn.mockResolvedValue({ user });

    const result = await loginUser('login@example.com', 'secret');

    expect(mockSignIn).toHaveBeenCalledWith(expect.anything(), 'login@example.com', 'secret');
    expect(result).toBe(user);
  });

  it('propagates errors from signInWithEmailAndPassword', async () => {
    mockSignIn.mockRejectedValue(new Error('auth/wrong-password'));

    await expect(loginUser('bad@example.com', 'wrong')).rejects.toThrow('auth/wrong-password');
  });
});

describe('logoutUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signOut and resolves', async () => {
    mockSignOut.mockResolvedValue(undefined);

    await expect(logoutUser()).resolves.toBeUndefined();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('propagates errors from signOut', async () => {
    mockSignOut.mockRejectedValue(new Error('network error'));

    await expect(logoutUser()).rejects.toThrow('network error');
  });
});

describe('subscribeToAuthChanges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls onAuthStateChanged and returns unsubscribe function', () => {
    const unsubscribe = vi.fn();
    mockOnAuthStateChanged.mockReturnValue(unsubscribe);

    const callback = vi.fn();
    const result = subscribeToAuthChanges(callback);

    expect(mockOnAuthStateChanged).toHaveBeenCalledWith(expect.anything(), callback);
    expect(result).toBe(unsubscribe);
  });

  it('invokes callback with user when auth state changes', () => {
    const user = makeUser('auth-uid');
    let capturedCallback: ((u: typeof user | null) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_, cb) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const callback = vi.fn();
    subscribeToAuthChanges(callback);

    capturedCallback!(user);
    expect(callback).toHaveBeenCalledWith(user);
  });

  it('invokes callback with null on sign-out', () => {
    let capturedCallback: ((u: null) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_, cb) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const callback = vi.fn();
    subscribeToAuthChanges(callback);

    capturedCallback!(null);
    expect(callback).toHaveBeenCalledWith(null);
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthCurrentUser.value = null;
  });

  it('returns null when no user is authenticated', () => {
    mockAuthCurrentUser.value = null;
    expect(getCurrentUser()).toBeNull();
  });

  it('returns the current user when authenticated', () => {
    const user = makeUser('current-uid');
    mockAuthCurrentUser.value = user;
    expect(getCurrentUser()).toBe(user);
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithPopup and returns the user', async () => {
    const user = makeUser('google-uid', 'google@example.com', 'Google User');
    mockSignInWithPopup.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    const result = await signInWithGoogle();

    expect(mockSignInWithPopup).toHaveBeenCalledOnce();
    expect(result).toBe(user);
  });

  it('creates a Firestore user document on first Google sign-in', async () => {
    const user = makeUser('google-uid-2', 'g2@example.com', 'Alice');
    mockSignInWithPopup.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await signInWithGoogle();

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const docData = mockSetDoc.mock.calls[0][1];
    expect(docData.email).toBe('g2@example.com');
    expect(docData.username).toBe('Alice'); // uses displayName
  });

  it('skips creating Firestore document when user doc already exists', async () => {
    const user = makeUser('returning-google-uid');
    mockSignInWithPopup.mockResolvedValue({ user });
    mockGetDoc.mockResolvedValue({ exists: () => true });

    await signInWithGoogle();

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('propagates errors from signInWithPopup', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('auth/popup-blocked'));

    await expect(signInWithGoogle()).rejects.toThrow('auth/popup-blocked');
  });
});

describe('resetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls sendPasswordResetEmail with the given address', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    await resetPassword('user@example.com');

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'user@example.com');
  });

  it('resolves without a value on success', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    await expect(resetPassword('user@example.com')).resolves.toBeUndefined();
  });

  it('propagates errors from sendPasswordResetEmail', async () => {
    mockSendPasswordResetEmail.mockRejectedValue(new Error('auth/user-not-found'));

    await expect(resetPassword('ghost@example.com')).rejects.toThrow('auth/user-not-found');
  });
});
