import { z } from 'zod';

const DepartmentEnum = z.enum(['CSE', 'CYS', 'ECE', 'EEE', 'ME', 'General']);
const CategoryEnum = z.enum([
  'Academic',
  'Examination',
  'Placement',
  'Event',
  'Workshop',
  'Holiday',
  'Emergency',
  'General',
]);
const PriorityEnum = z.enum(['Normal', 'Important', 'Urgent']);
const StatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

export const createNoticeSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title exceeds 200 characters'),
    content: z.string().trim().min(5, 'Content must be at least 5 characters').max(10000, 'Content exceeds 10,000 characters'),
    department: DepartmentEnum,
    category: CategoryEnum,
    priority: PriorityEnum.default('Normal'),
    status: StatusEnum.default('DRAFT'),
    scheduled_at: z.string().datetime().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduled_at && data.expires_at) {
        return new Date(data.expires_at) > new Date(data.scheduled_at);
      }
      return true;
    },
    {
      message: 'Expiry time must be strictly after the scheduled publication time',
      path: ['expires_at'],
    }
  );

export const updateNoticeSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    content: z.string().trim().min(5).max(10000).optional(),
    department: DepartmentEnum.optional(),
    category: CategoryEnum.optional(),
    priority: PriorityEnum.optional(),
    status: StatusEnum.optional(),
    scheduled_at: z.string().datetime().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduled_at && data.expires_at) {
        return new Date(data.expires_at) > new Date(data.scheduled_at);
      }
      return true;
    },
    {
      message: 'Expiry time must be strictly after the scheduled publication time',
      path: ['expires_at'],
    }
  );

export const scheduleNoticeSchema = z
  .object({
    scheduled_at: z.string().datetime('Valid scheduled ISO datetime required'),
    expires_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.expires_at) {
        return new Date(data.expires_at) > new Date(data.scheduled_at);
      }
      return true;
    },
    {
      message: 'Expiry time must be strictly after scheduled publication time',
      path: ['expires_at'],
    }
  );

export const queryNoticeSchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: DepartmentEnum.optional(),
  category: CategoryEnum.optional(),
  priority: PriorityEnum.optional(),
  status: StatusEnum.optional(),
  scope: z.enum(['all', 'my']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export const noticeIdParamSchema = z.object({
  id: z.string().uuid('Notice ID must be a valid UUID'),
});
