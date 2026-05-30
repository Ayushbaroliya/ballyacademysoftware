import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, ChevronRight, MapPin, Home, CreditCard, X, Loader2, Download } from 'lucide-react';
import { subscribeToStudents, addStudent } from '../services/studentService';
import { exportData, formatStudentsForExport } from '../lib/exportUtils';
import { calcPendingMonths } from '../lib/feeCalculations';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

const Students = ({ onSelectStudent }) => {
  const { user, loading: authLoading } = useAuth();
  const [students,  setStudents]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('All');
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);

  const [form, setForm] = useState({
    fullName: '', fatherName: '', contactNumber: '', dateOfBirth: '',
    address: '', hostelType: 'Local', joiningDate: '', leavingDate: '',
    assignedCoachId: '', batchId: '',
    totalFees: '', feesPaid: '',
    monthlyFees: '', totalMonthsPaid: '0',
    dressGiven: false, kitGiven: false, impStudent: false, status: 'active',
    gender: 'boy'
  });

  const filters = ['All', 'Active', 'Hosteler', 'Local', 'Fees Due', 'Paid', 'Important'];

  useEffect(() => {
    if (authLoading || !user) return;
    const unsub = subscribeToStudents((data) => {
      setStudents(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authLoading, user]);

  // Only show active (non-removed) students in the main directory
  const activeStudents = students.filter(s => s.status !== 'removed');

  const filteredStudents = activeStudents.filter((student) => {
    const searchLower = search.toLowerCase();
    const name   = (student.fullName || student.name || '').toLowerCase();
    const mobile = student.contactNumber || student.mobile || '';
    const dob    = student.dateOfBirth  || student.dob   || '';

    const matchesSearch =
      name.includes(searchLower) ||
      dob.includes(searchLower)  ||
      mobile.includes(searchLower);

    const type      = student.hostelType || student.type || '';
    const pendingMonths = calcPendingMonths(student);

    const matchesFilter =
      filter === 'All'      ||
      filter === 'Active'   ||
      (filter === 'Hosteler' && type === 'Hosteler')  ||
      (filter === 'Local'    && type === 'Local')      ||
      (filter === 'Fees Due' && pendingMonths > 0) ||
      (filter === 'Paid'     && pendingMonths <= 0) ||
      (filter === 'Important' && student.impStudent === true);

    return matchesSearch && matchesFilter;
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addStudent({
        ...form,
        totalFees:       Number(form.totalFees)       || 0,
        feesPaid:        Number(form.feesPaid)        || 0,
        monthlyFees:     Number(form.monthlyFees)     || 0,
        totalMonthsPaid: Number(form.totalMonthsPaid) || 0,
        joinDate:        form.joiningDate || '',
      });
      setShowModal(false);
      setForm({
        fullName: '', fatherName: '', contactNumber: '', dateOfBirth: '',
        address: '', hostelType: 'Local', joiningDate: '', leavingDate: '',
        assignedCoachId: '', batchId: '',
        totalFees: '', feesPaid: '',
        monthlyFees: '', totalMonthsPaid: '0',
        dressGiven: false, kitGiven: false, impStudent: false, status: 'active',
        gender: 'boy'
      });
    } catch (err) {
      console.error('Error adding student:', err);
      alert('Failed to add student. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportData(formatStudentsForExport(students), 'students_export', 'xlsx');
  };

  return (
    <div className="pb-32 lg:pb-6 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
      <header className="mb-4 md:mb-6">
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-white">Student Directory</h1>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
          >
            <Download size={14} /> Export
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4 md:mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text" 
            placeholder="Search Name, DOB or Mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap transition-all",
                filter === f 
                  ? "bg-amber-500 text-white shadow-md scale-105" 
                  : "bg-navy-800 text-gray-400 border border-white/5"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto pr-1 scroll-smooth grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max pt-2 pb-10">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-20">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {filteredStudents.map((student) => {
              const feesDue   = student.feesDue || 0;
              const feeStatus = student.feeStatus || (feesDue > 0 ? 'Due' : 'Paid');
              const type      = student.hostelType || student.type || 'Local';
              const name      = student.fullName   || student.name || 'Student';
              const mobile    = student.contactNumber || student.mobile || '';
              const coach     = student.assignedCoachId || student.coach || '—';
              const genderPath = student.gender === 'girl' ? 'girl' : 'boy';
              const avatar    = student.avatar || '';

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={student.studentId}
                  onClick={() => onSelectStudent({ ...student, name, type, feeStatus, avatar, mobile, coach })}
                  className="glass p-3 md:p-4 rounded-2xl md:rounded-3xl flex items-center gap-3 md:gap-4 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-navy-800 border border-white/10 overflow-hidden">
                      <Avatar src={avatar} name={name} />
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-navy-900 flex items-center justify-center",
                      feeStatus === 'Paid' ? 'bg-accent text-navy-900' : 'bg-amber-500 text-navy-900'
                    )}>
                      <CreditCard size={8} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm md:text-base truncate flex items-center gap-2">
                      {name}
                      {student.impStudent && <span className="text-amber-500 text-lg">★</span>}
                    </h3>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mb-1">{mobile || 'No Mobile'}</p>
                    <div className="flex items-center gap-2 md:gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-gray-400">
                        <UserCircle size={10} className="text-accent" />
                        <span className="truncate max-w-[60px] md:max-w-none">{coach}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-gray-400">
                        {type === 'Hosteler' ? <Home size={10} /> : <MapPin size={10} />}
                        <span>{type}</span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="text-gray-700 flex-shrink-0" size={18} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {!loading && filteredStudents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 col-span-full">
            <div className="w-20 h-20 rounded-full bg-navy-800 flex items-center justify-center mb-4 border border-white/5">
              <Search size={30} className="text-gray-600" />
            </div>
            <p className="text-gray-500">No students found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowModal(true)}
        className="fixed bottom-28 right-6 w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-xl z-40"
      >
        <Plus size={28} />
      </motion.button>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-navy-900/90 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-white font-bold text-lg">Add New Student</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStudent} className="p-6 pb-12 space-y-4">
                {/* Smart Fee fields highlighted */}
                <div className="bg-accent/5 border border-accent/15 rounded-2xl p-3 mb-1">
                  <p className="text-accent text-[9px] font-black uppercase tracking-widest mb-2.5">Smart Fee Fields</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Monthly Fees (₹) *</label>
                      <input
                        type="number"
                        name="monthlyFees"
                        value={form.monthlyFees}
                        onChange={handleChange}
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                        placeholder="e.g. 1000"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Months Already Paid</label>
                      <input
                        type="number"
                        name="totalMonthsPaid"
                        value={form.totalMonthsPaid}
                        onChange={handleChange}
                        min="0"
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {[
                  { label: 'Full Name *',         name: 'fullName',         type: 'text',   required: true  },
                  { label: "Father's Name",        name: 'fatherName',       type: 'text',   required: false },
                  { label: 'Contact Number',       name: 'contactNumber',    type: 'tel',    required: false },
                  { label: 'Date of Birth',        name: 'dateOfBirth',      type: 'date',   required: false },
                  { label: 'Address',              name: 'address',          type: 'text',   required: false },
                  { label: 'Joining Date *',       name: 'joiningDate',      type: 'date',   required: true },
                  { label: 'Leaving Date',         name: 'leavingDate',      type: 'date',   required: false },
                  { label: 'Coach ID / Name',      name: 'assignedCoachId',  type: 'text',   required: false },
                  { label: 'Batch ID',             name: 'batchId',          type: 'text',   required: false },
                ].map(({ label, name, type, required }) => (
                  <div key={name}>
                    <label className="text-gray-400 text-xs font-medium block mb-1">{label}</label>
                    <input
                      type={type}
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      required={required}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Gender</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Hostel Type</label>
                  <select
                    name="hostelType"
                    value={form.hostelType}
                    onChange={handleChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    <option value="Local">Local</option>
                    <option value="Hosteler">Hosteler</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dressGiven"
                      name="dressGiven"
                      checked={form.dressGiven}
                      onChange={handleChange}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <label htmlFor="dressGiven" className="text-gray-300 text-sm">Dress</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="kitGiven"
                      name="kitGiven"
                      checked={form.kitGiven}
                      onChange={handleChange}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <label htmlFor="kitGiven" className="text-gray-300 text-sm">Kit</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="impStudent"
                      name="impStudent"
                      checked={form.impStudent}
                      onChange={handleChange}
                      className="w-4 h-4 accent-amber-500 rounded border-amber-500"
                    />
                    <label htmlFor="impStudent" className="text-amber-500 font-bold text-sm">Important</label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Add Student'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserCircle = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" 
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export default Students;
