import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, AlertCircle, CheckCircle, Search,
  ArrowUpRight, Loader2, Download, X, Plus, Filter,
  Clock, Users, UserMinus, TrendingUp, Copy, Share2,
  RotateCcw, ChevronDown, Calendar, Wallet, BarChart2,
  Pencil, Trash2, ChevronUp, Eye, EyeOff,
} from 'lucide-react';
import { subscribeToStudents, softRemoveStudent, restoreStudent, deleteStudent } from '../services/studentService';
import { addPayment, getPaymentsByStudent, updatePayment, deletePayment } from '../services/paymentService';
import {
  exportData, formatDueFeesForExport, generateWhatsAppDueList,
} from '../lib/exportUtils';
import {
  calcPendingMonths, calcDueAmount, getDueSeverity,
  getSeverityBorderClass, getSeverityBadgeClass, getSeverityLabel,
  sortByOverdue, sortByDueAmount, sortByNewest,
  calcTotalPendingRevenue, calcExpectedMonthlyRevenue, formatCurrency,
} from '../lib/feeCalculations';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

/* ─────────────────────────── helpers ─────────────────────────── */
const SORT_OPTIONS = [
  { id: 'overdue',    label: 'Longest Overdue' },
  { id: 'amount',     label: 'Highest Amount'  },
  { id: 'newest',     label: 'Newest Due'      },
  { id: 'batch',      label: 'By Batch'        },
  { id: 'coach',      label: 'By Coach'        },
];

const TABS = [
  { id: 'due',      label: 'Due Students' },
  { id: 'all',      label: 'All Active'   },
  { id: 'clear',    label: 'Cleared'      },
  { id: 'removed',  label: 'Removed'      },
];

