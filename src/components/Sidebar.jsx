import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, CheckSquare, IndianRupee, User, LogOut, Trophy, Clock, Wallet, Award, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {
  const { isAdmin } = useAuth();
  
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'students', icon: Users, label: 'Students' },
    { id: 'attendance', icon: CheckSquare, label: 'Attendance' },
  ];

  if (isAdmin()) {
    tabs.push({ id: 'coach',          icon: Award,       label: 'Coach Hub'     });
    tabs.push({ id: 'fees',           icon: IndianRupee, label: 'Fees'          });
  } else {
    tabs.push({ id: 'coach',          icon: Award,       label: 'My Hub'        });
    tabs.push({ id: 'fees',           icon: IndianRupee, label: 'Fees'          });
  }

  tabs.push({ id: 'profile', icon: User, label: 'My Profile' });

  return (
    <aside className="hidden lg:flex flex-col w-72 h-screen glass border-r border-white/5 sticky top-0 left-0 z-50">
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-12 h-12 rounded-[1.25rem] bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Trophy size={26} className="text-navy-900" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none">JABALI CRICKET</h1>
            <p className="text-[10px] text-accent font-bold tracking-[0.2em] mt-1">ACADEMY</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "text-navy-900 font-bold" 
                    : "text-gray-400 hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-accent"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={20} className={cn("relative z-10 transition-transform group-hover:scale-110", isActive ? "text-navy-900" : "")} />
                <span className="relative z-10 text-sm tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-10">
          <div className="glass rounded-2xl p-4 mb-6">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Cloud Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-white font-medium">System Online</span>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 border border-red-500/10 group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-xs uppercase tracking-[0.15em]">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
