import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, IndianRupee, Users, UserMinus,
  AlertCircle, BarChart2, Award, Loader2, RefreshCw,
} from 'lucide-react';
import { subscribeToStudents } from '../services/studentService';
import { getMonthlyCollectedTrend } from '../services/paymentService';
import {
  calcPendingMonths, calcDueAmount, getDueSeverity,
  getSeverityBadgeClass, getSeverityLabel,
  calcTotalPendingRevenue, calcExpectedMonthlyRevenue,
  sortByOverdue, formatCurrency,
} from '../lib/feeCalculations';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

/* ── tiny animation variants ── */
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

/* ─────────────────────────────────────────────── */
const FeeAnalytics = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [allStudents, setAllStudents] = useState([]);
  const [trend,       setTrend]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [trendLoading,setTrendLoading]= useState(true);

  /* ── subscriptions ── */
  useEffect(() => {
    if (authLoading || !user) return;
    const unsub = subscribeToStudents((data) => {
      setAllStudents(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    getMonthlyCollectedTrend(6).then(data => {
      setTrend(data);
      setTrendLoading(false);
    });
  }, [authLoading, user]);

  /* ── derived data ── */
  const active  = useMemo(() => allStudents.filter(s => s.status !== 'removed'), [allStudents]);
  const removed = useMemo(() => allStudents.filter(s => s.status === 'removed'),  [allStudents]);
  const due     = useMemo(() => active.filter(s => calcPendingMonths(s) > 0),     [active]);
  const clear   = useMemo(() => active.filter(s => calcPendingMonths(s) <= 0),    [active]);

  const expected  = useMemo(() => calcExpectedMonthlyRevenue(active), [active]);
  const pending   = useMemo(() => calcTotalPendingRevenue(active),    [active]);
  const collected = useMemo(() => active.reduce((s, st) => s + (st.feesPaid || 0), 0), [active]);
  const pct       = expected > 0 ? Math.round((collected / expected) * 100) : 0;

  /* top overdue */
  const topOverdue = useMemo(() =>
    sortByOverdue(due).slice(0, 7), [due]);

  /* batch-wise breakdown */
  const batchBreakdown = useMemo(() => {
    const map = {};
    active.forEach(s => {
      const key = s.batchId || 'No Batch';
      if (!map[key]) map[key] = { count: 0, due: 0, pending: 0 };
      map[key].count++;
      if (calcPendingMonths(s) > 0) {
        map[key].due++;
        map[key].pending += calcDueAmount(s);
      }
    });
    return Object.entries(map)
      .map(([batch, v]) => ({ batch, ...v }))
      .sort((a, b) => b.pending - a.pending);
  }, [active]);

  /* coach-wise breakdown */
  const coachBreakdown = useMemo(() => {
    const map = {};
    active.forEach(s => {
      const key = s.assignedCoachId || s.coach || 'Unassigned';
      if (!map[key]) map[key] = { count: 0, due: 0, pending: 0 };
      map[key].count++;
      if (calcPendingMonths(s) > 0) {
        map[key].due++;
        map[key].pending += calcDueAmount(s);
      }
    });
    return Object.entries(map)
      .map(([coach, v]) => ({ coach, ...v }))
      .sort((a, b) => b.pending - a.pending);
  }, [active]);

  const maxBatchPending = Math.max(...batchBreakdown.map(b => b.pending), 1);
  const maxCoachPending = Math.max(...coachBreakdown.map(c => c.pending), 1);
  const maxTrend        = Math.max(...trend.map(t => t.collected), 1);

  if (!isAdmin()) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full overflow-y-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Fee Analytics</h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
              Live Revenue Intelligence
            </p>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <BarChart2 size={17} className="text-accent" />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="text-accent animate-spin" />
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* ── Top KPI Row ── */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Next Month Target"
              value={formatCurrency(expected + pending)}
              sub={`₹${expected} (Month) + ₹${pending} (Due)`}
              color="text-accent"
              glow="from-accent/5"
              icon={<TrendingUp size={16} className="text-accent" />}
            />
            <KpiCard
              label="Total Collected"
              value={formatCurrency(collected)}
              sub="All-time payments"
              color="text-emerald-400"
              glow="from-emerald-400/5"
              icon={<IndianRupee size={16} className="text-emerald-400" />}
            />
            <KpiCard
              label="Pending Revenue"
              value={formatCurrency(pending)}
              sub={`${due.length} students overdue`}
              color="text-red-400"
              glow="from-red-500/5"
              icon={<AlertCircle size={16} className="text-red-400" />}
            />
            <KpiCard
              label="Collection Rate"
              value={`${Math.min(pct, 100)}%`}
              sub={`${clear.length} students cleared`}
              color={pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}
              glow="from-blue-400/5"
              icon={<Award size={16} className="text-blue-400" />}
            />
          </motion.div>

          {/* ── Revenue progress ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Monthly Collection Progress
            </p>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-2xl font-black text-white">{formatCurrency(collected)}</span>
              <span className="text-gray-500 text-xs mb-1">of {formatCurrency(expected)} target</span>
            </div>
            <div className="w-full h-2.5 bg-navy-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${
                  pct >= 75 ? 'from-emerald-400 to-accent' :
                  pct >= 50 ? 'from-yellow-400 to-accent' :
                  'from-red-500 to-orange-400'
                }`}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-gray-500">{formatCurrency(pending)} still pending</span>
              <span className={`text-[10px] font-black ${
                pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>{pct}% done</span>
            </div>
          </motion.div>

          {/* ── Active vs Removed ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Student Status Breakdown
            </p>
            <div className="grid grid-cols-3 gap-3">
              <StatusPill label="Active" count={active.length}  color="bg-accent"       />
              <StatusPill label="Cleared" count={clear.length}  color="bg-emerald-500"  />
              <StatusPill label="Due"    count={due.length}     color="bg-red-500"       />
            </div>
            <div className="mt-4">
              {/* Active vs Removed visual bar */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-gray-500 text-[9px] uppercase font-bold w-16">Active</span>
                <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${allStudents.length > 0 ? (active.length / allStudents.length) * 100 : 0}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-accent rounded-full"
                  />
                </div>
                <span className="text-accent text-[10px] font-bold w-6 text-right">{active.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[9px] uppercase font-bold w-16">Removed</span>
                <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${allStudents.length > 0 ? (removed.length / allStudents.length) * 100 : 0}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-gray-600 rounded-full"
                  />
                </div>
                <span className="text-gray-400 text-[10px] font-bold w-6 text-right">{removed.length}</span>
              </div>
            </div>
          </motion.div>

          {/* ── Monthly Trend ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Last 6 Months Collected
              </p>
              {trendLoading && <Loader2 size={12} className="animate-spin text-gray-500" />}
            </div>
            {!trendLoading && trend.length > 0 && (
              <div className="flex items-end gap-2 h-28">
                {trend.map((t, i) => {
                  const heightPct = maxTrend > 0 ? (t.collected / maxTrend) * 100 : 0;
                  const isLast = i === trend.length - 1;
                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[8px] text-gray-500 font-bold">
                        {t.collected > 0 ? formatCurrency(t.collected) : ''}
                      </span>
                      <div className="w-full flex items-end" style={{ height: '72px' }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPct, t.collected > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.7, delay: i * 0.08 }}
                          className={`w-full rounded-t-lg ${
                            isLast
                              ? 'bg-gradient-to-t from-accent to-yellow-300'
                              : 'bg-navy-700 border border-white/5'
                          }`}
                          style={{ minHeight: t.collected > 0 ? 3 : 0 }}
                        />
                      </div>
                      <span className={`text-[8px] font-bold ${isLast ? 'text-accent' : 'text-gray-600'}`}>
                        {t.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {!trendLoading && trend.every(t => t.collected === 0) && (
              <p className="text-gray-600 text-xs text-center py-4">No payment data in last 6 months.</p>
            )}
          </motion.div>

          {/* ── Top Overdue Students ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Top Overdue Students
              </p>
              <span className="text-[9px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full">
                {due.length} students
              </span>
            </div>
            {topOverdue.length === 0 ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                  <Award size={18} className="text-emerald-400" />
                </div>
                <p className="text-white text-sm font-bold">All Clear!</p>
                <p className="text-gray-500 text-xs mt-1">No overdue students 🎉</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topOverdue.map((s, i) => {
                  const name     = s.fullName || s.name || 'Student';
                  const pending  = calcPendingMonths(s);
                  const due      = calcDueAmount(s);
                  const severity = getDueSeverity(pending);
                  return (
                    <div key={s.studentId} className="flex items-center gap-3">
                      <span className="text-gray-600 text-[10px] font-black w-4 text-right">{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg bg-navy-800 border border-white/5 overflow-hidden flex-shrink-0">
                        <Avatar src={s.avatar} name={name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{name}</p>
                        <p className="text-gray-600 text-[9px]">{s.batchId || '—'} • {s.assignedCoachId || s.coach || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-black ${
                          severity === 'red' ? 'text-red-400' :
                          severity === 'orange' ? 'text-orange-400' : 'text-yellow-400'
                        }`}>
                          ₹{due.toLocaleString()}
                        </p>
                        <p className="text-gray-600 text-[9px]">{pending} month{pending > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Batch-wise Breakdown ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Batch-wise Pending Revenue
            </p>
            {batchBreakdown.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">No batch data available.</p>
            ) : (
              <div className="space-y-3">
                {batchBreakdown.map(b => (
                  <div key={b.batch}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold">{b.batch}</span>
                        <span className="text-gray-600 text-[9px]">{b.count} students</span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-500 text-xs font-bold">
                          {b.pending > 0 ? formatCurrency(b.pending) : '—'}
                        </span>
                        {b.due > 0 && (
                          <span className="text-red-400 text-[9px] ml-1.5">({b.due} due)</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(b.pending / maxBatchPending) * 100}%` }}
                        transition={{ duration: 0.7 }}
                        className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Coach-wise Breakdown ── */}
          <motion.div variants={fadeUp} className="glass rounded-3xl p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Coach-wise Pending Revenue
            </p>
            {coachBreakdown.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">No coach data available.</p>
            ) : (
              <div className="space-y-3">
                {coachBreakdown.map(c => (
                  <div key={c.coach}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold">{c.coach}</span>
                        <span className="text-gray-600 text-[9px]">{c.count} students</span>
                      </div>
                      <div className="text-right">
                        <span className="text-accent text-xs font-bold">
                          {c.pending > 0 ? formatCurrency(c.pending) : '—'}
                        </span>
                        {c.due > 0 && (
                          <span className="text-red-400 text-[9px] ml-1.5">({c.due} due)</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.pending / maxCoachPending) * 100}%` }}
                        transition={{ duration: 0.7 }}
                        className="h-full bg-gradient-to-r from-accent/80 to-yellow-300 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

        </motion.div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

const KpiCard = ({ label, value, sub, color, glow, icon }) => (
  <div className={`glass rounded-3xl p-4 relative overflow-hidden`}>
    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${glow} to-transparent blur-2xl pointer-events-none`} />
    <div className="flex items-center gap-1.5 mb-2 relative z-10">
      {icon}
      <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">{label}</p>
    </div>
    <h3 className={`text-lg md:text-xl font-black ${color} relative z-10`}>{value}</h3>
    {sub && <p className="text-gray-600 text-[9px] mt-0.5 relative z-10">{sub}</p>}
  </div>
);

const StatusPill = ({ label, count, color }) => (
  <div className="glass rounded-2xl p-3 text-center">
    <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-1.5`} />
    <p className="text-white text-base font-black">{count}</p>
    <p className="text-gray-600 text-[9px] font-bold uppercase">{label}</p>
  </div>
);

export default FeeAnalytics;
