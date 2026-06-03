import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'attendance';

/**
 * Submit a full batch of attendance records for a given date.
 * Deletes any existing records for this date first to allow overwriting.
 * records: [{ studentId, present, batchId, coachId }]
 */
export const submitAttendance = async (records, markedBy, date) => {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  // Get existing records for this date
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('date', '==', dateStr))
  );
  
  // Delete existing records to allow overwriting
  const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, COLLECTION, d.id)));
  await Promise.all(deletePromises);

  const writes  = records.map((r) =>
    addDoc(collection(db, COLLECTION), {
      studentId: r.studentId,
      date:      dateStr,
      present:   r.present,
      batchId:   r.batchId  || '',
      coachId:   r.coachId  || '',
      markedBy:  markedBy,
      createdAt: serverTimestamp(),
    })
  );
  await Promise.all(writes);
};

/** Get attendance for a specific date */
export const getAttendanceByDate = async (date) => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('date', '==', date))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Get attendance for a specific student */
export const getAttendanceByStudent = async (studentId) => {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId)
    )
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => new Date(b.date) - new Date(a.date));
};

/** Get attendance by coach (for coach-view filtering) */
export const getAttendanceByCoach = async (coachId) => {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId)
    )
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => new Date(b.date) - new Date(a.date));
};

/** Real-time attendance for a given date */
export const subscribeToAttendanceByDate = (date, callback) => {
  const q = query(collection(db, COLLECTION), where('date', '==', date));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};
