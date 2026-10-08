import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email exceeds maximum allowed length'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(100, 'Password exceeds maximum allowed length'),
});

export type LoginInput = z.infer<typeof loginSchema>;
