import React from 'react';
import { Notice, User } from '../types.js';
import { Badge } from './Badge.js';
import { Calendar, User as UserIcon, Clock, Edit2, Trash2, Eye } from 'lucide-react';

interface NoticeCardProps {
  notice: Notice;
  currentUser: User | null;
  onView: (notice: Notice) => void;
  onEdit?: (notice: Notice) => void;
  onDelete?: (notice: Notice) => void;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  notice,
  currentUser,
  onView,
  onEdit,
  onDelete,
}) => {
  // Can edit if Admin OR if Faculty and author matches
  const canModify =
    currentUser &&
    (currentUser.role === 'ADMIN' ||
      (currentUser.role === 'FACULTY' && currentUser.id === notice.author_id));

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
      {/* Top Banner / Badges */}
      <div className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge type="department" value={notice.department} />
            <Badge type="category" value={notice.category} />
            <Badge type="priority" value={notice.priority} />
          </div>

          {/* Show status badge if faculty or admin */}
          {currentUser && currentUser.role !== 'STUDENT' && (
            <Badge type="status" value={notice.status} />
          )}
        </div>

        {/* Notice Title */}
        <h3
          onClick={() => onView(notice)}
          className="text-lg font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors line-clamp-2 leading-snug mb-2"
        >
          {notice.title}
        </h3>

        {/* Content Excerpt - Rendered strictly as plaintext (XSS prevention) */}
        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-4">
          {notice.content}
        </p>
      </div>

      {/* Footer Metadata & Actions */}
      <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center space-x-3">
          {notice.author_name && (
            <span className="flex items-center space-x-1" title={notice.author_email}>
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{notice.author_name}</span>
            </span>
          )}

          <span className="flex items-center space-x-1" title="Posted Date">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(notice.scheduled_at || notice.created_at)}</span>
          </span>

          {notice.expires_at && (
            <span className="flex items-center space-x-1 text-slate-400 hidden sm:flex" title="Valid Until">
              <Clock className="w-3.5 h-3.5" />
              <span>Expires {formatDate(notice.expires_at)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 ml-auto">
          <button
            onClick={() => onView(notice)}
            className="flex items-center space-x-1 px-2.5 py-1 text-indigo-700 hover:bg-indigo-50 rounded-md font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>

          {canModify && onEdit && (
            <button
              onClick={() => onEdit(notice)}
              className="flex items-center space-x-1 px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              title="Edit notice"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {canModify && onDelete && (
            <button
              onClick={() => onDelete(notice)}
              className="flex items-center space-x-1 px-2 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              title="Delete notice"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
