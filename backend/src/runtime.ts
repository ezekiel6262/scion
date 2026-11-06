import { MemoryRepository, type Repository } from './repository.ts';
import { MemoryAuthStore, type AuthStore } from './auth.ts';
import { Pool } from '@neondatabase/serverless';

let pool:Pool|undefined;
function getPool(url:string){if(!pool)pool=new Pool({connectionString:url});return pool;}

export async function createRepository(): Promise<Repository> {
  const url=process.env.DATABASE_URL;
  if(!url) return new MemoryRepository();
  const { PostgresRepository }=await import('./postgres-repository.ts');
  return new PostgresRepository(getPool(url));
}

export async function createAuthStore():Promise<AuthStore>{const url=process.env.DATABASE_URL;if(!url)return new MemoryAuthStore();const {PostgresAuthStore}=await import('./postgres-repository.ts');return new PostgresAuthStore(getPool(url));}
