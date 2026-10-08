import React, { useState, useEffect } from 'react';
import { Notice, SystemStats } from '../types.js';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { NoticeCard } from '../components/NoticeCard.js';
import { NoticeDetailModal } from '../components/NoticeDetailModal.js';
import { NoticeFormModal } from '../components/NoticeFormModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';
import {
  ShieldAlert,
  Layers,
  CheckCircle,
  Clock,
  FileEdit,
  Archive,
  Activity,
  Plus,
  AlertCircle,
} from 'lucide-react';

export const AdminDashboardView: React.FC<{ onNavigateToAuditLogs: () => void }> = ({
  onNavigateToAuditLogs,
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deletingNotice, setDeletingNotice] = useState<Notice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, noticesRes] = await Promise.all([
        apiRequest('/notices/stats'),
        apiRequest('/notices?limit=50'),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (noticesRes.success && noticesRes.data) {
        setNotices(noticesRes.data.notices);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateNotice = async (data: Partial<Notice>) => {
    await apiRequest('/notices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    fetchData();
  };

  const handleUpdateNotice = async (data: Partial<Notice>) => {
    if (!editingNotice) return;
    await apiRequest(`/notices/${editingNotice.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    fetchData();
  };

  const handleDeleteNotice = async () => {
    if (!deletingNotice) return;
    try {
      setIsDeleting(true);
      await apiRequest(`/notices/${deletingNotice.id}`, {
        method: 'DELETE',
      });
      setDeletingNotice(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete notice');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Admin Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Administrator Governance Console
            </h1>
            <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">
              Admin Privilege
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            System health metrics, global notice lifecycle enforcement, and access governance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateToAuditLogs}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            <Activity className="w-4 h-4 text-purple-600" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Notice</span>
          </button>
        </div>
      </div>

      {/* System Statistics Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Notices</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.totalNotices}</div>
            <div className="text-[11px] text-slate-400 mt-1">Across all lifecycles</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Published</span>
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-800">{stats.published}</div>
            <div className="text-[11px] text-emerald-600/70 mt-1">Visible to students</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sky-100 bg-sky-50/20 shadow-2xs">
            <div className="flex items-center justify-between text-sky-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Scheduled</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-sky-800">{stats.scheduled}</div>
            <div className="text-[11px] text-sky-600/70 mt-1">Pending publication</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/20 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Drafts</span>
              <FileEdit className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-800">{stats.draft}</div>
            <div className="text-[11px] text-amber-600/70 mt-1">Unpublished drafts</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Archived</span>
              <Archive className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-700">{stats.archived}</div>
            <div className="text-[11px] text-slate-400 mt-1">Expired or archived</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
            <div className="flex items-center justify-between text-purple-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Audit Events</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-purple-800">{stats.totalAuditEvents}</div>
            <div className="text-[11px] text-purple-600/70 mt-1">Security logs recorded</div>
          </div>
        </div>
      )}

      {/* Global Notice Management Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">All Notices (Global View)</h2>
          <span className="text-xs text-slate-500">
            Admins may modify or delete any notice regardless of author.
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-16 bg-slate-100 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                currentUser={user}
                onView={(n) => setSelectedNotice(n)}
                onEdit={(n) => setEditingNotice(n)}
                onDelete={(n) => setDeletingNotice(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      <NoticeDetailModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />

      {/* Create Modal */}
      <NoticeFormModal
        isOpen={isCreateOpen}
        title="Admin: Create System Notice"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateNotice}
      />

      {/* Edit Modal */}
      <NoticeFormModal
        isOpen={Boolean(editingNotice)}
        title="Admin: Modify Notice"
        initialData={editingNotice}
        onClose={() => setEditingNotice(null)}
        onSubmit={handleUpdateNotice}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingNotice)}
        title="Admin: Delete Notice"
        message={`As an Administrator, you are about to delete "${deletingNotice?.title}". This administrative action will be recorded in the security audit trail.`}
        isDeleting={isDeleting}
        onClose={() => setDeletingNotice(null)}
        onConfirm={handleDeleteNotice}
      />
    </div>
  );
};
