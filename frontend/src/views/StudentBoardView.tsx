import React, { useState, useEffect } from 'react';
import { Notice } from '../types.js';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { NoticeCard } from '../components/NoticeCard.js';
import { NoticeDetailModal } from '../components/NoticeDetailModal.js';
import { Search, Filter, RotateCcw, AlertCircle, Inbox, Bell } from 'lucide-react';

export const StudentBoardView: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<string>('');

  // Selected notice for view modal
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (department) params.append('department', department);
      if (category) params.append('category', category);
      if (priority) params.append('priority', priority);

      const res = await apiRequest(`/notices?${params.toString()}`);
      if (res.success && res.data) {
        setNotices(res.data.notices);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [department, category, priority]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNotices();
  };

  const handleClearFilters = () => {
    setSearch('');
    setDepartment('');
    setCategory('');
    setPriority('');
  };

  const hasActiveFilters = Boolean(search || department || category || priority);

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Campus Digital Notice Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official announcements, examination schedules, placement updates, and college advisories.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 self-start md:self-auto">
          <Bell className="w-4 h-4 text-indigo-600" />
          <span>Active Published Notices: <strong>{notices.length}</strong></span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notices by title, keywords or content..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter By:</span>
          </div>

          {/* Department Filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="CYS">CYS</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="ME">ME</option>
            <option value="General">General</option>
          </select>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            <option value="Academic">Academic</option>
            <option value="Examination">Examination</option>
            <option value="Placement">Placement</option>
            <option value="Event">Event</option>
            <option value="Workshop">Workshop</option>
            <option value="Holiday">Holiday</option>
            <option value="Emergency">Emergency</option>
            <option value="General">General</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="Normal">Normal</option>
            <option value="Important">Important</option>
            <option value="Urgent">Urgent</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center space-x-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-pulse">
              <div className="flex gap-2">
                <div className="w-16 h-5 bg-slate-200 rounded-full"></div>
                <div className="w-20 h-5 bg-slate-200 rounded-full"></div>
              </div>
              <div className="w-3/4 h-6 bg-slate-200 rounded-md"></div>
              <div className="space-y-2">
                <div className="w-full h-4 bg-slate-100 rounded-sm"></div>
                <div className="w-5/6 h-4 bg-slate-100 rounded-sm"></div>
              </div>
            </div>
          ))}
        </div>
      ) : notices.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700">No notices found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No notices match the applied search query or filters. Try resetting your filters.'
              : 'There are currently no active announcements published on the board.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Notice Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {notices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              currentUser={user}
              onView={(n) => setSelectedNotice(n)}
            />
          ))}
        </div>
      )}

      {/* Notice Detail Modal */}
      <NoticeDetailModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />
    </div>
  );
};
