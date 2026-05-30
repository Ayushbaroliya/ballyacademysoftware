import {
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

/** Login with email/password */
export const loginUser = async (email, password) => {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
};

/** Logout current user */
export const logoutUser = async () => {
  return signOut(auth);
};

/** Get user profile from Firestore */
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
};

/**
 * Create or update a user in the Firestore users collection.
 * Called after Firebase Auth creates the user (e.g., admin seeding).
 */
export const upsertUserProfile = async ({ uid, name, role, phone, email }) => {
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      name:      name  || '',
      role:      role  || 'coach',
      phone:     phone || '',
      email:     email || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
