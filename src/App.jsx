import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import FeeAnalytics from './pages/FeeAnalytics';
import Profile from './pages/Profile';
import CoachAttendance from './pages/CoachAttendance';
import CoachSalary from './pages/CoachSalary';
import Coaches from './pages/Coaches';
import CoachHub from './pages/CoachHub';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import StudentDetail from './components/StudentDetail';
import { Loader2 } from 'lucide-react';

// ─── Inner App (has access to AuthContext) ────────────────────────────────────
const AppInner = () => {
  const { user, loading, logout } = useAuth();
  const [activeTab,       setActiveTab]       = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Force fullscreen behavior on interaction, reload, back button, and visibility changes
  useEffect(() => {
    const enableFullScreen = () => {
      const docEl = document.documentElement;
      const req = docEl.requestFullscreen || docEl.mozRequestFullScreen ||
                  docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
      if (req && !document.fullscreenElement) {
        req.call(docEl).catch(() => {});
      }
    };

    // Try immediately on load/tab switch
    enableFullScreen();

    // Re-enable fullscreen on user interactions (essential for browser security policies)
    const handleInteraction = () => {
      enableFullScreen();
    };

    document.addEventListener('click', handleInteraction, { passive: true });
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('keydown', handleInteraction, { passive: true });
    
    // Re-enable when navigating (back button)
    const handlePopState = () => {
      enableFullScreen();
    };
    window.addEventListener('popstate', handlePopState);

    // Re-enable when window becomes visible/active again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        enableFullScreen();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeTab, user]);

  const handleLogin = () => {
    const docEl = document.documentElement;
    const req = docEl.requestFullscreen || docEl.mozRequestFullScreen ||
                docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    if (req && !document.fullscreenElement) {
      req.call(docEl).catch(() => {});
    }
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
      setActiveTab('dashboard');
      setSelectedStudent(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Loading splash while Firebase checks session
  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-accent animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → show Login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':        return <Dashboard setActiveTab={setActiveTab} />;
      case 'students':         return <Students onSelectStudent={setSelectedStudent} />;
      case 'attendance':       return <Attendance />;
      case 'fees':             return <Fees />;
      case 'fee-analytics':    return <FeeAnalytics />;
      case 'coach':          return <CoachHub />;
      case 'coaches':         return <Coaches />;
      case 'coach-attendance': return <CoachAttendance />;
      case 'coach-salary':     return <CoachSalary />;
      case 'profile':          return <Profile onLogout={handleLogout} setActiveTab={setActiveTab} />;
      default:                 return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="bg-navy-900 min-h-screen text-white overflow-hidden relative">
      
      {/* Dynamic Background Glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[40%] bg-accent/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-500/5 blur-[120px] pointer-events-none" />
      
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

        {/* Main Content Area */}
        <main className="flex-1 h-screen overflow-y-auto relative">
          <div className="max-w-7xl mx-auto w-full h-full">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab} 
                className="h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Navigation (Mobile Only) */}
      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Student Detail Overlay */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDetail 
            student={selectedStudent} 
            onClose={() => setSelectedStudent(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Root App (provides AuthContext) ─────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
