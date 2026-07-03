// ─────────────────────────────────────────────────────────────
// Firebase Configuration – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from 'firebase/functions';
import { getDataConnect, connectDataConnectEmulator, type DataConnect } from 'firebase/data-connect';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { connectorConfig } from '../generated/dataconnect';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const analytics: Analytics | null = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const functions: Functions = getFunctions(app);
const dataConnect: DataConnect = getDataConnect(connectorConfig);

const firebaseProjectId = firebaseConfig.projectId;
const firebaseFunctionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const useFirebaseEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const configuredFunctionsBaseUrl = (import.meta.env.VITE_FUNCTIONS_BASE_URL || '').replace(/\/$/, '');
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const firebaseRuntime = {
  mode: useFirebaseEmulators ? 'emulator' : 'production',
  useEmulators: useFirebaseEmulators,
  projectId: firebaseProjectId,
  functionsRegion: firebaseFunctionsRegion,
  functionsBaseUrl: configuredFunctionsBaseUrl,
  apiBaseUrl: configuredApiBaseUrl,
} as const;

export function getHttpsFunctionUrl(functionName: string): string {
  if (!firebaseProjectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is required to call Firebase Functions.');
  }

  if (configuredFunctionsBaseUrl) {
    return `${configuredFunctionsBaseUrl}/${functionName}`;
  }

  if (useFirebaseEmulators) {
    return `http://127.0.0.1:5001/${firebaseProjectId}/${firebaseFunctionsRegion}/${functionName}`;
  }

  return `https://${firebaseFunctionsRegion}-${firebaseProjectId}.cloudfunctions.net/${functionName}`;
}

export function getApiRouteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (configuredApiBaseUrl) {
    return `${configuredApiBaseUrl}${normalizedPath}`;
  }

  if (useFirebaseEmulators) {
    return `${getHttpsFunctionUrl('api')}/api${normalizedPath}`;
  }

  return `/api${normalizedPath}`;
}

// ── Emulator Connection (guarded against HMR double-connect) ──
const emulatorState = globalThis as typeof globalThis & {
  __GARAGE_CRM_FIREBASE_EMULATORS_CONNECTED__?: boolean;
};

if (useFirebaseEmulators && !emulatorState.__GARAGE_CRM_FIREBASE_EMULATORS_CONNECTED__) {
  emulatorState.__GARAGE_CRM_FIREBASE_EMULATORS_CONNECTED__ = true;

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectDataConnectEmulator(dataConnect, '127.0.0.1', 9399);

  console.info(
    'Firebase emulators connected (Auth:9099, Firestore:8080, Functions:5001, DataConnect:9399)'
  );
}

export { app, analytics, db, auth, functions, dataConnect };
