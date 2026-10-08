import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or backend directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // Fallback to current directory .env

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5434'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres_secure_pass_123'),
  DB_NAME: z.string().default('digital_notice_board'),
  DB_SSL: z.string().transform((val) => val === 'true').default('false'),

  // Auth & Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for cryptographic security'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('10'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration validation failed:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
