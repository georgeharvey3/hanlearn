import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { type FirebasePerformance, getPerformance } from 'firebase/performance';
import { type Analytics, getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Firebase Performance and Analytics — production only (no emulators available)
export let perf: FirebasePerformance | null = null;
export let analytics: Analytics | null = null;

if (!import.meta.env.DEV) {
  perf = getPerformance(app);
  analytics = getAnalytics(app);
}

// Connect to emulators in development mode
if (import.meta.env.DEV) {
  console.log('Connecting to Firebase emulators...');
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8082);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;
