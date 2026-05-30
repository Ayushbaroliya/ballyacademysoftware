import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import Coaches from './Coaches';
import CoachAttendance from './CoachAttendance';
import CoachSalary from './CoachSalary';
import { useAuth } from '../context/AuthContext';

const CoachHub = () => {
  const { isAdmin } = useAuth();
  
  const TABS = isAdmin() 
    ? [
        { id: 'coaches',    label: 'Coaches',    icon: Users,  desc: 'Manage staff & profiles' },
        { id: 'attendance', label: 'Attendance', icon: Clock,  desc: 'Log & review sessions'   },
        { id: 'salary',     label: 'Salary',     icon: Wallet, desc: 'Payments & payroll'       },
      ]
    : [
        { id: 'attendance', label: 'My Log',     icon: Clock,  desc: 'Log & review sessions'   },
        { id: 'salary',     label: 'My Pay',     icon: Wallet, desc: 'Payments & payroll'       },
      ];

  const [activeTab, setActiveTab] = useState(isAdmin() ? 'coaches' : 'attendance');

  const renderContent = () => {
    switch (activeTab) {
      case 'coaches':    return <Coaches />;
      case 'attendance': return <CoachAttendance />;
      case 'salary':     return <CoachSalary />;
      default:           return <Coaches />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab strip — sticky at top */}
      <div className="flex-shrink-0 px-4 md:px-6 pt-5 pb-2">
        <div className="flex items-center gap-1.5 bg-navy-800/50 p-1 rounded-2xl border border-white/5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200',
                  isActive
                    ? 'bg-accent text-navy-900 shadow-md shadow-accent/30'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
};

export default CoachHub;
