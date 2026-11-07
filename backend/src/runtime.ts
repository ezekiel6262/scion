import { MemoryRepository, type Repository } from './repository.ts';
import { MemoryAuthStore, type AuthStore } from './auth.ts';
import { Pool } from 'pg';

let pool:Pool|undefined;
function databaseUrl(){
  if(process.env.DATABASE_URL)return process.env.DATABASE_URL;
  const {DB_HOST,DB_PORT='5432',DB_NAME='scion',DB_USER='scion_admin',DB_PASSWORD}=process.env;
  if(!DB_HOST||!DB_PASSWORD)return undefined;
  return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`;
}
function getPool(url:string){if(!pool)pool=new Pool({connectionString:url,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:undefined});return pool;}

export async function createRepository(): Promise<Repository> {
  const url=databaseUrl();
  if(!url) return new MemoryRepository();
  const { PostgresRepository }=await import('./postgres-repository.ts');
  return new PostgresRepository(getPool(url));
}

export async function createAuthStore():Promise<AuthStore>{const url=databaseUrl();if(!url)return new MemoryAuthStore();const {PostgresAuthStore}=await import('./postgres-repository.ts');return new PostgresAuthStore(getPool(url));}
