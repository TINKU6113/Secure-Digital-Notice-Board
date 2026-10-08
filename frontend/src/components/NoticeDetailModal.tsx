import React from 'react';
import { Notice } from '../types.js';
import { Badge } from './Badge.js';
import { X, Calendar, User, Clock, Building } from 'lucide-react';

interface NoticeDetailModalProps {
  notice: Notice | null;
  onClose: () => void;
}

export const NoticeDetailModal: React.FC<NoticeDetailModalProps> = ({ notice, onClose }) => {
  if (!notice) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-2 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge type="department" value={notice.department} />
              <Badge type="category" value={notice.category} />
              <Badge type="priority" value={notice.priority} />
              <Badge type="status" value={notice.status} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">
              {notice.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Pure Text Rendering (Zero XSS Execution) */}
        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-6">
          <div className="prose prose-slate max-w-none">
            {/* 
              SECURITY NOTE FOR SSE AUDIT:
              Notice content is untrusted input. We deliberately render using React's default text node
              interpolation with `whitespace-pre-wrap`. Under no circumstances do we use dangerouslySetInnerHTML.
              Even if a user inputs `<script>alert(1)</script>`, it is safely rendered as escaped text.
            */}
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
              {notice.content}
            </p>
          </div>

          {/* Metadata Section */}
          <div className="border-t border-slate-100 pt-5 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50/70 p-4 rounded-xl">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>
                <strong className="text-slate-700">Author:</strong> {notice.author_name} ({notice.author_email})
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-slate-400" />
              <span>
                <strong className="text-slate-700">Department:</strong> {notice.department}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>
                <strong className="text-slate-700">Publication Date:</strong> {formatDate(notice.scheduled_at || notice.created_at)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                <strong className="text-slate-700">Expiry Date:</strong> {formatDate(notice.expires_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
