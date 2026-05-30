import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, IndianRupee, Phone, Mail, Clock, Plus, Edit2, Trash2, 
  Settings, CheckCircle2, AlertCircle, Loader2, ChevronRight, MessageSquare, 
  Briefcase, Wallet, ArrowUpRight, ClipboardList, Play, Square, CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { 
  getCoachSalarySettings, 
  getCoachSalaryPayments, 
  recordCoachSalaryPayment, 
  calculateEarnedSalary 
} from '../services/coachSalaryService';
import { 
  getCoachAttendanceHistory, 
  adminMarkCheckIn, 
  adminMarkCheckOut, 
  adminCreateFullRecord, 
  adminUpdateAttendance, 
  adminDeleteAttendance 
} from '../services/coachAttendanceService';

const CoachDetail = ({ coach, onClose, onEdit, onDelete }) => {
  const { isAdmin, user: currentUser } = useAuth();
  
  // Data states
  const [salarySettings, setSalarySettings] = useState({ salaryType: 'monthly', rate: 15000 });
  const [attendance, setAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Month navigation (for salary and calendar)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Attendance management modal states
  const [showAttModal, setShowAttModal] = useState(false);
  const [attModalMode, setAttModalMode] = useState('add'); // 'add' | 'checkout' | 'edit'
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedCellDate, setSelectedCellDate] = useState('');
  
  const [attForm, setAttForm] = useState({
    date: '',
    checkInTime: '09:00',
    checkOutTime: '17:00',
    logCheckOut: false,
    notes: '',
    checkoutNotes: '',
  });

  // Salary payment modal states
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'UPI',
    remarks: '',
  });

  const [submitting, setSubmitting] = useState(false);

  // Load Coach Data
  const loadCoachData = async () => {
    if (!coach) return;
    setLoadingData(true);
    try {
      const settings = await getCoachSalarySettings(coach.coachId);
      setSalarySettings(settings);

      const attLogs = await getCoachAttendanceHistory(coach.coachId);
      setAttendance(attLogs);

      const pays = await getCoachSalaryPayments(coach.coachId);
      setPayments(pays);
    } catch (err) {
      console.error("Error loading coach detail data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (coach) loadCoachData();
  }, [coach?.coachId, refreshTrigger]);

  // Synchronize Calendar Navigation Date with Selected Month dropdown
  useEffect(() => {
    const [year, month] = selectedMonth.split('-');
    setCalendarDate(new Date(parseInt(year), parseInt(month) - 1, 1));
  }, [selectedMonth]);

  // Early return AFTER all hooks (React Rules of Hooks compliance)
  if (!coach) return null;

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  // Date and Time Helper Functions
  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Generate Calendar Days (42 cells layout)
  const getCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const days = [];
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    
    // Previous month padding
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthDate.getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDaysCount - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month
    const currentMonthDaysCount = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month padding to fill exactly 42 slots
    const totalCells = 42;
    const nextMonthDaysCount = totalCells - days.length;
    for (let i = 1; i <= nextMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    setCalendarDate(newDate);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    setCalendarDate(newDate);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Monthly stats calculations
  const getMonthlyStats = () => {
    const monthRecords = attendance.filter(r => r.date && r.date.startsWith(selectedMonth));
    const presentDays = monthRecords.filter(r => r.present !== false).length;
    const totalMins = monthRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalHours = (totalMins / 60).toFixed(1);
    const completedShifts = monthRecords.filter(r => r.status === 'checked-out');
    const avgShiftMins = completedShifts.length > 0 
      ? Math.round(completedShifts.reduce((sum, r) => sum + (r.duration || 0), 0) / completedShifts.length)
      : 0;

    return { presentDays, totalHours, avgShiftMins };
  };

  const stats = getMonthlyStats();

  // Salary Calculations
  const earnedSalary = calculateEarnedSalary(attendance, salarySettings, selectedMonth);
  const paidSalary = payments
    .filter(p => p.month === selectedMonth)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const dueSalary = Math.max(0, earnedSalary - paidSalary);

  // Wage label formatting
  const getRateLabel = () => {
    if (salarySettings.salaryType === 'monthly') {
      return `₹${(salarySettings.rate || 0).toLocaleString()}/mo`;
    } else if (salarySettings.salaryType === 'per_session') {
      return `₹${(salarySettings.rate || 0).toLocaleString()}/session`;
    } else if (salarySettings.salaryType === 'per_hour') {
      return `₹${(salarySettings.rate || 0).toLocaleString()}/hr`;
    }
    return '';
  };

  const getCalcDetails = () => {
    const monthRecords = attendance.filter(r => r.date && r.date.startsWith(selectedMonth));
    if (salarySettings.salaryType === 'monthly') {
      return 'Flat monthly structure';
    } else if (salarySettings.salaryType === 'per_session') {
      return `${monthRecords.length} sessions completed`;
    } else if (salarySettings.salaryType === 'per_hour') {
      const totalMins = monthRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
      return `${(totalMins / 60).toFixed(1)} hrs worked`;
    }
    return '';
  };

  // Open Add/Edit Attendance Modals
  const handleCellClick = (dayDate) => {
    if (!isAdmin()) return; // Read-only for coaches (though CoachDetail is only rendered for admin anyway)

    const dateKey = formatDateKey(dayDate);
    const record = attendance.find(r => r.date === dateKey);

    if (record) {
      // Edit record
      setSelectedRecord(record);
      setAttModalMode('edit');
      setAttForm({
        date: dateKey,
        checkInTime: record.checkIn ? new Date(record.checkIn).toTimeString().slice(0, 5) : '09:00',
        checkOutTime: record.checkOut ? new Date(record.checkOut).toTimeString().slice(0, 5) : '17:00',
        logCheckOut: !!record.checkOut,
        notes: record.notes || '',
        checkoutNotes: record.checkoutNotes || '',
      });
    } else {
      // Add record
      setSelectedRecord(null);
      setAttModalMode('add');
      const nowHours = new Date().getHours().toString().padStart(2, '0');
      const nowMins = new Date().getMinutes().toString().padStart(2, '0');
      setAttForm({
        date: dateKey,
        checkInTime: `${nowHours}:${nowMins}`,
        checkOutTime: '17:00',
        logCheckOut: false,
        notes: '',
        checkoutNotes: '',
      });
    }
    setSelectedCellDate(dateKey);
    setShowAttModal(true);
  };

  // Handle Attendance Form Submit
  const handleAttSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (attModalMode === 'add') {
        const checkInIso = new Date(`${attForm.date}T${attForm.checkInTime}`).toISOString();
        if (attForm.logCheckOut) {
          const checkOutIso = new Date(`${attForm.date}T${attForm.checkOutTime}`).toISOString();
          await adminCreateFullRecord(
            coach.coachId,
            coach.name,
            attForm.date,
            checkInIso,
            checkOutIso,
            attForm.notes,
            attForm.checkoutNotes
          );
        } else {
          await adminMarkCheckIn(
            coach.coachId,
            coach.name,
            attForm.date,
            checkInIso,
            attForm.notes
          );
        }
      } else if (attModalMode === 'edit') {
        const checkInIso = new Date(`${selectedRecord.date}T${attForm.checkInTime}`).toISOString();
        const updates = {
          notes: attForm.notes,
          checkoutNotes: attForm.checkoutNotes,
          checkIn: checkInIso,
        };
        if (attForm.logCheckOut) {
          updates.checkOut = new Date(`${selectedRecord.date}T${attForm.checkOutTime}`).toISOString();
          updates.status = 'checked-out';
        } else {
          updates.checkOut = null;
          updates.status = 'checked-in';
        }
        await adminUpdateAttendance(selectedRecord.id, updates);
      }
      setShowAttModal(false);
      triggerRefresh();
    } catch (err) {
      alert(err.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Attendance Delete
  const handleAttDelete = async () => {
    if (!selectedRecord) return;
    if (!window.confirm('Are you sure you want to delete this attendance log?')) return;
    setSubmitting(true);
    try {
      await adminDeleteAttendance(selectedRecord.id);
      setShowAttModal(false);
      triggerRefresh();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Log Payout Modal
  const openPayModal = () => {
    setPayForm({
      amount: dueSalary.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'UPI',
      remarks: `Salary payout for ${selectedMonth}`,
    });
    setShowPayModal(true);
  };

  // Handle Salary Payout Submit
  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordCoachSalaryPayment({
        coachId: coach.coachId,
        coachName: coach.name,
        amount: Number(payForm.amount),
        paymentDate: payForm.paymentDate,
        month: selectedMonth,
        paymentMode: payForm.paymentMode,
        remarks: payForm.remarks,
        recordedBy: currentUser?.uid || 'admin',
      });
      setShowPayModal(false);
      triggerRefresh();
    } catch (err) {
      alert('Payment recording failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Coach
  const handleDeleteCoachClick = () => {
    onDelete(coach);
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[60] bg-navy-900 flex flex-col overflow-y-auto"
    >
      {/* Header Overlay */}
      <div className="sticky top-0 z-10 px-6 py-6 flex justify-between items-center bg-navy-900/80 backdrop-blur-xl">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"
        >
          <X size={20} />
        </button>
        <h2 className="text-white font-bold">Coach Profile</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { onEdit(coach); }}
            className="w-10 h-10 rounded-full bg-navy-800 border border-white/5 text-gray-400 hover:text-white flex items-center justify-center transition-colors animate-fade-in"
            title="Edit Coach Details"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={handleDeleteCoachClick}
            className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 transition-colors border border-red-500/20"
            title="Delete Coach"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 pb-12 flex-1 max-w-5xl mx-auto w-full">
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-navy-800 border-2 border-white/5 overflow-hidden mb-4 shadow-2xl flex-shrink-0">
            <Avatar name={coach.name} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{coach.name}</h1>
          <p className="text-accent text-sm font-medium flex items-center gap-1.5">
            <Briefcase size={14} /> {coach.specialization}
          </p>
          
          <div className="flex gap-4 mt-6">
            <a 
              href={`tel:${coach.phone}`} 
              className="w-12 h-12 rounded-2xl glass-accent text-accent flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              <Phone size={20} />
            </a>
            <a 
              href={`mailto:${coach.email}`}
              className="w-12 h-12 rounded-2xl glass text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              <Mail size={20} />
            </a>
            <button className="px-6 h-12 rounded-2xl bg-accent text-navy-900 font-bold flex items-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all">
              <ClipboardList size={18} />
              Performance
            </button>
          </div>
        </div>

        {/* Bento Info Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass p-4 rounded-3xl">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Joining Date</p>
            <div className="flex items-center gap-2 text-white font-bold">
              <Calendar size={14} className="text-accent" />
              <span className="text-xs truncate">{coach.joiningDate || '—'}</span>
            </div>
          </div>
          <div className="glass p-4 rounded-3xl">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Account Status</p>
            <div className="flex items-center gap-2 font-bold">
              <div className={cn("w-2 h-2 rounded-full", coach.status === 'active' ? 'bg-accent' : 'bg-red-500')} />
              <span className={cn("text-xs capitalize", coach.status === 'active' ? 'text-accent' : 'text-red-500')}>
                {coach.status || 'inactive'}
              </span>
            </div>
          </div>
          <div className="glass p-4 rounded-3xl col-span-2 lg:col-span-2">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Assigned Batches</p>
            <div className="flex items-center gap-2 text-white font-bold">
              <span className="text-xs truncate">
                {coach.assignedBatchIds && coach.assignedBatchIds.length > 0 
                  ? coach.assignedBatchIds.join(', ') 
                  : 'No Batches Assigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Salary configurations summary */}
        <div className="glass rounded-3xl p-5 border border-white/5 mb-8 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-accent/5 blur-2xl rounded-full" />
          <h3 className="text-white font-bold text-sm mb-4">Salary Agreement Details</h3>
          {loadingData ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-accent" size={20} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-800/40 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Salary Type Model</p>
                <p className="text-white text-sm font-black capitalize mt-1">
                  {salarySettings.salaryType.replace('_', ' ')}
                </p>
              </div>
              <div className="bg-navy-800/40 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Wage Rate</p>
                <p className="text-green-400 text-sm font-black mt-1">{getRateLabel()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Calendar View Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-white font-bold">Monthly Attendance Calendar</h3>
              <p className="text-gray-500 text-[10px] mt-0.5">Click a date cell to log, checkout, or modify attendance</p>
            </div>
            
            <div className="flex items-center bg-navy-800 border border-white/5 rounded-xl p-1 self-start sm:self-auto">
              <button
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={16} className="rotate-180" />
              </button>
              <span className="text-xs font-bold text-white px-4 min-w-[120px] text-center select-none">
                {calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Stats calculations cards */}
          <div className="grid grid-cols-3 gap-4 bg-navy-850 p-4 rounded-2xl border border-white/5 mb-4">
            <div className="text-center">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Present Days</span>
              <span className="text-base font-black text-green-400 mt-1 block">{stats.presentDays}</span>
            </div>
            <div className="text-center border-x border-white/5">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Hours Logged</span>
              <span className="text-base font-black text-accent mt-1 block">{stats.totalHours} hrs</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Avg Shift</span>
              <span className="text-base font-black text-white mt-1 block">{stats.avgShiftMins}m</span>
            </div>
          </div>

          <div className="glass p-5 rounded-[2rem]">
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">{d}</div>
              ))}
              {getCalendarDays().map((day, idx) => {
                const dateKey = formatDateKey(day.date);
                const record = attendance.find(r => r.date === dateKey);

                return (
                  <div 
                    key={idx} 
                    onClick={() => handleCellClick(day.date)}
                    className={cn(
                      "aspect-square rounded-2xl flex flex-col justify-between p-2 text-[10px] font-bold transition-all border cursor-pointer select-none relative overflow-hidden group",
                      !day.isCurrentMonth && "opacity-30",
                      record ? (
                        record.present === false
                          ? 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10 shadow-md shadow-red-500/5 text-red-400'
                          : record.status === 'checked-in'
                            ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 shadow-md shadow-amber-500/5 text-amber-400'
                            : 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10 shadow-md shadow-green-500/5 text-green-400'
                      ) : "border-white/5 hover:border-white/20 text-gray-400"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span>{day.date.getDate()}</span>
                      {record && (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full relative flex",
                          record.present === false
                            ? 'bg-red-500'
                            : record.status === 'checked-in' ? 'bg-amber-400' : 'bg-green-400'
                        )}>
                          {record.status === 'checked-in' && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          )}
                        </span>
                      )}
                    </div>
                    {/* Timestamp clocks display (desktop only) */}
                    <div className="hidden md:block text-[8px] text-white/70 space-y-0.5 text-left leading-none mt-1">
                      {record ? (
                        record.present === false ? (
                          <span className="text-[7px] text-red-400 font-bold uppercase">Absent</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-0.5 font-semibold text-white/95">
                              <Clock size={8} className="text-green-400 flex-shrink-0" />
                              <span className="truncate">{formatTime(record.checkIn)}</span>
                            </div>
                            {record.checkOut ? (
                              <div className="flex items-center gap-0.5 font-semibold text-white/60">
                                <Clock size={8} className="text-green-400/50 flex-shrink-0" />
                                <span className="truncate">{formatTime(record.checkOut)}</span>
                              </div>
                            ) : (
                              <span className="text-[7px] text-amber-400 font-bold uppercase animate-pulse">Active</span>
                            )}
                          </>
                        )
                      ) : (
                        <span className="text-[8px] text-gray-700 block">—</span>
                      )}
                    </div>

                    {/* Mobile duration indicator */}
                    <div className="md:hidden flex justify-center mt-0.5">
                      {record && (
                        <span className={cn(
                          "text-[7px] font-extrabold px-1 rounded",
                          record.present === false
                            ? "bg-red-500/20 text-red-400"
                            : record.status === 'checked-in' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                        )}>
                          {record.present === false ? 'Abs' : record.status === 'checked-in' ? 'Act' : `${record.duration}m`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Salary payments ledger and stats */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold">Salary Payout History</h3>
            
            <div className="flex items-center gap-4">
              {/* Date drop down selection */}
              <div className="relative">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-navy-800 border border-white/5 rounded-xl py-1.5 px-3 pl-8 text-xs text-white focus:outline-none focus:border-accent/40"
                />
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
              </div>
              
              <button 
                onClick={openPayModal}
                disabled={dueSalary === 0}
                className={cn(
                  "flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md",
                  dueSalary > 0
                    ? "bg-amber-500 text-white hover:opacity-95 active:scale-95"
                    : "bg-navy-800 text-gray-600 border border-white/5 cursor-not-allowed"
                )}
              >
                <Plus size={14} /> Log Payout
              </button>
            </div>
          </div>

          {/* Month balance statistics summary */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 bg-navy-850 p-4 rounded-2xl border border-white/5 mb-4">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Earned ({selectedMonth})</span>
              <span className="text-sm font-black text-white mt-1 block">₹{earnedSalary.toLocaleString()}</span>
              <span className="text-[8px] text-gray-500 font-medium block mt-0.5">{getCalcDetails()}</span>
            </div>
            <div className="border-x border-white/5 px-2">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Paid ({selectedMonth})</span>
              <span className="text-sm font-black text-green-400 mt-1 block">₹{paidSalary.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Outstanding Due</span>
              <span className={cn("text-sm font-black mt-1 block", dueSalary > 0 ? "text-amber-500" : "text-gray-500")}>
                ₹{dueSalary.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payout history list */}
          <div className="space-y-3">
            {loadingData ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-accent" size={24} />
              </div>
            ) : (
              (() => {
                const monthPayments = payments.filter(p => p.month === selectedMonth);
                
                if (monthPayments.length === 0) {
                  return (
                    <div className="glass p-6 rounded-2xl text-center text-gray-500 text-xs italic">
                      No payouts logged for {selectedMonth} yet.
                    </div>
                  );
                }

                return monthPayments.map((p) => (
                  <div key={p.paymentId} className="glass p-4 rounded-2xl flex justify-between items-center border border-green-500/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                        <IndianRupee size={18} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">₹{p.amount.toLocaleString()}</p>
                        <p className="text-gray-500 text-[10px]">{p.paymentDate} • Month: {p.month}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-bold capitalize">{p.paymentMode}</p>
                      <p className="text-accent text-[10px] font-bold">{p.remarks || 'SUCCESS'}</p>
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      </div>

      {/* ─── INLINE MODAL 1: ADD / EDIT / CHECKOUT ATTENDANCE ─── */}
      <AnimatePresence>
        {showAttModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowAttModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-navy-900/90 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-white font-bold text-base">
                    {attModalMode === 'add' ? 'Log Attendance Record' : 'Modify Attendance Record'}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    Date: {new Date(selectedCellDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setShowAttModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAttSubmit} className="p-6 pb-12 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Check-in Time *</label>
                    <input
                      type="time"
                      required
                      value={attForm.checkInTime}
                      onChange={(e) => setAttForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Check-out Time</label>
                    <input
                      type="time"
                      disabled={!attForm.logCheckOut}
                      value={attForm.logCheckOut ? attForm.checkOutTime : ''}
                      onChange={(e) => setAttForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                      className={cn(
                        "w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-accent/40",
                        !attForm.logCheckOut && "opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="logCheckOut"
                    checked={attForm.logCheckOut}
                    onChange={(e) => setAttForm(prev => ({ ...prev, logCheckOut: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500 rounded border-white/10"
                  />
                  <label htmlFor="logCheckOut" className="text-gray-300 text-xs font-medium">Log Check-out (Shift Complete)</label>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Check-in Notes / Plan</label>
                  <input
                    type="text"
                    value={attForm.notes}
                    onChange={(e) => setAttForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    placeholder="e.g. Training session batches A & B"
                  />
                </div>

                {attForm.logCheckOut && (
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Check-out Notes / Session Report</label>
                    <input
                      type="text"
                      value={attForm.checkoutNotes}
                      onChange={(e) => setAttForm(prev => ({ ...prev, checkoutNotes: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                      placeholder="e.g. Batting drills complete, notes sent"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4">
                  {attModalMode === 'edit' && (
                    <button
                      type="button"
                      onClick={handleAttDelete}
                      disabled={submitting}
                      className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-500 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase"
                    >
                      Delete Log
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase shadow-lg"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Save Attendance'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── INLINE MODAL 2: LOG SALARY PAYOUT ─── */}
      <AnimatePresence>
        {showPayModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowPayModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-navy-900/90 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-white font-bold text-base">Record Salary Payout</h2>
                  <p className="text-[10px] text-gray-500">Coach: {coach.name}</p>
                </div>
                <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handlePaySubmit} className="p-6 pb-12 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={payForm.amount}
                      onChange={(e) => setPayForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Payment Mode</label>
                  <select
                    value={payForm.paymentMode}
                    onChange={(e) => setPayForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40 cursor-pointer"
                  >
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Remarks / Note</label>
                  <input
                    type="text"
                    value={payForm.remarks}
                    onChange={(e) => setPayForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    placeholder="e.g. Cleared due wage for May"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase shadow-lg"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Log Payout'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CoachDetail;
