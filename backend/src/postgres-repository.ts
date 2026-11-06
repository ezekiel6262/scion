import type { Capability, ExecutionReceipt, ForkEdge, Strategy, StrategyVersion } from './domain.ts';
import type { Repository } from './repository.ts';
import type { AuthChallenge, AuthStore } from './auth.ts';

export interface Queryable { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> }

export class PostgresRepository implements Repository {
  constructor(privateDb: Queryable) { this.db = privateDb; }
  private db: Queryable;

  async putStrategy(v: Strategy) {
    await this.db.query(`INSERT INTO strategies (id,slug,name,owner_account,latest_version_id,visibility,royalty_bps)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,latest_version_id=EXCLUDED.latest_version_id,visibility=EXCLUDED.visibility,royalty_bps=EXCLUDED.royalty_bps`, [v.id,v.slug,v.name,v.owner,v.latestVersionId,v.visibility,v.royaltyBps]);
  }
  async getStrategy(id: string) { const r=await this.db.query('SELECT * FROM strategies WHERE id=$1',[id]); return r.rows[0]&&toStrategy(r.rows[0]); }
  async listStrategies() { const r=await this.db.query('SELECT * FROM strategies ORDER BY created_at DESC'); return r.rows.map(toStrategy); }
  async putVersion(v: StrategyVersion) {
    await this.db.query(`INSERT INTO strategy_versions (id,strategy_id,semver,owner_account,parent_version_id,payload,manifest_hash,created_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT (id) DO NOTHING`,[v.id,v.strategyId,v.semver,v.owner,v.parentVersionId??null,JSON.stringify(v),v.manifestHash,v.createdAt]);
  }
  async getVersion(id: string) { const r=await this.db.query('SELECT payload FROM strategy_versions WHERE id=$1',[id]); return r.rows[0]?.payload as StrategyVersion|undefined; }
  async putCapability(v: Capability) {
    await this.db.query(`INSERT INTO capabilities (id,subject_account,issuer_account,version_id,scopes,expires_at,status,token_hash,price_minor,currency,created_at,revoked_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,revoked_at=EXCLUDED.revoked_at`,[v.id,v.subject,v.issuer,v.versionId,v.scopes,v.expiresAt,v.status,v.tokenHash,v.priceMinor,v.currency,v.createdAt,v.revokedAt??null]);
  }
  async getCapability(id: string) { const r=await this.db.query('SELECT * FROM capabilities WHERE id=$1',[id]); return r.rows[0]&&toCapability(r.rows[0]); }
  async putFork(v: ForkEdge) { await this.db.query(`INSERT INTO fork_edges (id,parent_version_id,child_version_id,creator_account,changed_fields,royalty_bps,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,[v.id,v.parentVersionId,v.childVersionId,v.creator,v.changedFields,v.royaltyBps,v.createdAt]); }
  async listForks(strategyId: string) { const r=await this.db.query(`SELECT f.* FROM fork_edges f JOIN strategy_versions v ON v.id=f.parent_version_id OR v.id=f.child_version_id WHERE v.strategy_id=$1 ORDER BY f.created_at`,[strategyId]); return r.rows.map(toFork); }
  async putExecution(v: ExecutionReceipt) { await this.db.query(`INSERT INTO executions (id,executor_account,version_id,intent_hash,policy_hash,mode,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,[v.id,v.executor,v.versionId,v.intentHash,v.policyHash,v.mode,v.status,v.createdAt]); }
}

export class PostgresAuthStore implements AuthStore {
  constructor(privateDb: Queryable){this.db=privateDb;} private db:Queryable;
  async putChallenge(v:AuthChallenge){await this.db.query(`INSERT INTO auth_challenges (id,account_id,public_key,message,expires_at,used_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET used_at=EXCLUDED.used_at`,[v.id,v.accountId,v.publicKey,v.message,v.expiresAt,v.usedAt??null]);}
  async getChallenge(id:string){const r=await this.db.query('SELECT * FROM auth_challenges WHERE id=$1',[id]);const v=r.rows[0];return v?{id:v.id,accountId:v.account_id,publicKey:v.public_key,message:v.message,expiresAt:new Date(v.expires_at).toISOString(),usedAt:v.used_at?new Date(v.used_at).toISOString():undefined}:undefined;}
}

const toStrategy=(r:any):Strategy=>({id:r.id,slug:r.slug,name:r.name,owner:r.owner_account,latestVersionId:r.latest_version_id,visibility:r.visibility,royaltyBps:r.royalty_bps});
const toCapability=(r:any):Capability=>({id:r.id,subject:r.subject_account,issuer:r.issuer_account,versionId:r.version_id,scopes:r.scopes,expiresAt:new Date(r.expires_at).toISOString(),status:r.status,tokenHash:r.token_hash,priceMinor:Number(r.price_minor),currency:r.currency,createdAt:new Date(r.created_at).toISOString(),revokedAt:r.revoked_at?new Date(r.revoked_at).toISOString():undefined});
const toFork=(r:any):ForkEdge=>({id:r.id,parentVersionId:r.parent_version_id,childVersionId:r.child_version_id,creator:r.creator_account,changedFields:r.changed_fields,royaltyBps:r.royalty_bps,createdAt:new Date(r.created_at).toISOString()});
