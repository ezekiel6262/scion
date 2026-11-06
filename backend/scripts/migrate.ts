import { readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const url=process.env.DATABASE_URL;
if(!url)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:url});
try{const sql=await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8');await pool.query(sql);console.info('Scion database migration applied');}finally{await pool.end();}
