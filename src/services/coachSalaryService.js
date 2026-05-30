import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateCoach, getCoach } from './coachService';

const PAYMENTS_COLLECTION = 'coach_salary_payments';

/**
 * Record a salary payment and auto-update the coach's salaryPaid/salaryDue.
 */
export const recordCoachSalaryPayment = async (paymentData) => {
  const ref = await addDoc(collection(db, PAYMENTS_COLLECTION), {
    ...paymentData,
    amount: Number(paymentData.amount) || 0,
    createdAt: serverTimestamp(),
  });

  // Update coach salary fields
  if (paymentData.coachId && paymentData.amount) {
    const existing = await getCoachSalaryPayments(paymentData.coachId);
    const totalPaid = existing.reduce((sum, p) => sum + (p.amount || 0), 0) + paymentData.amount;
    await updateCoach(paymentData.coachId, { salaryPaid: totalPaid });
  }

  return ref.id;
};

/** Get all salary payments recorded for a specific coach */
export const getCoachSalaryPayments = async (coachId) => {
  const snap = await getDocs(
    query(
      collection(db, PAYMENTS_COLLECTION),
      where('coachId', '==', coachId)
    )
  );
  const docs = snap.docs.map((d) => ({ paymentId: d.id, ...d.data() }));
  return docs.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
};

/** Get all coach salary payments */
export const getAllCoachSalaryPayments = async () => {
  const snap = await getDocs(
    query(collection(db, PAYMENTS_COLLECTION), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ paymentId: d.id, ...d.data() }));
};

/** Get total salary paid across all coaches */
export const getTotalSalaryPaid = async () => {
  const payments = await getAllCoachSalaryPayments();
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
};

const SETTINGS_COLLECTION = 'coach_salary_settings';

export const getCoachSalarySettings = async (coachId) => {
  if (!coachId) return null;
  const docRef = doc(db, SETTINGS_COLLECTION, coachId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : { salaryType: 'monthly', rate: 0 };
};

export const setCoachSalarySettings = async (coachId, settings) => {
  if (!coachId) return;
  const docRef = doc(db, SETTINGS_COLLECTION, coachId);
  await setDoc(docRef, settings, { merge: true });
};

export const calculateEarnedSalary = (attendanceHistory, settings, currentMonth) => {
  if (!settings || !settings.rate) return 0;
  
  // Filter attendance for the current month. Using the presence flag or check-in.
  const monthRecords = (attendanceHistory || []).filter(rec => rec.date?.startsWith(currentMonth) && (rec.present || rec.status === 'checked-out'));
  
  const { salaryType, rate } = settings;
  const numRate = Number(rate) || 0;
  
  if (salaryType === 'monthly') {
    return numRate; // Just base salary
  }
  
  if (salaryType === 'per_session') {
    return monthRecords.length * numRate;
  }
  
  if (salaryType === 'per_hour') {
    const totalMins = monthRecords.reduce((sum, rec) => sum + (Number(rec.duration) || 0), 0);
    const totalHours = totalMins / 60;
    return Math.round(totalHours * numRate);
  }
  
  return 0;
};
