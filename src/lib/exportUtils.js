import * as XLSX from 'xlsx';
import {
  calcPendingMonths,
  calcDueAmount,
} from './feeCalculations';

/**
 * Generic XLSX/CSV export utility.
 * @param {Array}  data      - Array of plain objects
 * @param {string} fileName  - Output filename (without extension)
 * @param {string} format    - 'xlsx' | 'csv'
 */
export const exportData = (data, fileName = 'export', format = 'xlsx') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const worksheet  = XLSX.utils.json_to_sheet(data);
  const workbook   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const ext  = format === 'csv' ? 'csv' : 'xlsx';
  XLSX.writeFile(workbook, `${fileName}.${ext}`);
};

/** Format students for export (strip Firestore metadata) */
export const formatStudentsForExport = (students) =>
  students.map((s) => ({
    'Student ID':      s.studentId || '',
    'Full Name':       s.fullName  || s.name || '',
    'Father Name':     s.fatherName || '',
    'Contact':         s.contactNumber || s.mobile || '',
    'Date of Birth':   s.dateOfBirth || s.dob || '',
    'Address':         s.address || '',
    'Hostel Type':     s.hostelType || s.type || '',
    'Joining Date':    s.joiningDate || s.joinDate || '',
    'Coach':           s.assignedCoachId || s.coach || '',
    'Batch':           s.batchId || '',
    'Monthly Fees':    s.monthlyFees || 0,
    'Months Paid':     s.totalMonthsPaid || 0,
    'Months Pending':  calcPendingMonths(s),
    'Due Amount (₹)':  calcDueAmount(s),
    'Legacy Total Fees': s.totalFees || 0,
    'Legacy Fees Paid':  s.feesPaid  || 0,
    'Dress Given':     s.dressGiven ? 'Yes' : 'No',
    'Status':          s.status || 'active',
  }));

/** Format attendance for export */
export const formatAttendanceForExport = (records) =>
  records.map((r) => ({
    'Student ID': r.studentId || '',
    'Date':       r.date      || '',
    'Status':     r.present   ? 'Present' : 'Absent',
    'Batch ID':   r.batchId   || '',
    'Coach ID':   r.coachId   || '',
    'Marked By':  r.markedBy  || '',
  }));

/** Format payments for export */
export const formatPaymentsForExport = (payments) =>
  payments.map((p) => ({
    'Payment ID':    p.paymentId   || '',
    'Student ID':    p.studentId   || '',
    'Amount (₹)':    p.amount      || 0,
    'Months Paid':   p.monthsPaid  || 0,
    'Payment Date':  p.paymentDate || '',
    'Mode':          p.paymentMode || '',
    'Remarks':       p.remarks     || '',
    'Received By':   p.receivedBy  || '',
  }));

/** Format coaches for export */
export const formatCoachesForExport = (coaches) =>
  coaches.map((c) => ({
    'Coach ID':       c.coachId        || '',
    'Name':           c.name           || '',
    'Phone':          c.phone          || '',
    'Specialization': c.specialization || '',
    'Batches':        (c.assignedBatchIds || []).join(', '),
  }));

/**
 * Format due fees students for export — uses DYNAMIC due calculation.
 * Only includes active, overdue students.
 */
export const formatDueFeesForExport = (students) =>
  students
    .filter(s => s.status !== 'removed')
    .map((s) => {
      const pendingMonths = calcPendingMonths(s);
      const dueAmount     = calcDueAmount(s);
      return {
        'Student Name':     s.fullName || s.name || '',
        'Contact':          s.contactNumber || s.mobile || s.parentPhone || '—',
        'Batch':            s.batchId || '—',
        'Coach':            s.assignedCoachId || s.coach || '—',
        'Join Date':        s.joiningDate || s.joinDate || '—',
        'Monthly Fee (₹)':  s.monthlyFees || 0,
        'Months Paid':      s.totalMonthsPaid || 0,
        'Months Pending':   pendingMonths,
        'Due Amount (₹)':   dueAmount,
        'Severity':         pendingMonths >= 3 ? 'HIGH' : pendingMonths === 2 ? 'MEDIUM' : 'LOW',
      };
    })
    .sort((a, b) => b['Months Pending'] - a['Months Pending']);

/**
 * Generate WhatsApp-style due list text.
 * Returns a plain text string with bullet points.
 */
export const generateWhatsAppDueList = (students) => {
  const dueStudents = students
    .filter(s => s.status !== 'removed')
    .map(s => ({ ...s, pendingMonths: calcPendingMonths(s), dueAmount: calcDueAmount(s) }))
    .filter(s => s.pendingMonths > 0)
    .sort((a, b) => b.pendingMonths - a.pendingMonths);

  if (dueStudents.length === 0) return 'No pending fee students. ✅';

  const total = dueStudents.reduce((sum, s) => sum + s.dueAmount, 0);
  const lines = [
    '📋 *Bally Academy — Pending Fees*',
    `📅 Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    ...dueStudents.map((s, i) => {
      const name   = s.fullName || s.name || 'Student';
      const months = s.pendingMonths;
      const due    = s.dueAmount;
      return `${i + 1}. *${name}* — ₹${due.toLocaleString()} (${months} month${months > 1 ? 's' : ''})`;
    }),
    '',
    `💰 *Total Pending: ₹${total.toLocaleString()}*`,
    '',
    '_Please submit fees at the earliest. Thank you! 🏏_',
  ];

  return lines.join('\n');
};
