import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, UserMinus, CreditCard, Home, PlusCircle,
  ClipboardCheck, Wallet, TrendingUp, Search, Clock,
  IndianRupee, Loader2, AlertCircle, BarChart2, Shirt, Briefcase
} from 'lucide-react';
import { subscribeToStudents } from '../services/studentService';
import { getAttendanceByDate } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { getCoachSalarySettings, getCoachSalaryPayments, calculateEarnedSalary } from '../services/coachSalaryService';
import { getCoachAttendanceHistory } from '../services/coachAttendanceService';
import {
  calcPendingMonths, calcTotalPendingRevenue, calcExpectedMonthlyRevenue, formatCurrency,
} from '../lib/feeCalculations';

const Dashboard = ({ setActiveTab }) => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [students,     setStudents]     = useState([]);
  const [presentToday, setPresentToday] = useState(0);
  const [loading,      setLoading]      = useState(true);

  // Coach-specific state
  const [coachSettings,  setCoachSettings]  = useState(null);
  const [coachEarnings,  setCoachEarnings]  = useState(0);
  const [coachPaid,      setCoachPaid]      = useState(0);
  const [coachDue,       setCoachDue]       = useState(0);
  const [todayAttendance,setTodayAttendance]= useState(null);
  const [coachLoading,   setCoachLoading]   = useState(false);

  const isUserAdmin = isAdmin ? isAdmin() : false;

  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const isSunday = new Date().getDay() === 0;

  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    try {
      const unsub = subscribeToStudents((data) => {
        setStudents(data);
        setLoading(false);
      });
      getAttendanceByDate(today).then(records => {
        setPresentToday(records.filter(r => r.present).length);
      }).catch(err => setErrorMsg(err.message));
      return () => unsub();
    } catch (err) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  }, [authLoading, user, today]);

  useEffect(() => {
    if (authLoading || !user || isUserAdmin) return;
    const fetchCoachData = async () => {
      setCoachLoading(true);
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const settings   = await getCoachSalarySettings(user.uid);
        setCoachSettings(settings);
        const attHistory = await getCoachAttendanceHistory(user.uid);
        const todayStr   = new Date().toISOString().split('T')[0];
        setTodayAttendance(attHistory.find(r => r.date === todayStr) || null);
        const payments   = await getCoachSalaryPayments(user.uid);
        const earned     = calculateEarnedSalary(attHistory, settings, currentMonth);
        setCoachEarnings(earned);
        const paidThisMonth = payments
          .filter(p => p.month === currentMonth)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        setCoachPaid(paidThisMonth);
        setCoachDue(Math.max(0, earned - paidThisMonth));
      } catch (err) {
        console.error('Error loading coach dashboard:', err);
      } finally {
        setCoachLoading(false);
      }
    };
    fetchCoachData();
  }, [authLoading, user, isUserAdmin, today]);

  /* ── Derived stats ── */
  const activeStudents  = useMemo(() => students.filter(s => s.status !== 'removed'), [students]);
  const removedStudents = useMemo(() => students.filter(s => s.status === 'removed'),  [students]);
  const dueStudents     = useMemo(() => activeStudents.filter(s => calcPendingMonths(s) > 0), [activeStudents]);
  const hostelersCount  = useMemo(() =>
    activeStudents.filter(s => s.hostelType === 'Hosteler' || s.type === 'Hosteler').length,
    [activeStudents]);
  const dressGivenCount = useMemo(() => activeStudents.filter(s => s.dressGiven).length, [activeStudents]);
  const kitGivenCount   = useMemo(() => activeStudents.filter(s => s.kitGiven).length, [activeStudents]);

  const pendingRevenue  = useMemo(() => calcTotalPendingRevenue(activeStudents),    [activeStudents]);
  const expectedRevenue = useMemo(() => calcExpectedMonthlyRevenue(activeStudents), [activeStudents]);
  const collected       = useMemo(() =>
    activeStudents.reduce((sum, s) => sum + (s.feesPaid || 0), 0), [activeStudents]);
  const collectionPct   = expectedRevenue > 0 ? Math.round((collected / expectedRevenue) * 100) : 0;

  const displayName = user?.name || user?.email?.split('@')[0] || 'Coach';

  const containerVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  const quickActions = isUserAdmin ? [
    { icon: PlusCircle,     label: 'Add Student',  color: 'bg-amber-500',  tab: 'students'     },
    { icon: ClipboardCheck, label: 'Student Att.', color: 'bg-orange-500', tab: 'attendance'   },
    { icon: UserCheck,      label: 'Coach',        color: 'bg-green-500',  tab: 'coach'        },
    { icon: CreditCard,     label: 'Due Fees',     color: 'bg-red-500',    tab: 'fees'         },
    { icon: Wallet,         label: 'Record Pay',   color: 'bg-blue-600',   tab: 'fees'         },
  ] : [
    { icon: PlusCircle,     label: 'Add Student',  color: 'bg-amber-500',  tab: 'students'     },
    { icon: ClipboardCheck, label: 'Student Att.', color: 'bg-orange-500', tab: 'attendance'      },
    { icon: CreditCard,     label: 'Due Fees',     color: 'bg-red-500',    tab: 'fees'         },
    { icon: Wallet,         label: 'Record Pay',   color: 'bg-blue-600',   tab: 'fees'         },
    { icon: UserCheck,      label: 'My Att.',     color: 'bg-green-500',  tab: 'coach-attendance' },
    { icon: IndianRupee,    label: 'My Salary',   color: 'bg-blue-600',   tab: 'coach-salary'    },
  ];

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 overflow-y-auto h-full scroll-smooth">
      <motion.header
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-between items-center mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {isUserAdmin ? 'Hello Jabali Sir 👋' : `Hey, ${displayName}! 👋`}
          </h1>
          <p className="text-gray-400 text-[10px] md:text-sm uppercase tracking-wider">{todayLabel}</p>
          {isSunday && isUserAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2.5 py-1 rounded-full"
            >
              <AlertCircle size={9} /> Sunday — Check Due Students!
            </motion.div>
          )}
        </div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl glass flex items-center justify-center">
          <Search size={18} className="text-gray-400" />
        </div>
      </motion.header>

      {errorMsg && (
        <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-xl mb-6">
          <p className="font-bold">Error loading data:</p>
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* ── Hero Bento Grid ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bento-grid"
      >
        {/* Large hero card */}
        <motion.div variants={itemVariants} className="bento-item-large glass-accent rounded-3xl p-5 md:p-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-accent text-[10px] font-bold uppercase tracking-widest mb-1">Active Students</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
              {loading ? '—' : activeStudents.length}
            </h2>
            {isUserAdmin && removedStudents.length > 0 && (
              <p className="text-gray-500 text-[9px] mb-2">{removedStudents.length} removed</p>
            )}
            <div className="flex items-center gap-2 text-accent text-[10px] md:text-sm bg-accent/10 w-fit px-3 py-1 rounded-full border border-accent/20">
              <TrendingUp size={12} />
              <span>Live from Firestore</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Users size={100} className="text-accent" />
          </div>
        </motion.div>

        {/* Present today */}
        <motion.div variants={itemVariants} className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-accent/10 rounded-xl flex items-center justify-center mb-2">
            <UserCheck size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] md:text-xs font-medium">Present</p>
            <h3 className="text-xl md:text-2xl font-bold text-white">{presentToday}</h3>
          </div>
        </motion.div>

        {/* Absent */}
        <motion.div variants={itemVariants} className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 rounded-xl flex items-center justify-center mb-2">
            <UserMinus size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] md:text-xs font-medium">Absent</p>
            <h3 className="text-xl md:text-2xl font-bold text-white">
              {activeStudents.length - presentToday}
            </h3>
          </div>
        </motion.div>

        {isUserAdmin ? (
          <>
            {/* Due fees card */}
            <motion.div
              onClick={() => setActiveTab('fees')}
              variants={itemVariants}
              className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-2">
                <CreditCard size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">Due Fees</p>
                <h3 className="text-lg md:text-xl font-bold text-white">{dueStudents.length}</h3>
                {dueStudents.length > 0 && (
                  <p className="text-amber-500 text-[9px] font-bold">{formatCurrency(pendingRevenue)} pending</p>
                )}
              </div>
            </motion.div>

            {/* Hostel */}
            <motion.div variants={itemVariants} className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-2">
                <Home size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">Hostel</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{hostelersCount}</h3>
              </div>
            </motion.div>

            {/* Dress Issued */}
            <motion.div variants={itemVariants} className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-2">
                <Shirt size={18} className="text-purple-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">Dress Issued</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{dressGivenCount}</h3>
              </div>
            </motion.div>

            {/* Kit Issued */}
            <motion.div variants={itemVariants} className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-500/10 rounded-xl flex items-center justify-center mb-2">
                <Briefcase size={18} className="text-teal-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">Kit Issued</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{kitGivenCount}</h3>
              </div>
            </motion.div>
          </>
        ) : (
          <>
            <motion.div
              onClick={() => setActiveTab('coach-salary')}
              variants={itemVariants}
              className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-2">
                <IndianRupee size={18} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">My Earnings</p>
                <h3 className="text-lg md:text-xl font-bold text-white">₹{coachEarnings.toLocaleString()}</h3>
              </div>
            </motion.div>

            <motion.div
              onClick={() => setActiveTab('coach-salary')}
              variants={itemVariants}
              className="glass rounded-3xl p-4 md:p-5 flex flex-col justify-between aspect-square cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-2">
                <Wallet size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-xs font-medium">Due Payout</p>
                <h3 className="text-lg md:text-xl font-bold text-white">₹{coachDue.toLocaleString()}</h3>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Admin — Monthly Revenue Summary ── */}
      {isUserAdmin && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => setActiveTab('fee-analytics')}
          className="mt-5 glass-accent rounded-3xl p-4 cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Monthly Target</p>
            <span className="text-accent text-[10px] font-black">{Math.min(collectionPct, 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-navy-900/50 rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, collectionPct)}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-accent rounded-full"
            />
          </div>
          <div className="flex justify-between text-[9px] font-bold">
            <span className="text-accent">{formatCurrency(collected)} / {formatCurrency(expectedRevenue)}</span>
            <span className="text-gray-500">{formatCurrency(pendingRevenue)} left</span>
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions ── */}
      <div className="mt-8 md:mt-10">
        <h3 className="text-white text-sm md:text-base font-bold mb-4 ml-1">Quick Actions</h3>
        <div className={`grid gap-3 md:gap-4 ${isUserAdmin ? 'grid-cols-5' : 'grid-cols-3'}`}>
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(action.tab)}
              className="flex flex-col items-center gap-2"
            >
              <div className={`${action.color} w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-md text-white`}>
                <action.icon size={24} />
              </div>
              <span className="text-[9px] md:text-[11px] text-gray-400 font-medium text-center leading-tight">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Coach-specific section ── */}
      {!isUserAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 md:mt-10">
          {/* Wage Agreement */}
          <div className="glass rounded-3xl p-5 md:p-6 relative overflow-hidden border border-white/5">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-accent/5 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee size={18} className="text-accent" strokeWidth={2.5} />
              <h3 className="text-white font-bold text-sm md:text-base">Wage Agreement</h3>
            </div>
            {coachLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="animate-spin text-accent" size={16} />
                <span className="text-gray-500 text-xs">Loading agreement...</span>
              </div>
            ) : coachSettings ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-navy-800/40 p-3 rounded-2xl border border-white/5">
                    <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Salary Type</p>
                    <p className="text-white text-xs font-black capitalize mt-1">
                      {coachSettings.salaryType?.replace('_', ' ') || 'Monthly'}
                    </p>
                  </div>
                  <div className="bg-navy-800/40 p-3 rounded-2xl border border-white/5">
                    <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Rate</p>
                    <p className="text-green-400 text-xs font-black mt-1">
                      ₹{(coachSettings.rate || 0).toLocaleString()}
                      {coachSettings.salaryType === 'monthly' ? '/mo' : coachSettings.salaryType === 'per_session' ? '/session' : '/hr'}
                    </p>
                  </div>
                </div>
                <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                  <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Calculation Model</p>
                  <p className="text-gray-300 text-[11px] mt-1.5 leading-relaxed">
                    {coachSettings.salaryType === 'monthly'     && 'Your compensation is a flat monthly salary.'}
                    {coachSettings.salaryType === 'per_session' && 'Your earnings are computed per session logged.'}
                    {coachSettings.salaryType === 'per_hour'    && 'Your compensation is calculated per hour worked.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-xs italic">No active wage settings configured by admin.</p>
            )}
          </div>

          {/* Today's Shift */}
          <div className="glass rounded-3xl p-5 md:p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-accent" strokeWidth={2.5} />
              <h3 className="text-white font-bold text-sm md:text-base">Today's Shift Status</h3>
            </div>
            {coachLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="animate-spin text-accent" size={16} />
                <span className="text-gray-500 text-xs">Checking today's log...</span>
              </div>
            ) : todayAttendance ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Status:</span>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    todayAttendance.status === 'checked-in'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-green-500/10 text-green-500 border-green-500/20'
                  }`}>
                    {todayAttendance.status === 'checked-in' ? 'On Duty' : 'Shift Completed'}
                  </span>
                </div>
                <div className="bg-navy-800/40 p-3 rounded-2xl border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Checked In:</span>
                    <span className="text-white font-medium">
                      {todayAttendance.checkIn ? new Date(todayAttendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Checked Out:</span>
                    <span className="text-white font-medium">
                      {todayAttendance.checkOut ? new Date(todayAttendance.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-gray-500">Duration:</span>
                    <span className="text-accent font-bold">
                      {todayAttendance.status === 'checked-in' ? 'Active...' : `${todayAttendance.duration || 0} min`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-navy-800 border border-white/5 flex items-center justify-center text-gray-500 mb-2">
                  <Clock size={16} />
                </div>
                <p className="text-white text-xs font-semibold">Not Marked Yet</p>
                <p className="text-gray-500 text-[10px] mt-1 max-w-[200px]">
                  Your attendance has not been logged by the administrator for today.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recent Students ── */}
      <div className="mt-8 md:mt-10">
        <div className="flex justify-between items-center mb-4 ml-1">
          <h3 className="text-white font-bold">Recent Students</h3>
          <button
            onClick={() => setActiveTab('students')}
            className="bg-accent/20 text-accent text-[10px] font-bold px-3 py-1 rounded-lg border border-accent/20"
          >
            See all
          </button>
        </div>
        <div className="space-y-3">
          {activeStudents.slice(0, 5).map((student, i) => {
            const pendingMonths = calcPendingMonths(student);
            return (
            <div key={student.studentId || i} className="glass rounded-2xl p-3 md:p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy-800 border border-white/5 overflow-hidden flex-shrink-0">
                <Avatar src={student.avatar} name={student.fullName || student.name || 'Student'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{student.fullName || student.name || 'Student'}</p>
                <p className="text-gray-500 text-xs">
                  {student.hostelType || student.type || 'Local'} • {student.batchId || 'No Batch'}
                </p>
              </div>
              {pendingMonths > 0 ? (
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
                    ⚠ {pendingMonths} mo due
                  </span>
                  <span className="text-[8px] text-red-400/70 mt-0.5">
                    ₹{(pendingMonths * (Number(student.monthlyFees)||0)).toLocaleString()}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">✓ Clear</span>
              )}
            </div>
          );})}
          {activeStudents.length === 0 && !loading && (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-gray-500 text-sm">No students yet. Add your first student!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
