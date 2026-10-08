import React, { useState, useEffect } from 'react';
import { Notice } from '../types.js';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { NoticeCard } from '../components/NoticeCard.js';
import { NoticeDetailModal } from '../components/NoticeDetailModal.js';
import { NoticeFormModal } from '../components/NoticeFormModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';
import { Plus, FolderPlus, AlertCircle, FileText, CheckCircle2, Clock, Archive } from 'lucide-react';

export const FacultyDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');

  // Modals state
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deletingNotice, setDeletingNotice] = useState<Notice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFacultyNotices = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('scope', 'my');
      if (activeStatusTab !== 'ALL') {
        params.append('status', activeStatusTab);
      }

      const res = await apiRequest(`/notices?${params.toString()}`);
      if (res.success && res.data) {
        setNotices(res.data.notices);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch authored notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyNotices();
  }, [activeStatusTab]);

  const handleCreateNotice = async (data: Partial<Notice>) => {
    await apiRequest('/notices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    fetchFacultyNotices();
  };

  const handleUpdateNotice = async (data: Partial<Notice>) => {
    if (!editingNotice) return;
    await apiRequest(`/notices/${editingNotice.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    fetchFacultyNotices();
  };

  const handleDeleteNotice = async () => {
    if (!deletingNotice) return;
    try {
      setIsDeleting(true);
      await apiRequest(`/notices/${deletingNotice.id}`, {
        method: 'DELETE',
      });
      setDeletingNotice(null);
      fetchFacultyNotices();
    } catch (err: any) {
      setError(err.message || 'Failed to delete notice');
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: 'ALL', label: 'All My Notices', icon: FileText },
    { id: 'PUBLISHED', label: 'Published', icon: CheckCircle2 },
    { id: 'SCHEDULED', label: 'Scheduled', icon: Clock },
    { id: 'DRAFT', label: 'Drafts', icon: FolderPlus },
    { id: 'ARCHIVED', label: 'Archived', icon: Archive },
  ];

  return (
    <div className="space-y-6">
      {/* Faculty Management Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Faculty Notice Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Author, publish, schedule, and maintain departmental notices for {user?.department} Department.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Notice</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto pb-1 text-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeStatusTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Notices List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded-md w-3/4"></div>
              <div className="h-16 bg-slate-100 rounded-md"></div>
            </div>
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700">No notices in this category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You currently have no notices matching the selected status filter.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Create Your First Notice
          </button>
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

      {/* View Detail Modal */}
      <NoticeDetailModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />

      {/* Create Modal */}
      <NoticeFormModal
        isOpen={isCreateOpen}
        title="Create New Campus Notice"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateNotice}
      />

      {/* Edit Modal */}
      <NoticeFormModal
        isOpen={Boolean(editingNotice)}
        title="Edit Authorized Notice"
        initialData={editingNotice}
        onClose={() => setEditingNotice(null)}
        onSubmit={handleUpdateNotice}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingNotice)}
        title="Delete Notice"
        message={`Are you sure you want to permanently delete "${deletingNotice?.title}"? This action is logged to the security audit trail and cannot be undone.`}
        isDeleting={isDeleting}
        onClose={() => setDeletingNotice(null)}
        onConfirm={handleDeleteNotice}
      />
    </div>
  );
};
