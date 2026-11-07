import { Pool } from 'pg';
import { schemaSql } from '../db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
try {
  await pool.query('select pg_advisory_lock($1)', [724216]);
  await pool.query(schemaSql);
  console.info('Scion database schema is current.');
} finally {
  await pool.query('select pg_advisory_unlock($1)', [724216]).catch(() => undefined);
  await pool.end();
}
