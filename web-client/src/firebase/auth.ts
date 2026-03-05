import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export type { User };

/**
 * Ensures a user document exists in Firestore.
 * Creates one if it doesn't exist (used for Google sign-ins and registration).
 */
const ensureUserDocument = async (user: User): Promise<void> => {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      email: user.email,
      username: user.displayName || user.email || 'User',
      createdAt: serverTimestamp(),
    });
  }
};

/**
 * Register a new user with email and password.
 * Also creates a user document in Firestore.
 */
export const registerUser = async (email: string, password: string): Promise<User> => {
  const userCredential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  await ensureUserDocument(userCredential.user);

  return userCredential.user;
};

/**
 * Sign in with Google using popup.
 * Creates a Firestore user document if this is the first sign-in.
 */
export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const userCredential = await signInWithPopup(auth, provider);
  await ensureUserDocument(userCredential.user);

  return userCredential.user;
};

/**
 * Sign in an existing user with email and password.
 */
export const loginUser = async (email: string, password: string): Promise<User> => {
  const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

/**
 * Sign out the current user.
 */
export const logoutUser = (): Promise<void> => signOut(auth);

/**
 * Subscribe to authentication state changes.
 * Returns an unsubscribe function.
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get the current authenticated user (synchronously).
 * Returns null if not authenticated.
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
