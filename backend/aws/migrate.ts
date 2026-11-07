import type { Handler } from 'aws-lambda';
import { Pool } from 'pg';
import { schemaSql } from '../db/schema.ts';

export const handler: Handler = async () => {
  const { DB_HOST, DB_PORT = '5432', DB_NAME = 'scion', DB_USER = 'scion_admin', DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_PASSWORD) throw new Error('Database configuration is incomplete');
  const pool = new Pool({ host: DB_HOST, port: Number(DB_PORT), database: DB_NAME, user: DB_USER, password: DB_PASSWORD, max: 1, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('select pg_advisory_lock($1)', [724216]);
    await pool.query(schemaSql);
    return { migrated: true };
  } finally {
    await pool.query('select pg_advisory_unlock($1)', [724216]).catch(() => undefined);
    await pool.end();
  }
};
