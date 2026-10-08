import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute parameterized queries safely.
 * Parameterized queries protect against SQL Injection (CWE-89) at the database driver level.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  
  if (env.NODE_ENV === 'development') {
    // Queries logged in dev for debugging and audit traceability
    // Note: Parameter values are not logged if they contain sensitive fields
    console.log(`[SQL Query] duration: ${duration}ms, rows: ${res.rowCount}`);
  }
  return res;
}
