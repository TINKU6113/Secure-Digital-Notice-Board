import React from 'react';
import { NoticePriority, NoticeStatus, UserRole } from '../types.js';

interface BadgeProps {
  type: 'status' | 'priority' | 'role' | 'department' | 'category';
  value: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, value }) => {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (type === 'status') {
    const status = value as NoticeStatus;
    if (status === 'PUBLISHED') colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (status === 'SCHEDULED') colorStyles = 'bg-sky-50 text-sky-700 border-sky-200';
    else if (status === 'DRAFT') colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (status === 'ARCHIVED') colorStyles = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (type === 'priority') {
    const priority = value as NoticePriority;
    if (priority === 'Urgent') colorStyles = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
    else if (priority === 'Important') colorStyles = 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
    else colorStyles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (type === 'role') {
    const role = value as UserRole;
    if (role === 'ADMIN') colorStyles = 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    else if (role === 'FACULTY') colorStyles = 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium';
    else colorStyles = 'bg-teal-50 text-teal-700 border-teal-200';
  } else if (type === 'department') {
    colorStyles = 'bg-slate-100 text-slate-800 border-slate-300';
  } else if (type === 'category') {
    colorStyles = 'bg-violet-50 text-violet-700 border-violet-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles}`}
    >
      {value}
    </span>
  );
};
