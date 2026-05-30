import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Mail, Lock, ChevronRight, AlertCircle, Loader2, ShieldCheck, Dumbbell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';



const Login = ({ onLogin }) => {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password.'
        : err.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : err.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please try again later.'
        : 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-6 bg-gradient-premium">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-accent rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)] mb-4">
            <Trophy size={40} className="text-navy-900" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Jabali Cricket</h1>
          <p className="text-gray-400 mt-1">Academy Management System</p>
        </div>

        <div className="glass p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-6 text-center">Welcome Back</h2>
          
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3.5 md:py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-navy-800 border border-white/5 rounded-2xl py-3.5 md:py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg mt-2 text-sm md:text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing In...</>
              ) : (
                <>Sign In <ChevronRight size={18} /></>
              )}
            </button>
          </form>


        </div>

        <p className="mt-10 text-center text-gray-500 text-sm">
          Forgot password? <span className="text-accent font-medium cursor-pointer">Reset here</span>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
