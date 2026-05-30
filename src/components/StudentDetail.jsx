import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, IndianRupee, MapPin, Home, CheckCircle2, 
  AlertCircle, Phone, MessageSquare, ClipboardList,
  Edit2, Trash2, UserMinus, Save, Loader2, Pencil
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { softRemoveStudent, deleteStudent, updateStudent } from '../services/studentService';
import { getAttendanceByStudent } from '../services/attendanceService';
import { getPaymentsByStudent, addPayment } from '../services/paymentService';
import Avatar from './Avatar';
import { calcPendingMonths, calcDueAmount, getDueSeverity, getSeverityBadgeClass, getSeverityLabel, formatCurrency } from '../lib/feeCalculations';

const StudentDetail = ({ student: initialStudent, onClose }) => {
  if (!initialStudent) return null;

  const { isAdmin } = useAuth();
  const [student, setStudent] = useState(initialStudent);
  
  // States for student info
  const [attendance, setAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // States for Record Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', monthsPaid: '', paymentDate: new Date().toISOString().split('T')[0], paymentMode: 'Cash', remarks: '' });
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const [attRecords, payRecords] = await Promise.all([
          getAttendanceByStudent(student.studentId),
          getPaymentsByStudent(student.studentId)
        ]);
        setAttendance(attRecords);
        setPayments(payRecords);
      } catch (err) {
        console.error("Error fetching student details:", err);
      } finally {
        setLoading(false);
      }
    };
    if (student?.studentId) {
      fetchStudentData();
    }
  }, [student?.studentId]);

  // Handle Remove/Delete
  const handleRemove = async () => {
    const name = student.fullName || student.name;
    if (window.confirm(`Remove ${name} from active list? Their data will be preserved and can be restored later.`)) {
      try {
        await softRemoveStudent(student.studentId);
        onClose();
      } catch (err) {
        console.error('Error removing student:', err);
        alert('Failed to remove student.');
      }
    }
  };

  const handlePermanentDelete = async () => {
    const name = student.fullName || student.name;
    const confirmed = window.confirm(`⚠️ PERMANENT DELETE\n\nThis will delete ${name} and ALL their data forever.\n\nAre you sure you want to proceed?`);
    if (!confirmed) return;
    try {
      await deleteStudent(student.studentId);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Delete failed.');
    }
  };

  // Handle Edit Profile
  const startEdit = () => {
    setEditForm({
      name: student.name || student.fullName || '',
      contactNumber: student.contactNumber || student.mobile || '',
      monthlyFees: student.monthlyFees || 0,
      totalMonthsPaid: student.totalMonthsPaid || 0,
      batchId: student.batchId || '',
      assignedCoachId: student.assignedCoachId || student.coach || '',
      hostelType: student.hostelType || student.type || 'Local',
      joiningDate: student.joiningDate || '',
      leavingDate: student.leavingDate || '',
      dressGiven: student.dressGiven || false,
      kitGiven: student.kitGiven || false,
      impStudent: student.impStudent || false,
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const updates = {
        name: editForm.name,
        contactNumber: editForm.contactNumber,
        monthlyFees: Number(editForm.monthlyFees),
        totalMonthsPaid: Number(editForm.totalMonthsPaid),
        batchId: editForm.batchId,
        assignedCoachId: editForm.assignedCoachId,
        hostelType: editForm.hostelType,
        joiningDate: editForm.joiningDate,
        leavingDate: editForm.leavingDate,
        dressGiven: editForm.dressGiven,
        kitGiven: editForm.kitGiven,
        impStudent: editForm.impStudent,
      };
      await updateStudent(student.studentId, updates);
      setStudent(prev => ({ ...prev, ...updates }));
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update student profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setIsPaying(true);
    try {
      await addPayment({
        studentId: student.studentId,
        amount: Number(payForm.amount),
        monthsPaid: Number(payForm.monthsPaid) || 0,
        paymentDate: payForm.paymentDate,
        paymentMode: payForm.paymentMode,
        remarks: payForm.remarks,
      });
      // Adjust local state immediately to avoid reload
      const addedMonths = Number(payForm.monthsPaid) || 0;
      if (addedMonths > 0) {
        setStudent(prev => ({
          ...prev,
          totalMonthsPaid: (Number(prev.totalMonthsPaid) || 0) + addedMonths
        }));
      }
      
      const newPayRecords = await getPaymentsByStudent(student.studentId);
      setPayments(newPayRecords);
      setShowPayModal(false);
      setPayForm({ amount: '', monthsPaid: '', paymentDate: new Date().toISOString().split('T')[0], paymentMode: 'Cash', remarks: '' });
    } catch (err) {
      console.error(err);
      alert('Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const getCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) { days.push({ day: '', status: 'empty' }); }
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = attendance.find(r => r.date === dateStr);
      let status = 'unmarked';
      if (record) status = record.present ? 'present' : 'absent';
      days.push({ day, status });
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const pendingMonths = calcPendingMonths(student);
  const dueAmount     = calcDueAmount(student);
  const severity      = getDueSeverity(pendingMonths);

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
        <button onClick={onClose} className="w-10 h-10 rounded-full glass flex items-center justify-center text-white">
          <X size={20} />
        </button>
        <h2 className="text-white font-bold">Student Profile</h2>
        {isAdmin() ? (
          <div className="flex gap-2">
            {!isEditing && (
              <button onClick={startEdit} className="w-10 h-10 rounded-full glass flex items-center justify-center text-blue-400">
                <Edit2 size={16} />
              </button>
            )}
            <button onClick={handleRemove} className="w-10 h-10 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 flex items-center justify-center" title="Remove (Archive)">
              <UserMinus size={16} />
            </button>
            <button onClick={handlePermanentDelete} className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 flex items-center justify-center" title="Permanent Delete">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      <div className="px-6 pb-12 flex-1">
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-3xl bg-navy-800 border-2 border-white/5 overflow-hidden mb-4 shadow-2xl flex-shrink-0">
            <Avatar src={student.avatar} name={student.name || student.fullName} />
          </div>
          
          {isEditing ? (
            <input 
              type="text" 
              value={editForm.name} 
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="text-2xl font-bold text-center bg-navy-800 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-accent"
            />
          ) : (
            <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              {student.name || student.fullName}
              {student.impStudent && <span className="text-amber-500 text-2xl">★</span>}
            </h1>
          )}

          {isEditing ? (
            <div className="mt-2 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Coach</p>
              <input 
                type="text" 
                value={editForm.assignedCoachId} 
                onChange={e => setEditForm(f => ({ ...f, assignedCoachId: e.target.value }))}
                className="bg-navy-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-accent focus:outline-none"
              />
            </div>
          ) : (
            <p className="text-accent text-sm font-medium mt-1">Coach {student.coach || student.assignedCoachId}</p>
          )}
          
          {!isEditing && (
            <div className="flex gap-4 mt-6">
              <button className="w-12 h-12 rounded-2xl glass-accent text-accent flex items-center justify-center shadow-lg">
                <Phone size={20} />
              </button>
              <button className="w-12 h-12 rounded-2xl glass text-white flex items-center justify-center shadow-lg">
                <MessageSquare size={20} />
              </button>
              <button onClick={() => setShowPayModal(true)} className="px-6 h-12 rounded-2xl bg-accent text-navy-900 font-bold flex items-center gap-2 shadow-lg hover:bg-accent/90 active:scale-95 transition-all">
                <IndianRupee size={18} />
                Pay Due
              </button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="glass p-5 rounded-3xl mb-8 space-y-4">
            <h3 className="text-white font-bold mb-2">Edit Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Mobile Number</label>
                <input type="text" value={editForm.contactNumber} onChange={e => setEditForm(f => ({ ...f, contactNumber: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Batch ID</label>
                <input type="text" value={editForm.batchId} onChange={e => setEditForm(f => ({ ...f, batchId: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Monthly Fee (₹)</label>
                <input type="number" value={editForm.monthlyFees} onChange={e => setEditForm(f => ({ ...f, monthlyFees: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Total Months Paid</label>
                <input type="number" value={editForm.totalMonthsPaid} onChange={e => setEditForm(f => ({ ...f, totalMonthsPaid: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Hostel Type</label>
                <select value={editForm.hostelType} onChange={e => setEditForm(f => ({ ...f, hostelType: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  <option>Local</option>
                  <option>Hosteler</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Joining Date</label>
                <input type="date" value={editForm.joiningDate} onChange={e => setEditForm(f => ({ ...f, joiningDate: e.target.value }))} className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 py-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editDress" checked={editForm.dressGiven} onChange={e => setEditForm(f => ({ ...f, dressGiven: e.target.checked }))} className="w-4 h-4 accent-amber-500 rounded" />
                <label htmlFor="editDress" className="text-xs text-white">Dress Given</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editKit" checked={editForm.kitGiven} onChange={e => setEditForm(f => ({ ...f, kitGiven: e.target.checked }))} className="w-4 h-4 accent-amber-500 rounded" />
                <label htmlFor="editKit" className="text-xs text-white">Kit Given</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editImp" checked={editForm.impStudent} onChange={e => setEditForm(f => ({ ...f, impStudent: e.target.checked }))} className="w-4 h-4 accent-amber-500 rounded" />
                <label htmlFor="editImp" className="text-xs font-bold text-amber-500">Important</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsEditing(false)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
              <button onClick={saveEdit} disabled={isSaving} className="flex-1 bg-accent text-navy-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
              </button>
            </div>
          </div>
        )}

        {!isEditing && (
          <>
            {/* Info Grid (Bento) */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="glass p-4 rounded-3xl col-span-2 flex justify-between items-center px-6">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1.5">Joining Date</p>
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Calendar size={14} className="text-accent" />
                    <span className="text-xs">{student.joiningDate || '—'}</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10 mx-2" />
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1.5">Phone</p>
                  <div className="flex items-center gap-2 text-white font-bold justify-end">
                    <Phone size={14} className="text-accent" />
                    <span className="text-xs">{student.contactNumber || student.mobile || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="glass p-4 rounded-3xl">
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Type</p>
                <div className="flex items-center gap-2 text-white font-bold">
                  {(student.hostelType || student.type) === 'Hosteler' ? <Home size={14} className="text-blue-400" /> : <MapPin size={14} className="text-amber-400" />}
                  <span className="text-xs">{student.hostelType || student.type || 'Local'}</span>
                </div>
              </div>
              <div className="glass p-4 rounded-3xl">
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Batch</p>
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className="text-xs">{student.batchId || '—'}</span>
                </div>
              </div>
              
              <div className="glass p-4 rounded-3xl col-span-2">
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Equipment & Status</p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    {student.dressGiven ? <CheckCircle2 size={16} className="text-green-500"/> : <X size={16} className="text-gray-600"/>}
                    <span className="text-white text-xs">Dress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {student.kitGiven ? <CheckCircle2 size={16} className="text-green-500"/> : <X size={16} className="text-gray-600"/>}
                    <span className="text-white text-xs">Kit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {student.impStudent ? <CheckCircle2 size={16} className="text-amber-500"/> : <X size={16} className="text-gray-600"/>}
                    <span className="text-white text-xs">Important</span>
                  </div>
                </div>
              </div>
              
              {/* Smart Fee Info */}
              <div className="glass p-4 rounded-3xl col-span-2">
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Fee Overview</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-navy-800/60 p-2.5 rounded-xl text-center">
                      <p className="text-gray-600 text-[8px] uppercase font-bold">Monthly</p>
                      <p className="text-white text-xs font-bold mt-1">₹{(Number(student.monthlyFees)||0).toLocaleString()}</p>
                    </div>
                    <div className="bg-navy-800/60 p-2.5 rounded-xl text-center">
                      <p className="text-gray-600 text-[8px] uppercase font-bold">Months Paid</p>
                      <p className="text-emerald-400 text-xs font-bold mt-1">{Number(student.totalMonthsPaid)||0}</p>
                    </div>
                    <div className="bg-navy-800/60 p-2.5 rounded-xl text-center">
                      <p className="text-gray-600 text-[8px] uppercase font-bold">Months Due</p>
                      <p className={`text-xs font-bold mt-1 ${pendingMonths > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{pendingMonths}</p>
                    </div>
                  </div>
                  {pendingMonths > 0 && (
                    <div className={`rounded-xl p-3 border flex items-center justify-between ${getSeverityBadgeClass(severity)}`}>
                      <div>
                        <p className="text-sm font-black">₹{dueAmount.toLocaleString()} Due</p>
                        <p className="text-[10px] font-bold opacity-80 mt-0.5">Please record payment to clear dues</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getSeverityBadgeClass(severity)}`}>
                        {getSeverityLabel(pendingMonths)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Calendar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-bold">Attendance</h3>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">{currentMonthName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] text-gray-500">P</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] text-gray-500">A</span>
                  </div>
                </div>
              </div>
              
              <div className="glass p-5 rounded-[2rem]">
                {loading ? (
                  <div className="flex justify-center items-center py-6">
                    <Loader2 className="animate-spin text-gray-500" size={24} />
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                      <div key={d} className="text-center text-gray-600 text-[10px] font-bold mb-2">{d}</div>
                    ))}
                    {calendarDays.map((d, index) => {
                      if (d.status === 'empty') return <div key={`empty-${index}`} className="aspect-square" />;
                      return (
                        <div 
                          key={d.day} 
                          className={cn(
                            "aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all",
                            d.status === 'present' && "bg-green-500 text-white shadow-md shadow-green-500/20",
                            d.status === 'absent' && "bg-red-500 text-white shadow-md shadow-red-500/20",
                            d.status === 'unmarked' && "bg-navy-800 text-gray-500 border border-white/5"
                          )}
                        >
                          {d.day}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Payment History */}
            <div className="mb-4">
              <h3 className="text-white font-bold mb-4">Payment History</h3>
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.paymentId} className="glass p-4 rounded-2xl flex justify-between items-center animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <IndianRupee size={18} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">₹{p.amount?.toLocaleString()}</p>
                        <p className="text-gray-500 text-[10px]">{p.paymentDate} • {p.paymentMode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {p.monthsPaid > 0 && <p className="text-emerald-400 text-[10px] font-bold">+{p.monthsPaid} Months</p>}
                      {p.remarks && <p className="text-gray-500 text-[9px] mt-0.5">{p.remarks}</p>}
                    </div>
                  </div>
                ))}
                {payments.length === 0 && !loading && (
                  <p className="text-gray-500 text-xs italic text-center py-4">No payment records found.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {showPayModal && (
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
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md"
            >
              <div className="sticky top-0 bg-navy-900/95 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-white font-bold flex items-center gap-2"><IndianRupee size={15} className="text-accent" /> Record Payment</h2>
                </div>
                <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="p-6 pb-12 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Amount (₹) *</label>
                  <input type="number" required min="1" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" placeholder="e.g. 5000" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Months Cleared</label>
                  <input type="number" value={payForm.monthsPaid} onChange={e => setPayForm(p => ({ ...p, monthsPaid: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" placeholder="e.g. 1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Payment Date</label>
                    <input type="date" value={payForm.paymentDate} onChange={e => setPayForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Mode</label>
                    <select value={payForm.paymentMode} onChange={e => setPayForm(p => ({ ...p, paymentMode: e.target.value }))}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50">
                      <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Remarks</label>
                  <input type="text" value={payForm.remarks} onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50" placeholder="Optional" />
                </div>
                <button type="submit" disabled={isPaying}
                  className="w-full bg-accent hover:bg-accent/90 text-navy-900 disabled:opacity-60 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-2">
                  {isPaying ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Confirm Payment'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudentDetail;
