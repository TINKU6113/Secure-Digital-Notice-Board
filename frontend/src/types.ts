export type UserRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

export type Department = 'CSE' | 'CYS' | 'ECE' | 'EEE' | 'ME' | 'General';

export type NoticeCategory =
  | 'Academic'
  | 'Examination'
  | 'Placement'
  | 'Event'
  | 'Workshop'
  | 'Holiday'
  | 'Emergency'
  | 'General';

export type NoticePriority = 'Normal' | 'Important' | 'Urgent';

export type NoticeStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: Department;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  department: Department;
  category: NoticeCategory;
  priority: NoticePriority;
  status: NoticeStatus;
  scheduled_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  status: 'SUCCESS' | 'FAILURE';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SystemStats {
  totalNotices: number;
  published: number;
  scheduled: number;
  draft: number;
  archived: number;
  totalUsers: number;
  totalAuditEvents: number;
}
