import React from 'react';
import { LayoutDashboard, Users, CheckSquare, IndianRupee, User, Clock, Award, BarChart2, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAuth();

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'students',  icon: Users,           label: 'Students' },
  ];

  if (isAdmin()) {
    tabs.push({ id: 'coach',          icon: Award,       label: 'Coach Hub'     });
    tabs.push({ id: 'fees',           icon: IndianRupee, label: 'Fees'          });
    tabs.push({ id: 'attendance',    icon: CheckSquare, label: 'Attendance'  });
  } else {
    tabs.push({ id: 'attendance',       icon: CheckSquare, label: 'Mark'    });
    tabs.push({ id: 'coach',            icon: Award,       label: 'My Hub'  });
    tabs.push({ id: 'fees',             icon: IndianRupee, label: 'Fees'    });
  }

  tabs.push({ id: 'profile', icon: User, label: 'Profile' });

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50">
      {/* Scrollable tab row — handles any number of tabs on mobile */}
      <div
        className="flex items-center overflow-x-auto gap-1 px-3 pt-2 pb-safe"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        {tabs.map((tab) => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-shrink-0 relative transition-all duration-200',
                'min-w-[56px] py-1.5 px-1 rounded-xl',
                isActive
                  ? 'text-navy-900 bg-accent shadow-md shadow-accent/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span
                className={cn(
                  'text-[9px] mt-0.5 font-semibold leading-tight whitespace-nowrap',
                  isActive ? 'text-navy-900' : 'text-gray-500'
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