/* ─────────────────────────── component ─────────────────────────── */
const Fees = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Data
  const [allStudents,  setAllStudents]  = useState([]);
  const [loading,      setLoading]      = useState(true);

  // Filters & sorts
  const [search,       setSearch]       = useState('');
  const [activeTab,    setActiveTab]    = useState('due');
  const [sortBy,       setSortBy]       = useState('overdue');
  const [batchFilter,  setBatchFilter]  = useState('All');
  const [coachFilter,  setCoachFilter]  = useState('All');
  const [showFilters,  setShowFilters]  = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selStudent,   setSelStudent]   = useState(null);
  const [payHistory,   setPayHistory]   = useState([]);
  const [payForm,      setPayForm]      = useState({
    monthsPaid: '', amount: '', paymentDate: '', paymentMode: 'Cash', remarks: '',
  });
  const [saving, setSaving] = useState(false);

  // WhatsApp list modal
  const [showWAModal,  setShowWAModal]  = useState(false);
  const [waText,       setWaText]       = useState('');
  const [copied,       setCopied]       = useState(false);

  // Analytics toggle (persisted)
  const [showAnalytics, setShowAnalytics] = useState(() => {
    try { return localStorage.getItem('feesShowAnalytics') !== 'false'; }
    catch { return true; }
  });
  const toggleAnalytics = () => setShowAnalytics(v => {
    const next = !v;
    try { localStorage.setItem('feesShowAnalytics', String(next)); } catch {}
    return next;
  });

  // Edit payment modal
  const [editPayModal, setEditPayModal] = useState(false);
  const [editingPay,   setEditingPay]   = useState(null);
  const [editPayForm,  setEditPayForm]  = useState({});
  const [editSaving,   setEditSaving]   = useState(false);

  // ── Live subscription ──────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    const unsub = subscribeToStudents((data) => {
      setAllStudents(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authLoading, user]);

  // ── Derived lists ──────────────────────────────────────────────
  const activeStudents  = useMemo(() =>
    allStudents.filter(s => s.status !== 'removed'), [allStudents]);
  const removedStudents = useMemo(() =>
    allStudents.filter(s => s.status === 'removed'), [allStudents]);

  // Batches & coaches for filter dropdowns
  const batches = useMemo(() =>
    ['All', ...new Set(activeStudents.map(s => s.batchId).filter(Boolean))],
    [activeStudents]);
  const coaches = useMemo(() =>
    ['All', ...new Set(activeStudents.map(s => s.assignedCoachId || s.coach).filter(Boolean))],
    [activeStudents]);

  // Tab-filtered list
  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case 'due':
        return activeStudents.filter(s => calcPendingMonths(s) > 0);
      case 'clear':
        return activeStudents.filter(s => calcPendingMonths(s) <= 0);
      case 'removed':
        return removedStudents;
      default:
        return activeStudents;
    }
  }, [activeTab, activeStudents, removedStudents]);

  // Apply search + batch + coach filters
  const filtered = useMemo(() => {
    return tabFiltered.filter(s => {
      const name  = (s.fullName || s.name || '').toLowerCase();
      const batch = s.batchId || '';
      const coach = s.assignedCoachId || s.coach || '';
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchBatch  = batchFilter === 'All' || batch === batchFilter;
      const matchCoach  = coachFilter === 'All' || coach === coachFilter;
      return matchSearch && matchBatch && matchCoach;
    });
  }, [tabFiltered, search, batchFilter, coachFilter]);

  // Apply sort
  const sorted = useMemo(() => {
    if (activeTab === 'removed') return filtered;
    switch (sortBy) {
      case 'amount':  return sortByDueAmount(filtered);
      case 'newest':  return sortByNewest(filtered);
      case 'batch':   return [...filtered].sort((a, b) => (a.batchId || '').localeCompare(b.batchId || ''));
      case 'coach':   return [...filtered].sort((a, b) =>
        (a.assignedCoachId || a.coach || '').localeCompare(b.assignedCoachId || b.coach || ''));
      default:        return sortByOverdue(filtered);
    }
  }, [filtered, sortBy, activeTab]);

  // ── Dashboard stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const due      = activeStudents.filter(s => calcPendingMonths(s) > 0);
    const pending  = calcTotalPendingRevenue(activeStudents);
    const expected = calcExpectedMonthlyRevenue(activeStudents);
    const collected = activeStudents.reduce((sum, s) => sum + (s.feesPaid || 0), 0);
    return {
      active:    activeStudents.length,
      removed:   removedStudents.length,
      dueCount:  due.length,
      pending,
      expected,
      collected,
    };
  }, [activeStudents, removedStudents]);

  // ── Payment modal ──────────────────────────────────────────────
  const openPayModal = useCallback(async (student) => {
    setSelStudent(student);
    setShowPayModal(true);
    const history = await getPaymentsByStudent(student.studentId);
    setPayHistory(history);
    // Pre-fill amount from monthly fees
    const mf = Number(student.monthlyFees) || 0;
    setPayForm({ monthsPaid: '1', amount: String(mf), paymentDate: '', paymentMode: 'Cash', remarks: '' });
  }, []);

  const handleMonthsChange = useCallback((months) => {
    const mf  = Number(selStudent?.monthlyFees) || 0;
    const amt = mf > 0 ? String(mf * Number(months || 0)) : '';
    setPayForm(p => ({ ...p, monthsPaid: months, amount: amt }));
  }, [selStudent]);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!selStudent) return;
    setSaving(true);
    try {
      await addPayment({
        studentId:   selStudent.studentId,
        amount:      Number(payForm.amount),
        monthsPaid:  Number(payForm.monthsPaid) || 0,
        paymentDate: payForm.paymentDate || new Date().toISOString().split('T')[0],
        paymentMode: payForm.paymentMode,
        remarks:     payForm.remarks,
        receivedBy:  user?.uid || 'admin',
      });
      const history = await getPaymentsByStudent(selStudent.studentId);
      setPayHistory(history);
      setPayForm({ monthsPaid: '', amount: '', paymentDate: '', paymentMode: 'Cash', remarks: '' });
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── WhatsApp list ──────────────────────────────────────────────
  const openWAModal = () => {
    const text = generateWhatsAppDueList(activeStudents);
    setWaText(text);
    setShowWAModal(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(waText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExcelExport = () => {
    const dueActive = activeStudents.filter(s => calcPendingMonths(s) > 0);
    if (dueActive.length === 0) { alert('No due students found.'); return; }
    exportData(formatDueFeesForExport(dueActive), 'Due_Fees_List_Jabali', 'xlsx');
  };

  // ── Restore / Remove / Permanent Delete ────────────────────────────
  const handleRemove = async (student) => {
    if (!window.confirm(`Remove ${student.fullName || student.name} from active list?`)) return;
    await softRemoveStudent(student.studentId);
  };

  const handleRestore = async (student) => {
    await restoreStudent(student.studentId);
  };

  const handlePermanentDelete = async (student) => {
    const name = student.fullName || student.name;
    const confirmed = window.confirm(`⚠️ PERMANENT DELETE\n\nThis will delete ${name} and ALL their data forever.\n\nAre you sure you want to proceed?`);
    if (!confirmed) return;
    try {
      await deleteStudent(student.studentId);
    } catch (err) {
      console.error(err);
      alert('Delete failed. Check Firestore rules.');
    }
  };

  // ── Edit payment ───────────────────────────────────────────────────
  const openEditPay = (payment) => {
    setEditingPay(payment);
    setEditPayForm({
      amount:      String(payment.amount || ''),
      monthsPaid:  String(payment.monthsPaid || ''),
      paymentDate: payment.paymentDate || '',
      paymentMode: payment.paymentMode || 'Cash',
      remarks:     payment.remarks || '',
    });
    setEditPayModal(true);
  };

  const handleEditPay = async (e) => {
    e.preventDefault();
    if (!editingPay) return;
    setEditSaving(true);
    try {
      await updatePayment(
        editingPay.paymentId,
        {
          amount:      Number(editPayForm.amount),
          monthsPaid:  Number(editPayForm.monthsPaid),
          paymentDate: editPayForm.paymentDate,
          paymentMode: editPayForm.paymentMode,
          remarks:     editPayForm.remarks,
        },
        editingPay
      );
      // Refresh payment history
      const history = await getPaymentsByStudent(selStudent.studentId);
      setPayHistory(history);
      setEditPayModal(false);
      setEditingPay(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update payment.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePay = async (payment) => {
    if (!window.confirm('Delete this payment record? This will reverse the months paid on the student.')) return;
    try {
      await deletePayment(payment.paymentId, payment);
      const history = await getPaymentsByStudent(selStudent.studentId);
      setPayHistory(history);
    } catch (err) {
      console.error(err);
      alert('Failed to delete payment.');
    }
  };

  // Current student data (live — subscription updates it)
  const currentStudent = allStudents.find(s => s.studentId === selStudent?.studentId) || selStudent;
  const currentPending  = currentStudent ? calcPendingMonths(currentStudent) : 0;
  const currentDue      = currentStudent ? calcDueAmount(currentStudent) : 0;
  const currentSeverity = getDueSeverity(currentPending);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="mb-4 md:mb-6 flex-shrink-0">
        <div className="flex justify-between items-center mb-5">
          <div className="cursor-pointer" onClick={toggleAnalytics}>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-white">Fee Management</h1>
              <span className="text-gray-500 hover:text-white transition-colors">
                {showAnalytics ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
              Smart Dynamic Tracking
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openWAModal}
              className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              <Share2 size={13} /> Due List
            </button>
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              <Download size={13} /> Excel
            </button>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        {isAdmin() && showAnalytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
            <StatCard
              label="Active Students"
              value={loading ? '—' : stats.active}
              icon={<Users size={14} className="text-accent" />}
              color="text-white"
            />
            <StatCard
              label="Due Students"
              value={loading ? '—' : stats.dueCount}
              icon={<AlertCircle size={14} className="text-red-400" />}
              color="text-red-400"
              badge={stats.dueCount > 0 ? 'Attention' : null}
            />
            <StatCard
              label="Pending Revenue"
              value={loading ? '—' : formatCurrency(stats.pending)}
              icon={<Wallet size={14} className="text-amber-500" />}
              color="text-amber-500"
            />
            <StatCard
              label="Monthly Target"
              value={loading ? '—' : formatCurrency(stats.expected)}
              icon={<TrendingUp size={14} className="text-emerald-400" />}
              color="text-emerald-400"
              sub={`${stats.expected > 0 ? Math.round((stats.collected / stats.expected) * 100) : 0}% collected`}
            />
          </div>
        )}

        {/* ── Monthly progress bar ── */}
        {isAdmin() && showAnalytics && !loading && stats.expected > 0 && (
          <div className="glass rounded-2xl px-4 py-3 mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Monthly Collection Progress
              </span>
              <span className="text-accent text-[10px] font-black">
                {Math.min(100, Math.round((stats.collected / stats.expected) * 100))}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.round((stats.collected / stats.expected) * 100))}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-accent to-emerald-400 rounded-full"
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold mt-1.5">
              <span className="text-accent">{formatCurrency(stats.collected)} collected</span>
              <span className="text-gray-500">{formatCurrency(stats.pending)} pending</span>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            placeholder="Search student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setShowAnalytics(false)}
            className="w-full bg-navy-800 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600"
          />
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1.5 bg-navy-800/40 p-1 rounded-2xl border border-white/5 mb-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-bold rounded-xl transition-all',
                activeTab === tab.id
                  ? 'bg-accent text-white shadow shadow-accent/30'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {tab.label}
              {tab.id === 'due' && stats.dueCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[8px] px-1 py-0 rounded-full">
                  {stats.dueCount}
                </span>
              )}
              {tab.id === 'removed' && stats.removed > 0 && (
                <span className="ml-1 bg-gray-600 text-white text-[8px] px-1 py-0 rounded-full">
                  {stats.removed}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sort + Filter controls ── */}
        {activeTab !== 'removed' && (
          <div className="flex gap-2 mb-2">
            {/* Sort dropdown */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowSortMenu(v => !v)}
                className="w-full flex items-center justify-between gap-2 bg-navy-800/60 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-bold text-gray-300"
              >
                <span className="flex items-center gap-1.5">
                  <BarChart2 size={11} className="text-accent" />
                  {SORT_OPTIONS.find(o => o.id === sortBy)?.label}
                </span>
                <ChevronDown size={11} className={cn('transition-transform', showSortMenu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-navy-800 border border-white/10 rounded-xl overflow-hidden z-30 shadow-xl"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortBy(opt.id); setShowSortMenu(false); }}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-[11px] font-semibold transition-colors',
                          sortBy === opt.id ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all',
                showFilters
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-navy-800/60 border-white/5 text-gray-400'
              )}
            >
              <Filter size={11} /> Filter
            </button>
          </div>
        )}

        {/* ── Advanced filters ── */}
        <AnimatePresence>
          {showFilters && activeTab !== 'removed' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-1">Batch</label>
                  <select
                    value={batchFilter}
                    onChange={e => setBatchFilter(e.target.value)}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-accent/50"
                  >
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-1">Coach</label>
                  <select
                    value={coachFilter}
                    onChange={e => setCoachFilter(e.target.value)}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-accent/50"
                  >
                    {coaches.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Student List ── */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white text-xs font-bold ml-1">
            {activeTab === 'removed' ? 'Removed Students' : activeTab === 'due' ? 'Overdue Students' : 'Students'}
          </h3>
          <span className="text-[10px] text-gray-500">{sorted.length} students</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pb-10">
            <AnimatePresence mode="popLayout">
              {sorted.map(student => (
                <StudentFeeCard
                  key={student.studentId}
                  student={student}
                  isRemoved={activeTab === 'removed'}
                  onPay={() => openPayModal(student)}
                  onRemove={() => handleRemove(student)}
                  onRestore={() => handleRestore(student)}
                  onPermanentDelete={() => handlePermanentDelete(student)}
                />
              ))}
            </AnimatePresence>

            {sorted.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
                  <CheckCircle size={28} className="text-emerald-400" />
                </div>
                <p className="text-white font-bold text-sm">
                  {activeTab === 'due' ? 'All students are clear! 🎉' : 'No students found'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {activeTab === 'due' ? 'No pending dues at this time.' : 'Try adjusting filters.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ PAYMENT MODAL ═══════════════ */}
      <AnimatePresence>
        {showPayModal && selStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={e => e.target === e.currentTarget && setShowPayModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[92vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-navy-900/95 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center z-10">
                <div>
                  <h2 className="text-white font-bold">Record Payment</h2>
                  <p className="text-gray-500 text-xs">{currentStudent?.fullName || currentStudent?.name}</p>
                </div>
                <button
                  onClick={() => setShowPayModal(false)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 pb-12 space-y-5">
                {/* Fee overview cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Monthly Fee', val: `₹${(Number(currentStudent?.monthlyFees) || 0).toLocaleString()}`, color: 'text-white' },
                    { label: 'Months Paid', val: String(Number(currentStudent?.totalMonthsPaid) || 0),              color: 'text-emerald-400' },
                    { label: 'Months Due',  val: String(currentPending),                                            color: currentPending > 0 ? 'text-red-400' : 'text-emerald-400' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="glass rounded-2xl p-3 text-center">
                      <p className="text-gray-500 text-[9px] uppercase font-bold mb-1">{label}</p>
                      <p className={`${color} text-sm font-bold`}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Due amount highlight */}
                {currentPending > 0 && (
                  <div className={cn(
                    'rounded-2xl p-3 border flex items-center justify-between',
                    getSeverityBadgeClass(currentSeverity).replace('bg-', 'bg-').replace('/15', '/10')
                  )}>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Total Due Amount</p>
                      <p className="text-xl font-black mt-0.5">₹{currentDue.toLocaleString()}</p>
                    </div>
                    <span className={cn('text-[9px] font-black px-2.5 py-1 rounded-full', getSeverityBadgeClass(currentSeverity))}>
                      {getSeverityLabel(currentPending)}
                    </span>
                  </div>
                )}

                {/* Payment form */}
                <form onSubmit={handlePay} className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">
                      Months Paying *
                    </label>
                    <input
                      type="number"
                      value={payForm.monthsPaid}
                      onChange={e => handleMonthsChange(e.target.value)}
                      required
                      min="1"
                      max="24"
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                      placeholder="e.g. 2"
                    />
                    {payForm.monthsPaid && Number(payForm.monthsPaid) > 0 && Number(currentStudent?.monthlyFees) > 0 && (
                      <p className="text-accent text-[10px] mt-1 ml-1">
                        Auto: ₹{(Number(payForm.monthsPaid) * Number(currentStudent.monthlyFees)).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      value={payForm.amount}
                      onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                      required
                      min="1"
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={payForm.paymentDate}
                      onChange={e => setPayForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Mode</label>
                    <select
                      value={payForm.paymentMode}
                      onChange={e => setPayForm(p => ({ ...p, paymentMode: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                    >
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                      <option>Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Remarks</label>
                    <input
                      type="text"
                      value={payForm.remarks}
                      onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                      placeholder="Optional"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {saving
                      ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                      : <><Plus size={16} /> Record Payment</>}
                  </button>
                </form>

                {/* Payment history */}
                {payHistory.length > 0 && (
                  <div>
                    <h3 className="text-white text-sm font-bold mb-3">Payment History</h3>
                    <div className="space-y-2">
                      {payHistory.map(p => (
                        <div key={p.paymentId} className="glass rounded-xl p-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                              <IndianRupee size={13} className="text-accent" />
                            </div>
                            <div>
                              <p className="text-white text-xs font-bold">₹{(p.amount || 0).toLocaleString()}</p>
                              <p className="text-gray-500 text-[10px]">
                                {p.paymentDate} • {p.paymentMode}
                                {p.monthsPaid ? ` • ${p.monthsPaid} month${p.monthsPaid > 1 ? 's' : ''}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 text-[9px] font-black bg-emerald-500/10 px-2 py-0.5 rounded-full">PAID</span>
                            <button
                              onClick={() => openEditPay(p)}
                              className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center active:scale-95"
                              title="Edit payment"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => handleDeletePay(p)}
                              className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center active:scale-95"
                              title="Delete payment"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ WHATSAPP LIST MODAL ═══════════════ */}
      <AnimatePresence>
        {showWAModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={e => e.target === e.currentTarget && setShowWAModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-navy-900/95 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <Share2 size={16} className="text-green-400" /> Due Fees List
                  </h2>
                  <p className="text-gray-500 text-xs">Copy to share via WhatsApp</p>
                </div>
                <button
                  onClick={() => setShowWAModal(false)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 pb-12 space-y-4">
                <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-4">
                  <pre className="text-gray-200 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                    {waText}
                  </pre>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-2xl text-sm transition-all active:scale-95',
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    )}
                  >
                    <Copy size={15} />
                    {copied ? 'Copied! ✓' : 'Copy Text'}
                  </button>
                  <button
                    onClick={handleExcelExport}
                    className="flex items-center justify-center gap-2 bg-accent/10 border border-accent/20 text-accent font-bold py-3 px-4 rounded-2xl text-sm transition-all active:scale-95"
                  >
                    <Download size={15} />
                    Excel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ EDIT PAYMENT MODAL ═══════════════ */}
      <AnimatePresence>
        {editPayModal && editingPay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center"
            onClick={e => e.target === e.currentTarget && setEditPayModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-navy-900/95 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center z-10">
                <div>
                  <h2 className="text-white font-bold flex items-center gap-2"><Pencil size={15} className="text-blue-400" /> Edit Payment</h2>
                  <p className="text-gray-500 text-xs">Update record — months paid will be adjusted</p>
                </div>
                <button onClick={() => setEditPayModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleEditPay} className="p-6 pb-12 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Amount (₹) *</label>
                  <input type="number" value={editPayForm.amount} onChange={e => setEditPayForm(p => ({ ...p, amount: e.target.value }))} required min="1"
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Months Paid</label>
                  <input type="number" value={editPayForm.monthsPaid} onChange={e => setEditPayForm(p => ({ ...p, monthsPaid: e.target.value }))} min="0"
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" />
                  <p className="text-[10px] text-amber-400 mt-1 ml-1">⚠ Changing this will adjust the student's total months paid</p>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Payment Date</label>
                  <input type="date" value={editPayForm.paymentDate} onChange={e => setEditPayForm(p => ({ ...p, paymentDate: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Mode</label>
                  <select value={editPayForm.paymentMode} onChange={e => setEditPayForm(p => ({ ...p, paymentMode: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50">
                    <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Remarks</label>
                  <input type="text" value={editPayForm.remarks} onChange={e => setEditPayForm(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" placeholder="Optional" />
                </div>
                <button type="submit" disabled={editSaving}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                  {editSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Pencil size={16} /> Save Changes</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────── Sub-components ─────────────────────────── */

const StatCard = ({ label, value, icon, color, badge, sub }) => (
  <div className="glass p-3.5 md:p-4 rounded-2xl">
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">{label}</p>
      {badge && (
        <span className="ml-auto text-[7px] font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full uppercase">
          {badge}
        </span>
      )}
    </div>
    <h3 className={`text-lg font-bold ${color}`}>{value}</h3>
    {sub && <p className="text-gray-600 text-[9px] mt-0.5">{sub}</p>}
  </div>
);

const StudentFeeCard = ({ student, isRemoved, onPay, onRemove, onRestore, onPermanentDelete }) => {
  const name          = student.fullName || student.name || 'Student';
  const pendingMonths = calcPendingMonths(student);
  const dueAmount     = calcDueAmount(student);
  const severity      = getDueSeverity(pendingMonths);
  const borderClass   = getSeverityBorderClass(severity);
  const badgeClass    = getSeverityBadgeClass(severity);
  const coach         = student.assignedCoachId || student.coach || '—';
  const batch         = student.batchId || '—';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'glass p-3.5 md:p-4 rounded-2xl border transition-all',
        isRemoved ? 'opacity-60 border-white/5' : borderClass
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-navy-800 border border-white/5 overflow-hidden">
            <Avatar src={student.avatar} name={name} />
          </div>
          {!isRemoved && pendingMonths > 0 && (
            <div className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-navy-900 flex items-center justify-center',
              severity === 'red'    ? 'bg-red-500 animate-pulse' :
              severity === 'orange' ? 'bg-orange-400' : 'bg-yellow-400'
            )} />
          )}
          {!isRemoved && pendingMonths === 0 && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-navy-900" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-white text-sm font-bold truncate">{name}</h4>
            {!isRemoved && (
              <span className={cn('text-[8px] font-black px-2 py-0.5 rounded-full flex-shrink-0', badgeClass)}>
                {getSeverityLabel(pendingMonths)}
              </span>
            )}
            {isRemoved && (
              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                REMOVED
              </span>
            )}
          </div>

          <p className="text-gray-600 text-[10px] truncate mt-0.5">
            {batch} • {coach}
          </p>

          {!isRemoved && (
            <div className="flex items-center gap-3 mt-2">
              <div>
                <p className="text-gray-500 text-[8px] uppercase font-bold">Monthly</p>
                <p className="text-white text-xs font-bold">
                  ₹{(Number(student.monthlyFees) || 0).toLocaleString()}
                </p>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div>
                <p className="text-gray-500 text-[8px] uppercase font-bold">Paid</p>
                <p className="text-emerald-400 text-xs font-bold">
                  {Number(student.totalMonthsPaid) || 0} mo
                </p>
              </div>
              {pendingMonths > 0 && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <p className="text-gray-500 text-[8px] uppercase font-bold">Due</p>
                    <p className={cn('text-xs font-bold',
                      severity === 'red' ? 'text-red-400' :
                      severity === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                    )}>
                      ₹{dueAmount.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        {isRemoved ? (
          <>
            <button
              onClick={onRestore}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold py-2 rounded-xl active:scale-95 transition-transform"
            >
              <RotateCcw size={11} /> Restore
            </button>
            <button
              onClick={onPermanentDelete}
              className="flex items-center justify-center gap-1 bg-red-600/15 border border-red-600/30 text-red-400 text-[10px] font-bold py-2 px-3 rounded-xl active:scale-95 transition-transform"
              title="Permanently delete student"
            >
              <Trash2 size={12} /> Delete
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onPay}
              className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-white text-[10px] font-bold py-2 rounded-xl active:scale-95 transition-transform shadow-sm shadow-accent/20"
            >
              <IndianRupee size={11} />
              {pendingMonths > 0 ? 'Record Payment' : 'View / Pay'}
            </button>
            <button
              onClick={onRemove}
              className="flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold py-2 px-3 rounded-xl active:scale-95 transition-transform"
              title="Remove student"
            >
              <UserMinus size={13} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default Fees;
