import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'students';

// --- CREATE ---
export const addStudent = async (studentData) => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...studentData,
    createdAt: serverTimestamp(),
    // Legacy compatibility — keep feesDue computed if old fields present
    feesDue: (studentData.totalFees || 0) - (studentData.feesPaid || 0),
    // New smart fee fields — default to 0 months paid
    totalMonthsPaid: Number(studentData.totalMonthsPaid) || 0,
    monthlyFees:     Number(studentData.monthlyFees) || 0,
    // Ensure active status
    status: studentData.status || 'active',
  });
  return ref.id;
};

// --- READ ONE ---
export const getStudent = async (studentId) => {
  const snap = await getDoc(doc(db, COLLECTION, studentId));
  return snap.exists() ? { studentId: snap.id, ...snap.data() } : null;
};

// --- READ ALL (includes removed for admin management) ---
export const getAllStudents = async () => {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ studentId: d.id, ...d.data() }));
};

// --- SEARCH / FILTER ---
export const getStudentsByStatus = async (status) => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('status', '==', status))
  );
  return snap.docs.map((d) => ({ studentId: d.id, ...d.data() }));
};

export const getStudentsByBatch = async (batchId) => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('batchId', '==', batchId))
  );
  return snap.docs.map((d) => ({ studentId: d.id, ...d.data() }));
};

// --- UPDATE ---
export const updateStudent = async (studentId, updates) => {
  const ref = doc(db, COLLECTION, studentId);
  if ('feesPaid' in updates || 'totalFees' in updates) {
    const current = await getDoc(ref);
    const data = current.data();
    const totalFees = updates.totalFees ?? data.totalFees ?? 0;
    const feesPaid  = updates.feesPaid  ?? data.feesPaid  ?? 0;
    updates.feesDue = totalFees - feesPaid;
  }
  await updateDoc(ref, updates);
};

// --- HARD DELETE (kept for internal use if ever needed) ---
export const deleteStudent = async (studentId) => {
  await deleteDoc(doc(db, COLLECTION, studentId));
};

// --- SOFT REMOVE (marks as removed — keeps data intact) ---
export const softRemoveStudent = async (studentId) => {
  const ref = doc(db, COLLECTION, studentId);
  await updateDoc(ref, {
    status:    'removed',
    removedAt: serverTimestamp(),
  });
};

// --- RESTORE REMOVED STUDENT ---
export const restoreStudent = async (studentId) => {
  const ref = doc(db, COLLECTION, studentId);
  await updateDoc(ref, {
    status:    'active',
    removedAt: null,
  });
};

// --- REAL-TIME LISTENER (returns ALL students — let UI filter) ---
export const subscribeToStudents = (callback) => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ studentId: d.id, ...d.data() })));
  });
};

// --- REAL-TIME LISTENER — ACTIVE STUDENTS ONLY ---
export const subscribeToActiveStudents = (callback) => {
  const q = query(
    collection(db, COLLECTION),
    where('status', '!=', 'removed'),
    orderBy('status'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ studentId: d.id, ...d.data() })));
  });
};
