import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export type { User };

/**
 * Register a new user with email and password.
 * Also creates a user document in Firestore.
 */
export const registerUser = async (
  email: string,
  password: string,
  username?: string
): Promise<User> => {
  const userCredential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Create user document in Firestore
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    email,
    username: username || email,
    createdAt: serverTimestamp(),
  });

  return userCredential.user;
};

/**
 * Sign in an existing user with email and password.
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<User> => {
  const userCredential: UserCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
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
export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get the current authenticated user (synchronously).
 * Returns null if not authenticated.
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
