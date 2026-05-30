import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Calendar, Search, CheckCircle2, Loader2, Download } from 'lucide-react';
import { subscribeToStudents } from '../services/studentService';
import { submitAttendance, getAttendanceByDate } from '../services/attendanceService';
import { exportData, formatAttendanceForExport } from '../lib/exportUtils';
import { calcPendingMonths, calcDueAmount } from '../lib/feeCalculations';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

const Attendance = () => {
  const { user, loading: authLoading } = useAuth();
  const [students,        setStudents]        = useState([]);
  const [search,          setSearch]          = useState('');
  const [attendanceData,  setAttendanceData]  = useState({});
  const [loading,         setLoading]         = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);

  // Get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today     = getLocalDateString();
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Load students
  useEffect(() => {
    if (authLoading || !user) return;
    const unsub = subscribeToStudents((data) => {
      setStudents(data);
      setAttendanceData((prev) => {
        const init = { ...prev };
        data.forEach((s) => { if (!(s.studentId in init)) init[s.studentId] = null; });
        return init;
      });
      setLoading(false);
    });
    return () => unsub();
  }, [authLoading, user]);

  // Load already submitted attendance for today
  useEffect(() => {
    if (authLoading || !user) return;
    getAttendanceByDate(today).then((records) => {
      if (records.length > 0) {
        const map = {};
        records.forEach((r) => { map[r.studentId] = r.present ? 'present' : 'absent'; });
        setAttendanceData(map);
        setSubmitted(true);
      }
    });
  }, [authLoading, user, today]);

  const toggleAttendance = (id, status) => {
    setAttendanceData((prev) => ({ ...prev, [id]: prev[id] === status ? null : status }));
  };

  const markAll = (status) => {
    const newData = {};
    filteredStudents.forEach((s) => { newData[s.studentId] = status; });
    setAttendanceData((prev) => ({ ...prev, ...newData }));
  };

  const filteredStudents = students.filter((student) => {
    const name  = (student.fullName || student.name || '').toLowerCase();
    const coach = (student.assignedCoachId || student.coach || '').toLowerCase();
    return name.includes(search.toLowerCase()) || coach.includes(search.toLowerCase());
  });

  const totalMarked = Object.values(attendanceData).filter((v) => v !== null).length;

  const handleSubmit = async () => {
    if (submitting) return;
    const records = students
      .filter((s) => attendanceData[s.studentId] !== null && attendanceData[s.studentId] !== undefined)
      .map((s) => ({
        studentId: s.studentId,
        present:   attendanceData[s.studentId] === 'present',
        batchId:   s.batchId  || '',
        coachId:   s.assignedCoachId || user?.uid || '',
      }));

    if (records.length === 0) {
      alert('Please mark at least one student before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitAttendance(records, user?.uid || 'unknown', today);
      setSubmitted(true);
    } catch (err) {
      console.error('Attendance submit error:', err);
      alert('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    const records = await getAttendanceByDate(today);
    exportData(formatAttendanceForExport(records), `attendance_${today}`, 'xlsx');
  };

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
      <header className="mb-4 md:mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Daily Attendance</h1>
            <p className="text-gray-500 text-xs uppercase tracking-wider mt-1">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl glass flex items-center justify-center text-accent"
            >
              <Download size={18} />
            </button>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl glass-accent flex items-center justify-center text-accent">
              <Calendar size={18} />
            </div>
          </div>
        </div>

        {submitted && (
          <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-green-400 text-xs font-medium">Attendance for today has been submitted. You can update it anytime today.</p>
          </div>
        )}

        {/* Search & Progress bar container */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Search student or coach..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600"
            />
          </div>

          <div className="glass p-3 md:p-4 rounded-2xl flex justify-between items-center">
            <div className="flex-1 mr-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">
                Progress: {totalMarked}/{students.length}
              </p>
              <div className="w-full h-1.5 bg-navy-900/50 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: students.length > 0 ? `${(totalMarked / students.length) * 100}%` : '0%' }}
                  className="h-full bg-accent shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                />
              </div>
            </div>
            <button 
              onClick={() => markAll('present')}
              className="bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              Mark All
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pr-1 scroll-smooth grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-max pb-20 lg:pb-32">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-20">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
        ) : (
          filteredStudents.map((student) => {
            const name   = student.fullName || student.name || 'Student';
            const coach  = student.assignedCoachId || student.coach || '—';
            const avatar = student.avatar || '';
            const status = attendanceData[student.studentId];

            return (
              <div key={student.studentId} className="glass p-3 rounded-2xl flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 rounded-xl bg-navy-800 overflow-hidden border border-white/5 flex-shrink-0">
                  <Avatar src={avatar} name={name} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-bold truncate">{name}</h3>
                  <p className="text-[10px] text-gray-500 truncate">{coach}</p>
                  {/* Due fees badge */}
                  {(() => {
                    const months = calcPendingMonths(student);
                    const due    = calcDueAmount(student);
                    if (months <= 0) return null;
                    return (
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                        ⚠ {months} month{months > 1 ? 's' : ''} due &bull; ₹{due.toLocaleString()}
                      </span>
                    );
                  })()}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAttendance(student.studentId, 'absent')}
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
                    onClick={() => toggleAttendance(student.studentId, 'present')}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                      status === 'present' 
                        ? "bg-green-500 text-white border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
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

        {!loading && filteredStudents.length === 0 && (
          <div className="py-10 text-center col-span-full">
            <p className="text-gray-500 text-sm italic">No students found...</p>
          </div>
        )}
      </div>

      <div className="lg:static fixed bottom-28 left-6 right-6 lg:mt-6 lg:mb-10">
        <button
          onClick={handleSubmit}
          disabled={submitting || totalMarked === 0}
          className="w-full lg:max-w-md lg:mx-auto bg-amber-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
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
};

export default Attendance;
