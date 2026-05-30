import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'coaches';

export const addCoach = async (coachId, coachData) => {
  await setDoc(doc(db, COLLECTION, coachId), {
    ...coachData,
    coachId,
    assignedBatchIds: coachData.assignedBatchIds || [],
    createdAt: serverTimestamp(),
  });
  return coachId;
};

export const getCoach = async (coachId) => {
  const snap = await getDoc(doc(db, COLLECTION, coachId));
  return snap.exists() ? { coachId: snap.id, ...snap.data() } : null;
};

export const getAllCoaches = async () => {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ coachId: d.id, ...d.data() }));
};

export const updateCoach = async (coachId, updates) => {
  const ref = doc(db, COLLECTION, coachId);
  if ('salaryPaid' in updates || 'totalSalary' in updates) {
    const current = await getDoc(ref);
    const data = current.data() || {};
    const totalSalary = updates.totalSalary ?? data.totalSalary ?? 0;
    const salaryPaid  = updates.salaryPaid  ?? data.salaryPaid  ?? 0;
    updates.salaryDue = totalSalary - salaryPaid;
  }
  await updateDoc(ref, updates);
};

export const deleteCoach = async (coachId) => {
  await deleteDoc(doc(db, COLLECTION, coachId));
};

export const subscribeToCoaches = (callback) => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ coachId: d.id, ...d.data() })));
  });
};
