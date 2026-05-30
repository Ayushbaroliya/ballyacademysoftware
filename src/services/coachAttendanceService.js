import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'coach_attendance';

/**
 * Submit a full batch of coach attendance records for a given date.
 * Deletes any existing records for this date first to allow overwriting.
 * records: [{ coachId, present, markedBy }]
 */
export const submitCoachAttendance = async (records, markedBy, date) => {
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
      coachId:   r.coachId,
      date:      dateStr,
      present:   r.present,
      markedBy:  r.markedBy || markedBy,
      createdAt: serverTimestamp(),
    })
  );
  await Promise.all(writes);
};

/** Get coach attendance for a specific date */
export const getCoachAttendanceToday = async () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('date', '==', todayStr))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getCoachAttendanceHistory = async (coachId) => {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId)
    )
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => new Date(b.date) - new Date(a.date));
};

/** Get all coach attendance records for a specific date */
export const getCoachAttendanceByDate = async (date) => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('date', '==', date))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Get all coach attendance records */
export const getAllCoachAttendance = async () => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('date', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Subscribe to all coach attendance records in real time */
export const subscribeToCoachAttendance = (callback) => {
  const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const adminMarkCheckIn = async (coachId, coachName, date, checkInTime, notes, markedBy) => {
  await addDoc(collection(db, COLLECTION), {
    coachId,
    coachName: coachName || '',
    date: date || new Date().toISOString().split('T')[0],
    checkIn: checkInTime,
    notes: notes || '',
    status: 'checked-in',
    present: true,
    markedBy: markedBy || 'admin',
    createdAt: serverTimestamp(),
  });
};

export const adminMarkCheckOut = async (recordId, checkOutTime, checkoutNotes) => {
  const recordRef = doc(db, COLLECTION, recordId);
  await updateDoc(recordRef, {
    checkOut: checkOutTime,
    checkoutNotes: checkoutNotes || '',
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
};

export const adminCreateFullRecord = async (coachId, coachName, date, checkIn, checkOut, notes, checkoutNotes, markedBy) => {
  let duration = 0;
  if (checkIn && checkOut) {
    duration = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60));
  }
  await addDoc(collection(db, COLLECTION), {
    coachId,
    coachName: coachName || '',
    date: date || new Date().toISOString().split('T')[0],
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    notes: notes || '',
    checkoutNotes: checkoutNotes || '',
    status: checkOut ? 'checked-out' : 'checked-in',
    present: true,
    duration,
    markedBy: markedBy || 'admin',
    createdAt: serverTimestamp(),
  });
};

export const adminUpdateAttendance = async (recordId, data) => {
  const recordRef = doc(db, COLLECTION, recordId);
  const updates = { ...data };
  if (updates.checkIn && updates.checkOut) {
    updates.duration = Math.round((new Date(updates.checkOut) - new Date(updates.checkIn)) / (1000 * 60));
  } else if (updates.checkOut === null) {
    updates.duration = 0;
  }
  await updateDoc(recordRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const adminDeleteAttendance = async (recordId) => {
  await deleteDoc(doc(db, COLLECTION, recordId));
};
