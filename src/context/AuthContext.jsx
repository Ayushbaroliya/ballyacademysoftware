import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          // Auto-initialize roles for known emails if doc doesn't exist or is incorrect
          const email = firebaseUser.email;
          let roleToSet = null;
          if (email === 'deeptisonkar34@gmail.com' || email === 'deeptisonkar@ballyacademy.com') {
            roleToSet = 'admin';
          } else if (email === 'sharmabro.27@gmail.com') {
            roleToSet = 'coach';
          }

          let expectedName = 'Sharma Coach';
          if (roleToSet === 'admin') {
            expectedName = 'Hello Bally Sir';
          }

          if (roleToSet && (!userDoc.exists() || userDoc.data().role !== roleToSet || userDoc.data().name !== expectedName)) {
            const userRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(userRef, {
              email: email,
              name: expectedName,
              role: roleToSet
            }, { merge: true });
            
            // Re-fetch doc to ensure state is correct
            userDoc = await getDoc(userRef);
          }

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...userData });
            setRole(userData.role);
          } else {
            // Fallback: user exists in Auth but not in Firestore
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: 'coach' });
            setRole('coach');
          }
        } catch (err) {
          console.error('Error fetching user role:', err);
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const isAdmin = () => role === 'admin';
  const isCoach = () => role === 'coach' || role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, isAdmin, isCoach }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
