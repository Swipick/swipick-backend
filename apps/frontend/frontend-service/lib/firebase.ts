import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only in the browser; avoid server/prerender init
const isBrowser = typeof window !== 'undefined';
const app: FirebaseApp | null = isBrowser
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

// Initialize Firebase Authentication (browser only); provide a typed placeholder on server
export const auth: Auth = (app ? getAuth(app) : (undefined as unknown as Auth));

// Set persistence for auth (helps with redirect flow)
if (isBrowser && auth) {
  import('firebase/auth').then(({ setPersistence, browserLocalPersistence }) => {
    setPersistence(auth, browserLocalPersistence).catch(error => {
      console.error('Error setting persistence:', error);
    });
  });
}

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Set custom parameters for Google OAuth
googleProvider.setCustomParameters({
  prompt: 'select_account' // Always show account selector
});

export default app;
