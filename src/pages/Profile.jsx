import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Settings, Shield, Bell, LogOut, ChevronRight, Award, MapPin, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';
import { getAllStudents } from '../services/studentService';
import * as XLSX from 'xlsx';
import { BarChart2 } from 'lucide-react';

const Profile = ({ onLogout, setActiveTab }) => {
  const { user, role, logout } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleDownloadDatabase = async () => {
    try {
      setDownloading(true);
      const students = await getAllStudents();
      const formattedData = students.map(s => {
         const { createdAt, ...rest } = s; 
         return {
           ...rest,
           createdAt: createdAt?.toDate ? createdAt.toDate().toLocaleString() : ''
         };
      });
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students Data");
      XLSX.writeFile(workbook, "Academy_Database.xlsx");
    } catch (error) {
      console.error("Error downloading database:", error);
      alert("Failed to download database");
    } finally {
      setDownloading(false);
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayRole = role === 'admin' ? 'Admin' : 'Coach';
  const avatarSeed  = user?.name || user?.uid || 'default';

  return (
    <div className="pb-32 lg:pb-10 pt-8 px-6 h-full flex flex-col">
      <header className="flex flex-col items-center mb-10">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-[2rem] bg-accent p-1 shadow-[0_0_25px_rgba(234,179,8,0.2)]">
            <div className="w-full h-full rounded-[1.8rem] bg-navy-900 overflow-hidden flex items-center justify-center">
              <Avatar src="" name={displayName} />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-accent text-navy-900 w-8 h-8 rounded-xl flex items-center justify-center border-4 border-navy-900">
            <Award size={14} fill="currentColor" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">{displayName}</h2>
        <p className="text-gray-500 text-sm flex items-center gap-1">
          <MapPin size={12} className="text-accent" />
          {displayRole} • {user?.email || 'Bally Academy'}
        </p>
        {role && (
          <span className={cn(
            "mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
            role === 'admin'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-blue-500/10  text-blue-400  border-blue-500/20'
          )}>
            {displayRole}
          </span>
        )}
      </header>

      <div className="grid lg:grid-cols-2 gap-8">
        <section>
          <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3 ml-1">Account Settings</h3>
          <div className="glass rounded-3xl overflow-hidden">
            {[
              { icon: User,     label: 'Personal Information', color: 'text-blue-400'   },
              { icon: Shield,   label: 'Security & Privacy',   color: 'text-accent'     },
              { icon: Bell,     label: 'Notifications',        color: 'text-amber-400'  },
              { icon: Settings, label: 'Academy Preferences',  color: 'text-purple-400' },
            ].map((item, i) => (
              <button 
                key={i} 
                className="w-full flex items-center gap-4 p-4 hover:bg-white/5 border-b border-white/5 last:border-none transition-colors"
              >
                <div className={cn("w-10 h-10 rounded-xl bg-navy-800 flex items-center justify-center", item.color)}>
                  <item.icon size={20} />
                </div>
                <span className="flex-1 text-white text-sm font-medium text-left">{item.label}</span>
                <ChevronRight size={18} className="text-gray-600" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3 ml-1">Danger Zone</h3>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 bg-red-600 rounded-2xl text-white hover:bg-red-700 transition-colors shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <LogOut size={20} />
            </div>
            <span className="flex-1 text-sm font-bold text-left uppercase tracking-widest">Logout from System</span>
            <ChevronRight size={18} className="text-white/50" />
          </button>
          
          <div className="mt-6 glass rounded-2xl p-6 border-dashed border-white/10">
            <h4 className="text-white text-xs font-bold mb-2 uppercase tracking-tight">System Status</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Firebase Auth</span>
                <span className="text-green-500 font-bold">CONNECTED</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Firestore Sync</span>
                <span className="text-blue-500 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Logged In As</span>
                <span className="text-accent font-bold uppercase">{displayRole}</span>
              </div>
            </div>
          </div>
        </section>

        {role === 'admin' && (
          <section className="lg:col-span-2">
            <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3 ml-1">Admin Panel</h3>
            <div className="glass rounded-3xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="text-white text-sm font-bold">Database Backup</h4>
                <p className="text-gray-400 text-xs mt-1">Download all student records and data in Excel format.</p>
              </div>
              <button 
                onClick={handleDownloadDatabase}
                disabled={downloading}
                className="bg-accent text-navy-900 font-bold px-5 py-3 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 w-full md:w-auto justify-center shadow-lg"
              >
                <Download size={18} />
                {downloading ? 'Downloading...' : 'Download Excel'}
              </button>
            </div>
            
            <div className="glass rounded-3xl p-4 md:p-6 mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="text-white text-sm font-bold">Fee Analytics</h4>
                <p className="text-gray-400 text-xs mt-1">View revenue projections, collections, and overdue metrics.</p>
              </div>
              <button 
                onClick={() => setActiveTab('fee-analytics')}
                className="bg-navy-800 text-accent font-bold px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-navy-700 transition-colors border border-white/5 w-full md:w-auto justify-center shadow-lg"
              >
                <BarChart2 size={18} />
                View Analytics
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="mt-10 text-center">
        <p className="text-gray-600 text-[10px] uppercase tracking-tighter">Bally Academy ERP v2.0 • Firebase</p>
      </div>
    </div>
  );
};

export default Profile;
