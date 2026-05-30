import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Calendar as CalendarIcon, Search, CheckCircle2, Loader2, Download, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  submitCoachAttendance, 
  getCoachAttendanceByDate, 
  getCoachAttendanceHistory,
  subscribeToCoachAttendance 
} from '../services/coachAttendanceService';
import { getAllCoaches } from '../services/coachService';
import { exportData, formatAttendanceForExport } from '../lib/exportUtils';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

const CoachAttendance = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [search, setSearch] = useState('');
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Coach Calendar State
  const [history, setHistory] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString();
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Load coaches & attendance
  useEffect(() => {
    if (authLoading || !user) return;
    
    const loadData = async () => {
      if (isAdmin()) {
        try {
          const coachesList = await getAllCoaches();
          setCoaches(coachesList);
          
          setAttendanceData((prev) => {
            const init = { ...prev };
            coachesList.forEach((c) => { if (!(c.coachId in init)) init[c.coachId] = null; });
            return init;
          });

          // Load already submitted attendance for today
          const records = await getCoachAttendanceByDate(today);
          if (records.length > 0) {
            const map = {};
            records.forEach((r) => { map[r.coachId] = r.present ? 'present' : 'absent'; });
            setAttendanceData(map);
            setSubmitted(true);
          }
        } catch (err) {
          console.error("Error loading coach data:", err);
        } finally {
          setLoading(false);
        }
      } else {
        // Coach view
        try {
          const hist = await getCoachAttendanceHistory(user.uid);
          setHistory(hist);
        } catch (err) {
          console.error("Error loading history:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [authLoading, user, today, isAdmin]);

  // Handle Admin Attendance Toggling
  const toggleAttendance = (id, status) => {
    setAttendanceData((prev) => ({ ...prev, [id]: prev[id] === status ? null : status }));
  };

  const markAll = (status) => {
    const newData = {};
    filteredCoaches.forEach((c) => { newData[c.coachId] = status; });
    setAttendanceData((prev) => ({ ...prev, ...newData }));
  };

  const filteredCoaches = coaches.filter((coach) => {
    const name = (coach.name || coach.fullName || '').toLowerCase();
    const spec = (coach.specialization || '').toLowerCase();
    return name.includes(search.toLowerCase()) || spec.includes(search.toLowerCase());
  });

  const totalMarked = Object.values(attendanceData).filter((v) => v !== null).length;

  const handleSubmit = async () => {
    if (submitting) return;
    const records = coaches
      .filter((c) => attendanceData[c.coachId] !== null && attendanceData[c.coachId] !== undefined)
      .map((c) => ({
        coachId: c.coachId,
        present: attendanceData[c.coachId] === 'present',
      }));

    if (records.length === 0) {
      alert('Please mark at least one coach before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCoachAttendance(records, user?.uid || 'unknown', today);
      setSubmitted(true);
    } catch (err) {
      console.error('Attendance submit error:', err);
      alert('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    const records = await getCoachAttendanceByDate(today);
    // Format for export using existing util, mapped slightly for coach
    const formatted = records.map(r => ({
      'Date': r.date,
      'Coach ID': r.coachId,
      'Status': r.present ? 'Present' : 'Absent',
      'Marked By': r.markedBy
    }));
    exportData(formatted, `coach_attendance_${today}`, 'xlsx');
  };

  // Calendar Helpers for Coach View
  const handlePrevMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  
  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const days = [];
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const prevMonthDaysCount = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthDaysCount - i), isCurrentMonth: false });
    }
    const currentMonthDaysCount = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthDaysCount; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const totalCells = 42;
    const nextMonthDaysCount = totalCells - days.length;
    for (let i = 1; i <= nextMonthDaysCount; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  // Render Admin View
  if (isAdmin()) {
    return (
      <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
        <header className="mb-4 md:mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Coach Attendance</h1>
              <p className="text-indigo-400 text-xs uppercase tracking-wider mt-1">{todayLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl glass flex items-center justify-center text-indigo-400"
              >
                <Download size={18} />
              </button>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CalendarIcon size={18} />
              </div>
            </div>
          </div>

          {submitted && (
            <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-xs font-medium">Coach attendance for today is submitted. You can update it anytime today.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Search coach..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-navy-800 border border-indigo-500/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            <div className="glass p-3 md:p-4 rounded-2xl flex justify-between items-center border border-indigo-500/10">
              <div className="flex-1 mr-4">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">
                  Progress: {totalMarked}/{coaches.length}
                </p>
                <div className="w-full h-1.5 bg-navy-900/50 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: coaches.length > 0 ? `${(totalMarked / coaches.length) * 100}%` : '0%' }}
                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  />
                </div>
              </div>
              <button 
                onClick={() => markAll('present')}
                className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
              >
                Mark All Present
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-1 scroll-smooth grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-max pb-20 lg:pb-32">
          {loading ? (
            <div className="col-span-full flex justify-center items-center py-20">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
            </div>
          ) : (
            filteredCoaches.map((coach) => {
              const name   = coach.name || coach.fullName || 'Coach';
              const spec   = coach.specialization || 'General Coach';
              const avatar = coach.avatar || '';
              const status = attendanceData[coach.coachId];

              return (
                <div key={coach.coachId} className="glass p-3 rounded-2xl flex items-center gap-3 md:gap-4 border border-indigo-500/5 hover:border-indigo-500/20 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-navy-800 overflow-hidden border border-white/5 flex-shrink-0">
                    <Avatar src={avatar} name={name} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-bold truncate">{name}</h3>
                    <p className="text-[10px] text-gray-500 truncate">{spec}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAttendance(coach.coachId, 'absent')}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                        status === 'absent' 
                          ? "bg-red-500 text-white border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                          : "bg-navy-800 text-gray-600 border-white/5"
                      )}
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => toggleAttendance(coach.coachId, 'present')}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                        status === 'present' 
                          ? "bg-indigo-500 text-white border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
                          : "bg-navy-800 text-gray-600 border-white/5"
                      )}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!loading && filteredCoaches.length === 0 && (
            <div className="py-10 text-center col-span-full">
              <p className="text-gray-500 text-sm italic">No coaches found...</p>
            </div>
          )}
        </div>

        <div className="lg:static fixed bottom-28 left-6 right-6 lg:mt-6 lg:mb-10 z-10">
          <button
            onClick={handleSubmit}
            disabled={submitting || totalMarked === 0}
            className="w-full lg:max-w-md lg:mx-auto bg-indigo-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={20} className="animate-spin" /> {submitted ? 'Updating...' : 'Submitting...'}</>
            ) : (
              <><CheckCircle2 size={20} /> {submitted ? 'Update Daily Attendance' : 'Submit Daily Attendance'}</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Render Coach View (Calendar)
  const days = getCalendarDays();
  const year = calendarDate.getFullYear();
  const monthStr = String(calendarDate.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${year}-${monthStr}`;
  const monthRecords = history.filter(r => r.date?.startsWith(monthPrefix));
  const presentDays = monthRecords.filter(r => r.present).length;

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">My Attendance</h1>
        <p className="text-gray-400 text-xs mt-1">Review your monthly attendance records</p>
      </header>

      <div className="glass rounded-3xl p-5 border border-indigo-500/20 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="w-8 h-8 rounded-xl bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-white font-bold min-w-[120px] text-center text-lg">
              {calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={handleNextMonth} className="w-8 h-8 rounded-xl bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">Present Days</p>
            <p className="text-white text-lg font-black">{presentDays}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center py-2 text-indigo-300/60 text-[10px] uppercase font-bold tracking-widest">
              {day}
            </div>
          ))}
          
          {days.map((day, idx) => {
            const dateKey = formatDateKey(day.date);
            const record = history.find(r => r.date === dateKey);
            const isToday = dateKey === today;
            let status = 'none';
            if (record) {
              status = record.present ? 'present' : 'absent';
            }

            return (
              <div
                key={idx}
                className={cn(
                  "aspect-square rounded-2xl flex flex-col justify-center items-center relative overflow-hidden transition-all duration-300",
                  !day.isCurrentMonth && "opacity-30",
                  status === 'present' && "bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]",
                  status === 'absent' && day.isCurrentMonth && "bg-red-500/5 border border-red-500/10",
                  status === 'none' && "bg-navy-800/40 border border-white/5",
                  isToday && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-navy-900"
                )}
              >
                <span className={cn(
                  "text-sm md:text-base font-bold z-10",
                  status === 'present' ? "text-indigo-300" : (status === 'absent' ? "text-red-400" : "text-gray-400")
                )}>
                  {day.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CoachAttendance;
