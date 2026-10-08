import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Badge } from './Badge.js';
import { ShieldCheck, LogOut } from 'lucide-react';

export const Navbar: React.FC<{ activeTab?: string; onTabChange?: (tab: string) => void }> = ({
  activeTab,
  onTabChange,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / College Portal Identity */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-xs flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">
                  Secure Digital Notice Board
                </span>
                <span className="hidden sm:inline-block bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wider border border-indigo-100">
                  SSE Lab Exam
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                College Information Gateway & Notice Governance System
              </p>
            </div>
          </div>

          {/* Navigation links for faculty/admin */}
          {user && onTabChange && (
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => onTabChange('board')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'board'
                    ? 'bg-slate-100 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Notice Board
              </button>

              {user.role === 'FACULTY' && (
                <button
                  onClick={() => onTabChange('manage')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'manage'
                      ? 'bg-slate-100 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Faculty Management
                </button>
              )}

              {user.role === 'ADMIN' && (
                <>
                  <button
                    onClick={() => onTabChange('admin-overview')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'admin-overview'
                        ? 'bg-slate-100 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    Admin Control
                  </button>
                  <button
                    onClick={() => onTabChange('audit-logs')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'audit-logs'
                        ? 'bg-slate-100 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    Security Audit Logs
                  </button>
                </>
              )}
            </nav>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-slate-800">{user.full_name}</span>
                  <Badge type="role" value={user.role} />
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {user.email} • Dept: {user.department}
                </span>
              </div>

              <div className="sm:hidden flex items-center">
                <Badge type="role" value={user.role} />
              </div>

              <button
                onClick={() => logout()}
                title="Sign out of notice board"
                className="flex items-center space-x-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
