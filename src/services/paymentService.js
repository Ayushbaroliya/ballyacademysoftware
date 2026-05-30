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
  increment,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateStudent } from './studentService';

const COLLECTION = 'payments';

/**
 * Record a payment and auto-update the student's fee fields.
 * Supports both new (monthsPaid) and legacy (amount-based) models.
 *
 * @param {object} paymentData
 * @param {string}  paymentData.studentId
 * @param {number}  paymentData.amount         - ₹ amount paid
 * @param {number}  [paymentData.monthsPaid]   - number of months being cleared (new model)
 * @param {string}  paymentData.paymentDate
 * @param {string}  paymentData.paymentMode    - Cash | UPI | Bank Transfer | Cheque
 * @param {string}  [paymentData.remarks]
 * @param {string}  [paymentData.receivedBy]
 */
export const addPayment = async (paymentData) => {
  const amount     = Number(paymentData.amount)     || 0;
  const monthsPaid = Number(paymentData.monthsPaid) || 0;

  // Save the payment record
  const ref = await addDoc(collection(db, COLLECTION), {
    ...paymentData,
    amount,
    monthsPaid,
    createdAt: serverTimestamp(),
  });

  // Update the student document
  if (paymentData.studentId) {
    const studentRef  = doc(db, 'students', paymentData.studentId);
    const studentSnap = await getDoc(studentRef);

    if (studentSnap.exists()) {
      const studentData = studentSnap.data();
      const updates     = {};

      // --- New model: increment totalMonthsPaid ---
      if (monthsPaid > 0) {
        updates.totalMonthsPaid = (Number(studentData.totalMonthsPaid) || 0) + monthsPaid;
      }

      // --- Legacy model: increment feesPaid, recalc feesDue ---
      if (amount > 0) {
        const currentPaid  = Number(studentData.feesPaid)  || 0;
        const totalFees    = Number(studentData.totalFees)  || 0;
        const newPaid      = currentPaid + amount;
        updates.feesPaid   = newPaid;
        updates.feesDue    = Math.max(0, totalFees - newPaid);
        updates.lastPayment = paymentData.paymentDate || new Date().toISOString().split('T')[0];
      }

      await updateDoc(studentRef, updates);
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
 * If monthsPaid changes, the delta is applied to student's totalMonthsPaid.
 */
export const updatePayment = async (paymentId, updates, oldPayment) => {
  const payRef = doc(db, COLLECTION, paymentId);
  await updateDoc(payRef, { ...updates, updatedAt: serverTimestamp() });

  // Adjust student's totalMonthsPaid if monthsPaid changed
  if (oldPayment?.studentId && updates.monthsPaid !== undefined) {
    const oldMonths = Number(oldPayment.monthsPaid) || 0;
    const newMonths = Number(updates.monthsPaid) || 0;
    const delta = newMonths - oldMonths;
    if (delta !== 0) {
      const studentRef = doc(db, 'students', oldPayment.studentId);
      const snap = await getDoc(studentRef);
      if (snap.exists()) {
        const current = Number(snap.data().totalMonthsPaid) || 0;
        await updateDoc(studentRef, {
          totalMonthsPaid: Math.max(0, current + delta),
        });
      }
    }
  }
};

/**
 * Permanently delete a payment and reverse the student's totalMonthsPaid.
 */
export const deletePayment = async (paymentId, oldPayment) => {
  await deleteDoc(doc(db, COLLECTION, paymentId));

  if (oldPayment?.studentId && (oldPayment.monthsPaid || 0) > 0) {
    const studentRef = doc(db, 'students', oldPayment.studentId);
    const snap = await getDoc(studentRef);
    if (snap.exists()) {
      const current = Number(snap.data().totalMonthsPaid) || 0;
      await updateDoc(studentRef, {
        totalMonthsPaid: Math.max(0, current - (Number(oldPayment.monthsPaid) || 0)),
      });
    }
  }
};
