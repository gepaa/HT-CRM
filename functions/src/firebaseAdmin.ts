import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

if (admin.apps.length === 0) {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.VITE_USE_EMULATORS === 'true';
  let initialized = false;

  if (!isEmulator) {
    const possiblePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH,
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join(process.cwd(), 'functions', 'serviceAccountKey.json'),
      path.join(__dirname, '..', 'serviceAccountKey.json'),
      path.join(__dirname, '..', '..', 'serviceAccountKey.json'),
    ].filter((p): p is string => !!p);

    for (const p of possiblePaths) {
      const absolutePath = path.resolve(p);
      if (fs.existsSync(absolutePath)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log(`[Firebase Admin] Initialized with service account from: ${absolutePath}`);
          initialized = true;
          break;
        } catch (error) {
          console.error(`[Firebase Admin] Error initializing with key at ${absolutePath}:`, error);
        }
      }
    }
  }

  if (!initialized) {
    admin.initializeApp();
    if (isEmulator) {
      console.log('[Firebase Admin] Initialized in emulator mode.');
    } else {
      console.log('[Firebase Admin] Initialized with application default credentials.');
    }
  }
}

const db = admin.firestore();

export { admin, db };

