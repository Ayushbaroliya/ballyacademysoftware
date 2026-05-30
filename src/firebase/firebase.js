import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { mockFirestore, mockAuth } from './mockService';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const useMocks = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here' || import.meta.env.VITE_USE_MOCKS === 'true';

let app;
let db;
let auth;

if (useMocks) {
  console.warn("⚠️ Running in MOCK MODE. No data will be saved to the cloud.");
  app = { name: '[MockApp]' };
  db = mockFirestore;
  auth = mockAuth;
} else {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("✅ Firebase initialized successfully.");
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    db = mockFirestore;
    auth = mockAuth;
  }
}

export { db, auth, firebaseConfig };
export default app;
