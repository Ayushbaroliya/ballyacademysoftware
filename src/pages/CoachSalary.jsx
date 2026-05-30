import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, TrendingUp, AlertCircle, CheckCircle, Search,
  ArrowUpRight, Loader2, Download, X, Plus, Wallet, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToCoaches } from '../services/coachService';
import { 
  recordCoachSalaryPayment, 
  getCoachSalaryPayments, 
  getAllCoachSalaryPayments
} from '../services/coachSalaryService';
import { exportData } from '../lib/exportUtils';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

const CoachSalary = () => {
  const { user, isAdmin, isCoach, loading: authLoading } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalColl, setTotalColl] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selCoach, setSelCoach] = useState(null);
  const [payHistory, setPayHistory] = useState([]);
  const [payForm, setPayForm] = useState({ amount: '', paymentDate: '', paymentMode: 'Bank Transfer', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (authLoading || !user) return;
    
    const unsub = subscribeToCoaches((data) => {
      let coachData = data;
      if (!isAdmin()) {
        coachData = data.filter(c => c.coachId === user.uid);
      }
      setCoaches(coachData);
      
      if (isAdmin()) {
        const paid = coachData.reduce((sum, c) => sum + (c.salaryPaid || 0), 0);
        const due  = coachData.reduce((sum, c) => sum + (c.salaryDue  || 0), 0);
        setTotalColl(paid);
        setTotalDue(due);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [authLoading, user, isAdmin]);

  const filteredCoaches = coaches.filter((c) => {
    const matchesSearch = (c.fullName || c.name || '').toLowerCase().includes(search.toLowerCase());
    const salaryDue = c.salaryDue || 0;
    if (statusFilter === 'Due') {
      return matchesSearch && salaryDue > 0;
    }
    if (statusFilter === 'Paid') {
      return matchesSearch && salaryDue <= 0 && (c.totalSalary || 0) > 0;
    }
    return matchesSearch;
  });

  const openPayModal = async (coach) => {
    if (!isAdmin() && coach.coachId !== user.uid) return;
    setSelCoach(coach);
    setShowPayModal(true);
    const history = await getCoachSalaryPayments(coach.coachId);
    setPayHistory(history);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!selCoach || !isAdmin()) return;
    setSaving(true);
    try {
      await recordCoachSalaryPayment({
        coachId:     selCoach.coachId,
        amount:      Number(payForm.amount),
        paymentDate: payForm.paymentDate || new Date().toISOString().split('T')[0],
        paymentMode: payForm.paymentMode,
        remarks:     payForm.remarks,
        recordedBy:  user?.uid || 'admin',
      });
      const history = await getCoachSalaryPayments(selCoach.coachId);
      setPayHistory(history);
      setPayForm({ amount: '', paymentDate: '', paymentMode: 'Bank Transfer', remarks: '' });
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!isAdmin()) return;
    const allPay = await getAllCoachSalaryPayments();
    const formatted = allPay.map((p) => ({
      'Payment ID': p.paymentId || '—',
      'Coach ID': p.coachId || '—',
      'Amount (₹)': p.amount || 0,
      'Payment Date': p.paymentDate || '—',
      'Payment Mode': p.paymentMode || '—',
      'Remarks': p.remarks || '—',
    }));
    exportData(formatted, 'Coach_Salary_Payments', 'xlsx');
  };

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000)   return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const totalSalaries = coaches.reduce((sum, c) => sum + (c.totalSalary || 0), 0);
  const targetPct     = totalSalaries > 0 ? Math.round((totalColl / totalSalaries) * 100) : 0;

  if (!user || (!isAdmin() && !isCoach())) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20 text-red-500">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          You do not have access to view coach salary details.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
      <header className="mb-4 md:mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {isAdmin() ? 'Coach Salary Management' : 'My Salary'}
          </h1>
          {isAdmin() && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              <Download size={14} /> Export Ledger
            </button>
          )}
        </div>
        
        {isAdmin() && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="glass p-4 md:p-5 rounded-3xl">
              <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Paid Out</p>
              <div className="flex items-end gap-1">
                <h3 className="text-xl font-bold text-white">{loading ? '—' : formatCurrency(totalColl)}</h3>
                <span className="text-indigo-400 text-[10px] flex items-center mb-1">
                  <ArrowUpRight size={10} /> Cleared
                </span>
              </div>
            </div>
            <div className="glass p-4 md:p-5 rounded-3xl border-amber-500/10">
              <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Pending Due</p>
              <div className="flex items-end gap-1">
                <h3 className="text-xl font-bold text-amber-500">{loading ? '—' : formatCurrency(totalDue)}</h3>
                <span className="text-red-500 text-[10px] flex items-center mb-1">
                  <ArrowUpRight size={10} /> Outstanding
                </span>
              </div>
            </div>
            <div className="glass bg-indigo-500/5 p-4 md:p-5 rounded-3xl col-span-2 relative overflow-hidden flex items-center justify-between border-indigo-500/10">
              <div className="relative z-10 w-full">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-white font-bold text-xs uppercase tracking-tight">Salary Budget Status</h4>
                  <span className="text-indigo-400 text-[10px] font-black">{targetPct}% Cleared</span>
                </div>
                <div className="w-full h-1.5 bg-navy-900/50 rounded-full overflow-hidden mb-2">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${targetPct}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-indigo-400">{formatCurrency(totalColl)} / {formatCurrency(totalSalaries)}</span>
                  <span className="text-gray-500">{formatCurrency(totalDue)} Pending</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAdmin() && (
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Search coach..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-gray-600"
            />
          </div>
        )}

        {isAdmin() && (
          <div className="flex gap-2 bg-navy-800/40 p-1.5 rounded-2xl border border-white/5 mb-3">
            {[
              { id: 'All', label: 'All Coaches' },
              { id: 'Due', label: 'Salary Due' },
              { id: 'Paid', label: 'Fully Paid' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all active:scale-95",
                  statusFilter === tab.id 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "text-gray-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white text-sm font-bold ml-1">Salary Status</h3>
          <span className="text-[10px] text-gray-500">{filteredCoaches.length} Coaches</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-10">
          {loading ? (
            <div className="col-span-full flex justify-center py-20">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
            </div>
          ) : (
            filteredCoaches.map((coach) => {
              const name      = coach.fullName || coach.name || 'Coach';
              const avatar    = coach.avatar || '';
              const salaryDue = coach.salaryDue  || 0;
              const salaryPaid= coach.salaryPaid || 0;
              const totalSal  = coach.totalSalary || 0;
              const status    = salaryDue > 0 ? 'Due' : (totalSal > 0 ? 'Paid' : 'Unset');

              return (
                <div
                  key={coach.coachId}
                  className="glass p-3 md:p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border border-indigo-500/5 hover:border-indigo-500/20"
                  onClick={() => openPayModal(coach)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-800 border border-white/5 overflow-hidden flex-shrink-0">
                      <Avatar src={avatar} name={name} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white text-sm font-bold truncate">{name}</h4>
                      <p className="text-[10px] text-gray-500 truncate">
                        Paid: ₹{salaryPaid.toLocaleString()} | Due: ₹{salaryDue.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={cn(
                      "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase mb-1 inline-block",
                      status === 'Paid' ? 'bg-indigo-500/10 text-indigo-400' : 
                      status === 'Due' ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-500/10 text-gray-400'
                    )}>
                      {status}
                    </div>
                    <p className="text-white text-xs font-bold">₹{totalSal.toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}

          {!loading && filteredCoaches.length === 0 && (
            <div className="py-10 text-center col-span-full">
              <p className="text-gray-500 text-sm italic">No records found...</p>
            </div>
          )}
        </div>
      </div>

      {showPayModal && selCoach && (
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
            <div className="sticky top-0 bg-navy-900/90 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center z-10">
              <div>
                <h2 className="text-white font-bold">{isAdmin() ? 'Record Salary Payout' : 'My Payout Ledger'}</h2>
                <p className="text-gray-500 text-xs">{selCoach.fullName || selCoach.name}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 pb-12">
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { label: 'Total',   val: selCoach.totalSalary || 0, color: 'text-white'      },
                  { label: 'Paid',    val: selCoach.salaryPaid  || 0, color: 'text-indigo-400' },
                  { label: 'Due',     val: selCoach.salaryDue   || 0, color: 'text-amber-500'  },
                ].map(({ label, val, color }) => (
                  <div key={label} className="glass rounded-2xl p-3 text-center border-indigo-500/5">
                    <p className="text-gray-500 text-[9px] uppercase font-bold mb-1">{label}</p>
                    <p className={`${color} text-sm font-bold`}>₹{val.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {isAdmin() && (
                <form onSubmit={handlePay} className="space-y-4 mb-6 bg-navy-800/20 p-4 rounded-2xl border border-white/5">
                  <h3 className="text-white font-bold text-xs mb-2">New Payout</h3>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      value={payForm.amount}
                      onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                      min="1"
                      className="w-full bg-navy-800 border border-indigo-500/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm((p) => ({ ...p, paymentDate: e.target.value }))}
                      className="w-full bg-navy-800 border border-indigo-500/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Mode</label>
                    <select
                      value={payForm.paymentMode}
                      onChange={(e) => setPayForm((p) => ({ ...p, paymentMode: e.target.value }))}
                      className="w-full bg-navy-800 border border-indigo-500/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option>Bank Transfer</option>
                      <option>UPI</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Remarks</label>
                    <input
                      type="text"
                      value={payForm.remarks}
                      onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))}
                      className="w-full bg-navy-800 border border-indigo-500/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Remarks"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !payForm.amount}
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed mt-4"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <IndianRupee size={16} />}
                    {saving ? 'Recording...' : 'Record Payment'}
                  </button>
                </form>
              )}

              {payHistory.length > 0 && (
                <div>
                  <h3 className="text-white font-bold text-xs mb-3">Recent Payments</h3>
                  <div className="space-y-2">
                    {payHistory.map((p) => (
                      <div key={p.paymentId} className="glass rounded-xl p-3 flex justify-between items-center border border-white/5">
                        <div>
                          <p className="text-white text-sm font-bold">₹{p.amount?.toLocaleString()}</p>
                          <p className="text-gray-500 text-[10px]">{p.paymentDate} • {p.paymentMode}</p>
                        </div>
                        {p.remarks && (
                          <div className="text-right max-w-[120px]">
                            <p className="text-gray-400 text-[10px] truncate">{p.remarks}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default CoachSalary;
