import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/config/env';

// Declare variables outside try-catch block
let app: any;
let auth: any;
let db: any;
let storage: any;

// Initialize Firebase
try {
  console.log('Initializing Firebase with config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    hasApiKey: !!firebaseConfig.apiKey
  });
  
  app = initializeApp(firebaseConfig);
  
  // Initialize Firebase services
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Use emulators in development if needed
  if (import.meta.env.DEV && window.location.hostname === 'localhost') {
    // Uncomment the following lines if you're using Firebase emulators
    // connectFirestoreEmulator(db, 'localhost', 8080);
  }
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  
  // Provide fallback implementations to prevent app crashes
  app = {} as any;
  auth = {} as any;
  db = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => ({}) }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve()
      }),
      where: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      }),
      orderBy: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      }),
      add: () => Promise.resolve({ id: 'dummy-id' })
    })
  } as any;
  storage = {} as any;
}

// Export statements at top level
export { auth, db, storage };
export default app;