import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { LoginView } from './views/LoginView.js';
import { StudentBoardView } from './views/StudentBoardView.js';
import { FacultyDashboardView } from './views/FacultyDashboardView.js';
import { AdminDashboardView } from './views/AdminDashboardView.js';
import { AuditLogView } from './views/AuditLogView.js';
import { ShieldCheck, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('board');

  // Set default tab according to role on login
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        setActiveTab('admin-overview');
      } else if (user.role === 'FACULTY') {
        setActiveTab('manage');
      } else {
        setActiveTab('board');
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium">Verifying security session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          <LoginView />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          Secure Digital Notice Board • Secure Software Engineering Laboratory Evaluation
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Render views based on active tab and role permissions */}
        {activeTab === 'board' && <StudentBoardView />}
        {activeTab === 'manage' && user.role === 'FACULTY' && <FacultyDashboardView />}
        {activeTab === 'admin-overview' && user.role === 'ADMIN' && (
          <AdminDashboardView onNavigateToAuditLogs={() => setActiveTab('audit-logs')} />
        )}
        {activeTab === 'audit-logs' && user.role === 'ADMIN' && <AuditLogView />}
      </main>

      <footer className="py-5 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secure Software Engineering Capstone Project</span>
          </div>
          <div className="text-slate-400">
            RBAC • STRIDE Defenses • XSS-Sanitized • Parameterized PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
};
