import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'payments';

/**
 * Record a payment and auto-update the student's feesPaid cache.
 *
 * @param {object} paymentData
 * @param {string}  paymentData.studentId
 * @param {number}  paymentData.amount         - ₹ amount paid
 * @param {string}  paymentData.paymentDate
 * @param {string}  paymentData.paymentMode    - Cash | UPI | Bank Transfer | Cheque
 * @param {string}  [paymentData.remarks]
 * @param {string}  [paymentData.receivedBy]
 */
export const addPayment = async (paymentData) => {
  const amount = Number(paymentData.amount) || 0;

  // Save the payment record
  const ref = await addDoc(collection(db, COLLECTION), {
    ...paymentData,
    amount,
    createdAt: serverTimestamp(),
  });

  // Update the student document feesPaid cache
  if (paymentData.studentId && amount > 0) {
    const studentRef  = doc(db, 'students', paymentData.studentId);
    const studentSnap = await getDoc(studentRef);

    if (studentSnap.exists()) {
      const studentData = studentSnap.data();
      const currentPaid = Number(studentData.feesPaid) || 0;
      
      await updateDoc(studentRef, {
        feesPaid: currentPaid + amount,
        lastPayment: paymentData.paymentDate || new Date().toISOString().split('T')[0]
      });
    }
  }

  return ref.id;
};

/** Get all payments for a specific student, newest first */
export const getPaymentsByStudent = async (studentId) => {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId)
    )
  );
  const docs = snap.docs.map((d) => ({ paymentId: d.id, ...d.data() }));
  return docs.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
};

/** Get all payments */
export const getAllPayments = async () => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ paymentId: d.id, ...d.data() }));
};

/** Sum all collected fees */
export const getTotalCollected = async () => {
  const payments = await getAllPayments();
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
};

/**
 * Get total collected for a specific month (YYYY-MM).
 * Matches paymentDate field.
 */
export const getMonthlyCollected = async (yearMonth) => {
  const all = await getAllPayments();
  return all
    .filter(p => (p.paymentDate || '').startsWith(yearMonth))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
};

/**
 * Get collected totals for last N months.
 * Returns array of { month: 'YYYY-MM', collected: number }
 */
export const getMonthlyCollectedTrend = async (months = 6) => {
  const all = await getAllPayments();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const collected = all
      .filter(p => (p.paymentDate || '').startsWith(ym))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    result.push({ month: ym, label, collected });
  }

  return result;
};

/**
 * Edit an existing payment record.
 * Adjusts the student's feesPaid cache by the delta.
 */
export const updatePayment = async (paymentId, updates, oldPayment) => {
  const payRef = doc(db, COLLECTION, paymentId);
  await updateDoc(payRef, { ...updates, updatedAt: serverTimestamp() });

  // Adjust student fields if payment amount changed
  if (oldPayment?.studentId && updates.amount !== undefined) {
    const studentRef = doc(db, 'students', oldPayment.studentId);
    const snap = await getDoc(studentRef);
    
    if (snap.exists()) {
      const studentData = snap.data();
      const oldAmount = Number(oldPayment.amount) || 0;
      const newAmount = Number(updates.amount) || 0;
      const amountDelta = newAmount - oldAmount;
      
      if (amountDelta !== 0) {
        const currentPaid = Number(studentData.feesPaid) || 0;
        await updateDoc(studentRef, {
           feesPaid: Math.max(0, currentPaid + amountDelta)
        });
      }
    }
  }
};

/**
 * Permanently delete a payment and reverse the student's feesPaid cache.
 */
export const deletePayment = async (paymentId, oldPayment) => {
  await deleteDoc(doc(db, COLLECTION, paymentId));

  if (oldPayment?.studentId && (oldPayment.amount || 0) > 0) {
    const studentRef = doc(db, 'students', oldPayment.studentId);
    const snap = await getDoc(studentRef);
    
    if (snap.exists()) {
      const studentData = snap.data();
      const currentPaid = Number(studentData.feesPaid) || 0;
      const amountToRemove = Number(oldPayment.amount) || 0;
      
      await updateDoc(studentRef, {
        feesPaid: Math.max(0, currentPaid - amountToRemove)
      });
    }
  }
};
