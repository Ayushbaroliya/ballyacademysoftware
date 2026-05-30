import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVaQjtI4noDRFlx9i-P58dHfckdI4yB6Y",
  authDomain: "ballicricket-7b685.firebaseapp.com",
  projectId: "ballicricket-7b685",
  storageBucket: "ballicricket-7b685.firebasestorage.app",
  messagingSenderId: "422255784297",
  appId: "1:422255784297:web:299c2fe30247dabdd14df8",
  measurementId: "G-7P059Y7PLS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, firebaseConfig, analytics };
export default app;
