/**
 * feeCalculations.js
 * Core dynamic due calculation engine for Bally Academy ERP.
 * All calculations are done at runtime — nothing static stored in DB.
 */

/**
 * Calculate how many whole months have passed since a given date string.
 * @param {string} joinDate - ISO date string "YYYY-MM-DD"
 * @returns {number} whole months elapsed since joinDate
 */
export const calcMonthsPassed = (joinDate) => {
  if (!joinDate) return 0;
  const start = new Date(joinDate);
  const now   = new Date();
  if (isNaN(start.getTime())) return 0;

  const years  = now.getFullYear()  - start.getFullYear();
  const months = now.getMonth()     - start.getMonth();
  const days   = now.getDate()      - start.getDate();

  let total = years * 12 + months;
  // If the current day is before the join day of month, don't count that partial month
  if (days < 0) total -= 1;
  return Math.max(0, total);
};

/**
 * Calculate pending (unpaid) months for a student.
 * Uses new model (monthlyFees + totalMonthsPaid) if available,
 * otherwise falls back gracefully to legacy feesDue > 0 check.
 * @param {object} student
 * @returns {number}
 */
export const calcPendingMonths = (student) => {
  const joinDate = student.joinDate || student.joiningDate || null;
  const totalMonthsPaid = Number(student.totalMonthsPaid) || 0;
  const monthlyFees = Number(student.monthlyFees) || 0;

  // New model: dynamic month-based calculation
  if (joinDate && monthlyFees > 0) {
    const passed  = calcMonthsPassed(joinDate);
    const pending = passed - totalMonthsPaid;
    return Math.max(0, pending);
  }

  // Legacy fallback: derive from feesDue / monthlyFees
  if (monthlyFees > 0 && (student.feesDue || 0) > 0) {
    return Math.max(0, Math.ceil((student.feesDue || 0) / monthlyFees));
  }

  // Last resort: if feesDue exists (old model), show 1 pending month conceptually
  if ((student.feesDue || 0) > 0) return 1;
  return 0;
};

/**
 * Calculate the due amount for a student.
 * @param {object} student
 * @returns {number} amount in ₹
 */
export const calcDueAmount = (student) => {
  const joinDate    = student.joinDate || student.joiningDate || null;
  const monthlyFees = Number(student.monthlyFees) || 0;

  // New model
  if (joinDate && monthlyFees > 0) {
    const pending = calcPendingMonths(student);
    return pending * monthlyFees;
  }

  // Legacy fallback: use stored feesDue
  return Math.max(0, student.feesDue || 0);
};

/**
 * Determine visual severity of a student's due status.
 * @param {number} pendingMonths
 * @returns {'clear'|'yellow'|'orange'|'red'}
 */
export const getDueSeverity = (pendingMonths) => {
  if (pendingMonths <= 0) return 'clear';
  if (pendingMonths === 1) return 'yellow';
  if (pendingMonths === 2) return 'orange';
  return 'red';
};

/**
 * Returns Tailwind classes for border glow based on severity.
 */
export const getSeverityBorderClass = (severity) => {
  switch (severity) {
    case 'yellow': return 'border-yellow-400/50 shadow-yellow-400/10 shadow-lg';
    case 'orange': return 'border-orange-400/60 shadow-orange-400/20 shadow-lg';
    case 'red':    return 'border-red-500/70 shadow-red-500/25 shadow-xl';
    default:       return 'border-white/5';
  }
};

/**
 * Returns Tailwind badge classes for the due severity badge.
 */
export const getSeverityBadgeClass = (severity) => {
  switch (severity) {
    case 'yellow': return 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30';
    case 'orange': return 'bg-orange-400/15 text-orange-400 border border-orange-400/30';
    case 'red':    return 'bg-red-500/15 text-red-400 border border-red-500/30';
    default:       return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
};

/**
 * Returns the badge label text.
 */
export const getSeverityLabel = (pendingMonths) => {
  if (pendingMonths <= 0) return '✓ Clear';
  if (pendingMonths === 1) return '⚠ 1 Month Due';
  if (pendingMonths === 2) return '⚠ 2 Months Due';
  return `🔴 ${pendingMonths} Months Due`;
};

/**
 * Check if a student is currently due (active and has pending months).
 * @param {object} student
 * @returns {boolean}
 */
export const isStudentDue = (student) => {
  if (student.status === 'removed' || student.status === 'inactive') return false;
  return calcPendingMonths(student) > 0;
};

/**
 * Sort students by most overdue first (highest pendingMonths at top).
 * @param {Array} students
 * @returns {Array} sorted copy
 */
export const sortByOverdue = (students) => {
  return [...students].sort((a, b) => calcPendingMonths(b) - calcPendingMonths(a));
};

/**
 * Sort students by highest due amount first.
 */
export const sortByDueAmount = (students) => {
  return [...students].sort((a, b) => calcDueAmount(b) - calcDueAmount(a));
};

/**
 * Sort students by newest due (most recently started owing — least pending months first among due students).
 */
export const sortByNewest = (students) => {
  return [...students].sort((a, b) => calcPendingMonths(a) - calcPendingMonths(b));
};

/**
 * Calculate total pending revenue from an array of active due students.
 * @param {Array} students - active students only
 * @returns {number}
 */
export const calcTotalPendingRevenue = (students) => {
  return students
    .filter(s => s.status !== 'removed' && s.status !== 'inactive')
    .reduce((sum, s) => sum + calcDueAmount(s), 0);
};

/**
 * Calculate expected monthly revenue (sum of monthlyFees for all active students).
 * @param {Array} students - active students only
 * @returns {number}
 */
export const calcExpectedMonthlyRevenue = (students) => {
  return students
    .filter(s => s.status !== 'removed' && s.status !== 'inactive')
    .reduce((sum, s) => sum + (Number(s.monthlyFees) || 0), 0);
};

/**
 * Format a number as Indian currency string (₹1.5L, ₹12K, ₹500)
 */
export const formatCurrency = (val) => {
  const n = Number(val) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
};
