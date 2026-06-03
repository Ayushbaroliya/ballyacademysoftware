/**
 * feeCalculations.js
 * Core dynamic due calculation engine for JPicket Academy ERP.
 * Calculations are based purely on elapsed time and financial amounts (feesPaid).
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
  
  // PREPAID LOGIC: Always add 1 month because fees are collected in advance for the current month
  return Math.max(0, total) + 1;
};

/**
 * Core engine logic: expected vs paid model.
 */
export const getStudentBalance = (student) => {
  const joinDate    = student.joinDate || student.joiningDate || null;
  const monthlyFees = Number(student.monthlyFees) || 0;
  
  let isValidDate = false;
  if (joinDate) {
    const parsed = new Date(joinDate);
    if (!isNaN(parsed.getTime())) {
      isValidDate = true;
    }
  }

  const totalPaid = Number(student.feesPaid) || 0;

  if (isValidDate && monthlyFees > 0) {
    const passedMonths = calcMonthsPassed(joinDate);
    const totalExpected = passedMonths * monthlyFees;
    
    const netBalance = totalExpected - totalPaid;
    
    return {
       netBalance: netBalance,
       dueAmount: netBalance > 0 ? netBalance : 0,
       advanceAmount: netBalance < 0 ? Math.abs(netBalance) : 0,
       pendingMonths: netBalance > 0 ? (netBalance / monthlyFees) : 0
    };
  }

  return {
       netBalance: 0,
       dueAmount: 0,
       advanceAmount: 0,
       pendingMonths: 0
  };
};

// Wrappers for backward compatibility in generic components
export const calcDueAmount = (student) => getStudentBalance(student).dueAmount;
export const calcPendingMonths = (student) => getStudentBalance(student).pendingMonths;
export const calcNetBalance = (student) => getStudentBalance(student).netBalance;

export const getDueSeverity = (student) => {
  const { netBalance, pendingMonths } = getStudentBalance(student);
  if (netBalance < 0) return 'advance';
  if (pendingMonths <= 0) return 'clear';
  if (pendingMonths <= 1) return 'yellow';
  if (pendingMonths <= 2) return 'orange';
  return 'red';
};

export const getSeverityBorderClass = (severity) => {
  switch (severity) {
    case 'advance': return 'border-emerald-400/50 shadow-emerald-400/10 shadow-lg';
    case 'yellow': return 'border-yellow-400/50 shadow-yellow-400/10 shadow-lg';
    case 'orange': return 'border-orange-400/60 shadow-orange-400/20 shadow-lg';
    case 'red':    return 'border-red-500/70 shadow-red-500/25 shadow-xl';
    default:       return 'border-white/5';
  }
};

export const getSeverityBadgeClass = (severity) => {
  switch (severity) {
    case 'advance': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'yellow': return 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30';
    case 'orange': return 'bg-orange-400/15 text-orange-400 border border-orange-400/30';
    case 'red':    return 'bg-red-500/15 text-red-400 border border-red-500/30';
    default:       return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
};

export const getSeverityLabel = (student) => {
  const { advanceAmount, dueAmount, pendingMonths } = getStudentBalance(student);
  if (advanceAmount > 0) return `✓ ₹${advanceAmount.toLocaleString()} Advance`;
  if (dueAmount === 0) return '✓ Clear';
  
  if (pendingMonths % 1 === 0 && pendingMonths > 0) {
      if (pendingMonths === 1) return '⚠ 1 Month Due';
      return `🔴 ${pendingMonths} Months Due`;
  }
  
  return `⚠ ₹${dueAmount.toLocaleString()} Due`;
};

export const isStudentDue = (student) => {
  if (student.status === 'removed' || student.status === 'inactive') return false;
  return getStudentBalance(student).dueAmount > 0;
};

export const sortByOverdue = (students) => {
  return [...students].sort((a, b) => getStudentBalance(b).dueAmount - getStudentBalance(a).dueAmount);
};

export const sortByDueAmount = (students) => {
  return [...students].sort((a, b) => getStudentBalance(b).dueAmount - getStudentBalance(a).dueAmount);
};

export const sortByNewest = (students) => {
  return [...students].sort((a, b) => getStudentBalance(a).dueAmount - getStudentBalance(b).dueAmount);
};

export const calcTotalPendingRevenue = (students) => {
  return students
    .filter(s => s.status !== 'removed' && s.status !== 'inactive')
    .reduce((sum, s) => sum + getStudentBalance(s).dueAmount, 0);
};

export const calcExpectedMonthlyRevenue = (students) => {
  return students
    .filter(s => s.status !== 'removed' && s.status !== 'inactive')
    .reduce((sum, s) => sum + (Number(s.monthlyFees) || 0), 0);
};

export const formatCurrency = (val) => {
  const n = Number(val) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
};
