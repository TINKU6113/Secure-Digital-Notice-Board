import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, Lock, Mail, AlertCircle, KeyRound, Info } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-md">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Secure College Notice Board
          </h1>
          <p className="text-xs text-slate-500">
            Secure Software Engineering Laboratory Portal • Access Control Gateway
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider">Authentication Error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              College Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In Securely'}</span>
          </button>
        </form>

        {/* Quick Demo Accounts for SSE Lab Examination */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5" />
            <span>Exam Evaluation Demo Accounts</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemoAccount('student@college.edu', 'Student@123')}
              className="p-2 text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg transition-colors cursor-pointer"
            >
              <div className="font-semibold text-slate-800">Student Account</div>
              <div className="text-[11px] text-slate-500 truncate">student@college.edu</div>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount('faculty.cse@college.edu', 'Faculty@123')}
              className="p-2 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-colors cursor-pointer"
            >
              <div className="font-semibold text-slate-800">Faculty (CSE)</div>
              <div className="text-[11px] text-slate-500 truncate">faculty.cse@college.edu</div>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount('faculty.cys@college.edu', 'Faculty@123')}
              className="p-2 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-colors cursor-pointer"
            >
              <div className="font-semibold text-slate-800">Faculty (CYS)</div>
              <div className="text-[11px] text-slate-500 truncate">faculty.cys@college.edu</div>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount('admin@college.edu', 'Admin@123')}
              className="p-2 text-left bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg transition-colors cursor-pointer"
            >
              <div className="font-semibold text-slate-800">Administrator</div>
              <div className="text-[11px] text-slate-500 truncate">admin@college.edu</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
