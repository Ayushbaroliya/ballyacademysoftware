import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Edit2, MapPin, Phone, Mail, Calendar, Settings, X, Loader2, Award, Briefcase } from 'lucide-react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { doc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../firebase/firebase';
import { useAuth } from '../context/AuthContext';
import { getAllCoaches, addCoach, updateCoach, deleteCoach, subscribeToCoaches } from '../services/coachService';
import { getCoachSalarySettings, setCoachSalarySettings } from '../services/coachSalaryService';
import { upsertUserProfile } from '../services/authService';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';
import CoachDetail from '../components/CoachDetail';

const Coaches = () => {
  const { user: currentUser, isAdmin } = useAuth();
  
  // Data State
  const [coaches, setCoaches] = useState([]);
  const [salarySettings, setSalarySettings] = useState({}); // coachId -> settings
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selCoach, setSelCoach] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState(null);
  
  // Action Loading states
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Forms
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: 'General Coach',
    status: 'active',
    joiningDate: new Date().toISOString().split('T')[0],
    assignedBatchIds: '',
    salaryType: 'monthly',
    rate: '15000',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    specialization: 'General Coach',
    status: 'active',
    joiningDate: '',
    assignedBatchIds: '',
    salaryType: 'monthly',
    rate: '',
  });

  // Fetch all coaches and salary settings
  const loadCoachesData = async () => {
    try {
      const unsub = subscribeToCoaches(async (list) => {
        setCoaches(list);
        
        // Fetch settings for all coaches
        const settingsMap = {};
        await Promise.all(
          list.map(async (c) => {
            const s = await getCoachSalarySettings(c.coachId);
            settingsMap[c.coachId] = s;
          })
        );
        setSalarySettings(settingsMap);
        setLoading(false);
      });
      return unsub;
    } catch (err) {
      console.error('Error loading coaches:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsub;
    loadCoachesData().then(fn => { unsub = fn; });
    return () => unsub && unsub();
  }, []);

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setAddForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // Add Coach Handler
  const handleAddCoachSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let tempApp;
    try {
      let uid = '';
      const isMocks = import.meta.env.VITE_USE_MOCKS === 'true' || !firebaseConfig.apiKey;

      if (isMocks) {
        uid = 'mock-coach-' + Math.random().toString(36).substring(2, 9);
      } else {
        // Initialize temporary firebase app for auth creation to avoid admin logout
        const appName = `TempApp_${Date.now()}`;
        tempApp = initializeApp(firebaseConfig, appName);
        const tempAuth = getAuth(tempApp);
        
        const userCred = await createUserWithEmailAndPassword(tempAuth, addForm.email, addForm.password);
        uid = userCred.user.uid;
        await secondarySignOut(tempAuth);
      }

      // 1. Create main user profile
      await upsertUserProfile({
        uid,
        name: addForm.name,
        role: 'coach',
        phone: addForm.phone,
        email: addForm.email,
      });

      // 2. Create coach record
      await addCoach(uid, {
        name: addForm.name,
        email: addForm.email,
        phone: addForm.phone,
        specialization: addForm.specialization,
        status: addForm.status,
        joiningDate: addForm.joiningDate,
        assignedBatchIds: addForm.assignedBatchIds ? addForm.assignedBatchIds.split(',').map(s => s.trim()) : [],
      });

      // 3. Set salary settings
      await setCoachSalarySettings(uid, {
        salaryType: addForm.salaryType,
        rate: Number(addForm.rate) || 0,
      });

      // Reset & close
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        specialization: 'General Coach',
        status: 'active',
        joiningDate: new Date().toISOString().split('T')[0],
        assignedBatchIds: '',
        salaryType: 'monthly',
        rate: '15000',
      });
    } catch (err) {
      console.error('Error adding coach:', err);
      alert('Failed to register coach: ' + err.message);
    } finally {
      if (tempApp) {
        await deleteApp(tempApp);
      }
      setSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (coach) => {
    setSelCoach(coach);
    const s = salarySettings[coach.coachId] || { salaryType: 'monthly', rate: 15000 };
    setEditForm({
      name: coach.name || '',
      phone: coach.phone || '',
      specialization: coach.specialization || 'General Coach',
      status: coach.status || 'active',
      joiningDate: coach.joiningDate || '',
      assignedBatchIds: coach.assignedBatchIds ? coach.assignedBatchIds.join(', ') : '',
      salaryType: s.salaryType,
      rate: s.rate.toString(),
    });
    setShowEditModal(true);
  };

  // Edit Coach Handler
  const handleEditCoachSubmit = async (e) => {
    e.preventDefault();
    if (!selCoach) return;
    setSaving(true);
    try {
      const coachId = selCoach.coachId;

      // 1. Update user profile details
      await upsertUserProfile({
        uid: coachId,
        name: editForm.name,
        role: 'coach',
        phone: editForm.phone,
        email: selCoach.email,
      });

      // 2. Update coach record
      await updateCoach(coachId, {
        name: editForm.name,
        phone: editForm.phone,
        specialization: editForm.specialization,
        status: editForm.status,
        joiningDate: editForm.joiningDate,
        assignedBatchIds: editForm.assignedBatchIds ? editForm.assignedBatchIds.split(',').map(s => s.trim()) : [],
      });

      // 3. Update salary settings
      await setCoachSalarySettings(coachId, {
        salaryType: editForm.salaryType,
        rate: Number(editForm.rate) || 0,
      });

      if (selectedCoach && selectedCoach.coachId === coachId) {
        setSelectedCoach({
          ...selectedCoach,
          name: editForm.name,
          phone: editForm.phone,
          specialization: editForm.specialization,
          status: editForm.status,
          joiningDate: editForm.joiningDate,
          assignedBatchIds: editForm.assignedBatchIds ? editForm.assignedBatchIds.split(',').map(s => s.trim()) : [],
        });
      }
      setShowEditModal(false);
      setSelCoach(null);
    } catch (err) {
      console.error('Error updating coach:', err);
      alert('Failed to update coach: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Coach Handler
  const handleDeleteCoach = async (coach) => {
    if (!window.confirm(`Are you absolutely sure you want to delete coach ${coach.name}? This will permanently remove their Auth account, profile, logs, and salary details.`)) {
      return;
    }
    setDeletingId(coach.coachId);
    try {
      const isMocks = import.meta.env.VITE_USE_MOCKS === 'true' || !firebaseConfig.apiKey;
      
      if (isMocks) {
        // Local deletes in Mock Mode
        await deleteDoc(doc(db, 'users', coach.coachId));
        await deleteCoach(coach.coachId);
        await deleteDoc(doc(db, 'coach_salary_settings', coach.coachId));
      } else {
        // Real cloud serverless API call
        try {
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: coach.coachId }),
          });

          const contentType = response.headers.get("content-type");
          if (!response.ok || (contentType && contentType.includes("text/html"))) {
            throw new Error("Serverless API is not available on this environment. Performing direct database deletion.");
          }

          const data = await response.json();
          if (data && data.error) {
            throw new Error(data.error);
          }
        } catch (apiErr) {
          console.warn("API Deletion failed, falling back to direct Firestore deletion:", apiErr);
          // Delete from Firestore directly using current user's admin privilege
          await deleteDoc(doc(db, 'users', coach.coachId));
          await deleteCoach(coach.coachId);
          await deleteDoc(doc(db, 'coach_salary_settings', coach.coachId));
        }
      }
      if (selectedCoach && selectedCoach.coachId === coach.coachId) {
        setSelectedCoach(null);
      }
    } catch (err) {
      console.error('Error deleting coach:', err);
      alert('Failed to delete coach: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20 text-red-500">
          <Award size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Only administrators have access to view and manage coaches.
        </p>
      </div>
    );
  }

  const filteredCoaches = coaches.filter((c) => {
    const term = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.specialization || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="pb-32 lg:pb-10 pt-6 px-4 md:px-6 h-full flex flex-col overflow-hidden">
      <header className="mb-6 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Coaches Directory</h1>
          <p className="text-gray-400 text-xs mt-1">Manage staff credentials, specialties, and monthly salary models</p>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-6 flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input 
          type="text" 
          placeholder="Search coach name, email, specialization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600"
        />
      </div>

      {/* Grid of Coaches */}
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max pt-2 pb-10">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-20">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {filteredCoaches.map((coach) => {
              const settings = salarySettings[coach.coachId] || { salaryType: 'monthly', rate: 15000 };
              const rateStr = settings.salaryType === 'monthly'
                ? `₹${settings.rate.toLocaleString()}/mo`
                : settings.salaryType === 'per_session'
                ? `₹${settings.rate.toLocaleString()}/session`
                : `₹${settings.rate.toLocaleString()}/hr`;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={coach.coachId}
                  onClick={() => setSelectedCoach(coach)}
                  className="glass p-4 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[220px] cursor-pointer hover:border-white/10 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-navy-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <Avatar src="" name={coach.name} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-white font-bold text-sm truncate max-w-[130px]">{coach.name}</h3>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                            coach.status === 'active' ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-500"
                          )}>
                            {coach.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-accent/80 font-medium flex items-center gap-1 mt-0.5">
                          <Briefcase size={10} /> {coach.specialization}
                        </p>
                      </div>
                    </div>

                    {/* Quick Profile Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(coach); }}
                        className="p-2 rounded-lg bg-navy-800 border border-white/5 text-gray-400 hover:text-white transition-colors"
                        title="Edit Coach Details"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCoach(coach); }}
                        disabled={deletingId === coach.coachId}
                        className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-55"
                        title="Delete Coach"
                      >
                        {deletingId === coach.coachId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="space-y-1.5 py-2 border-t border-b border-white/5 my-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Mail size={12} className="text-gray-500" />
                      <span className="truncate">{coach.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Phone size={12} className="text-gray-500" />
                      <span>{coach.phone || 'No Phone'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Calendar size={12} className="text-gray-500" />
                      <span>Joined: {coach.joiningDate || '—'}</span>
                    </div>
                  </div>

                  {/* Salary Track Card */}
                  <div className="bg-navy-800/40 rounded-xl p-2 px-3 flex justify-between items-center border border-white/5 mt-1">
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Salary Model</p>
                      <p className="text-[10px] text-white font-black capitalize mt-0.5">{settings.salaryType.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Wage Rate</p>
                      <p className="text-xs text-green-400 font-bold mt-0.5">{rateStr}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {!loading && filteredCoaches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 col-span-full">
            <div className="w-20 h-20 rounded-full bg-navy-800 flex items-center justify-center mb-4 border border-white/5">
              <Search size={30} className="text-gray-600" />
            </div>
            <p className="text-gray-500">No coaches found matching search criteria.</p>
          </div>
        )}
      </div>

      {/* FAB to Add Coach */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-xl z-40"
      >
        <Plus size={28} />
      </motion.button>

      {/* ─── ADD COACH MODAL ─── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-navy-900 border border-white/5 rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-navy-900/90 backdrop-blur-xl px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-white font-bold text-lg">Add New Coach</h2>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddCoachSubmit} className="p-6 pb-12 space-y-4">
                {[
                  { label: 'Full Name *', name: 'name', type: 'text', required: true },
                  { label: 'Email *', name: 'email', type: 'email', required: true },
                  { label: 'Password (For Login) *', name: 'password', type: 'password', required: true },
                  { label: 'Contact Number', name: 'phone', type: 'tel', required: false },
                  { label: 'Joining Date', name: 'joiningDate', type: 'date', required: false },
                  { label: 'Assigned Batch IDs (comma separated)', name: 'assignedBatchIds', type: 'text', required: false },
                ].map(({ label, name, type, required }) => (
                  <div key={name}>
                    <label className="text-gray-400 text-xs font-medium block mb-1">{label}</label>
                    <input
                      type={type}
                      name={name}
                      value={addForm[name]}
                      onChange={handleAddChange}
                      required={required}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Specialization</label>
                  <select
                    name="specialization"
                    value={addForm.specialization}
                    onChange={handleAddChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    <option value="Head Coach">Head Coach</option>
                    <option value="Batting Coach">Batting Coach</option>
                    <option value="Bowling Coach">Bowling Coach</option>
                    <option value="Fielding Coach">Fielding Coach</option>
                    <option value="General Coach">General Coach</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Account Status</label>
                  <select
                    name="status"
                    value={addForm.status}
                    onChange={handleAddChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Salary Section */}
                <div className="border-t border-white/5 pt-4 my-2">
                  <h4 className="text-accent text-xs font-black uppercase mb-3">Salary Configurations</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Salary Model</label>
                      <select
                        name="salaryType"
                        value={addForm.salaryType}
                        onChange={handleAddChange}
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                      >
                        <option value="monthly">Monthly Flat</option>
                        <option value="per_session">Per Session</option>
                        <option value="per_hour">Per Hour</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Rate (₹) *</label>
                      <input
                        type="number"
                        name="rate"
                        required
                        min="0"
                        value={addForm.rate}
                        onChange={handleAddChange}
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                        placeholder="Rate amount"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                >
                  {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Register Coach'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── COACH DETAIL OVERLAY ─── */}
      <AnimatePresence>
        {selectedCoach && (
          <CoachDetail 
            coach={selectedCoach} 
            onClose={() => setSelectedCoach(null)} 
            onEdit={openEditModal}
            onDelete={handleDeleteCoach}
          />
        )}
      </AnimatePresence>

      {/* ─── EDIT COACH MODAL ─── */}
      <AnimatePresence>
        {showEditModal && selCoach && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
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
                  <h2 className="text-white font-bold text-lg">Edit Coach Profile</h2>
                  <p className="text-gray-500 text-xs">{selCoach.email}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditCoachSubmit} className="p-6 pb-12 space-y-4">
                {[
                  { label: 'Full Name *', name: 'name', type: 'text', required: true },
                  { label: 'Contact Number', name: 'phone', type: 'tel', required: false },
                  { label: 'Joining Date', name: 'joiningDate', type: 'date', required: false },
                  { label: 'Assigned Batch IDs (comma separated)', name: 'assignedBatchIds', type: 'text', required: false },
                ].map(({ label, name, type, required }) => (
                  <div key={name}>
                    <label className="text-gray-400 text-xs font-medium block mb-1">{label}</label>
                    <input
                      type={type}
                      name={name}
                      value={editForm[name]}
                      onChange={handleEditChange}
                      required={required}
                      className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Specialization</label>
                  <select
                    name="specialization"
                    value={editForm.specialization}
                    onChange={handleEditChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    <option value="Head Coach">Head Coach</option>
                    <option value="Batting Coach">Batting Coach</option>
                    <option value="Bowling Coach">Bowling Coach</option>
                    <option value="Fielding Coach">Fielding Coach</option>
                    <option value="General Coach">General Coach</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Account Status</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="w-full bg-navy-800 border border-white/5 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Salary Section */}
                <div className="border-t border-white/5 pt-4 my-2">
                  <h4 className="text-accent text-xs font-black uppercase mb-3">Salary Configurations</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Salary Model</label>
                      <select
                        name="salaryType"
                        value={editForm.salaryType}
                        onChange={handleEditChange}
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                      >
                        <option value="monthly">Monthly Flat</option>
                        <option value="per_session">Per Session</option>
                        <option value="per_hour">Per Hour</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs font-medium block mb-1">Rate (₹) *</label>
                      <input
                        type="number"
                        name="rate"
                        required
                        min="0"
                        value={editForm.rate}
                        onChange={handleEditChange}
                        className="w-full bg-navy-800 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                        placeholder="Rate amount"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                >
                  {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Coaches;
