import type { AccessOffer, AccessPurchase, Capability, ExecutionReceipt, ForkEdge, LedgerEntry, ProductObject, Profile, Strategy, StrategyVersion } from './domain.ts';
import type { Repository } from './repository.ts';
import type { AuthChallenge, AuthStore } from './auth.ts';

export interface QueryClient extends Queryable { release(): void }
export interface Queryable { query(text: string, values?: unknown[]): Promise<{ rows: any[] }>; connect?():Promise<QueryClient> }

export class PostgresRepository implements Repository {
  constructor(privateDb: Queryable) { this.db = privateDb; }
  private db: Queryable;

  async putStrategy(v: Strategy) {
    await this.db.query(`INSERT INTO scion_private.strategies (id,slug,name,owner_account,latest_version_id,visibility,royalty_bps)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,latest_version_id=EXCLUDED.latest_version_id,visibility=EXCLUDED.visibility,royalty_bps=EXCLUDED.royalty_bps`, [v.id,v.slug,v.name,v.owner,v.latestVersionId,v.visibility,v.royaltyBps]);
  }
  async getStrategy(id: string) { const r=await this.db.query('SELECT * FROM scion_private.strategies WHERE id=$1',[id]); return r.rows[0]&&toStrategy(r.rows[0]); }
  async listStrategies() { const r=await this.db.query('SELECT * FROM scion_private.strategies ORDER BY created_at DESC'); return r.rows.map(toStrategy); }
  async putVersion(v: StrategyVersion) {
    await this.db.query(`INSERT INTO scion_private.strategy_versions (id,strategy_id,semver,owner_account,parent_version_id,payload,manifest_hash,created_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT (id) DO NOTHING`,[v.id,v.strategyId,v.semver,v.owner,v.parentVersionId??null,JSON.stringify(v),v.manifestHash,v.createdAt]);
  }
  async getVersion(id: string) { const r=await this.db.query('SELECT payload FROM scion_private.strategy_versions WHERE id=$1',[id]); return r.rows[0]?.payload as StrategyVersion|undefined; }
  async listVersions(strategyId:string){const r=await this.db.query('SELECT payload FROM scion_private.strategy_versions WHERE strategy_id=$1 ORDER BY created_at DESC',[strategyId]);return r.rows.map(v=>v.payload as StrategyVersion);}
  async putCapability(v: Capability) {
    await this.db.query(`INSERT INTO scion_private.capabilities (id,subject_account,issuer_account,version_id,scopes,expires_at,status,token_hash,price_minor,currency,created_at,revoked_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,revoked_at=EXCLUDED.revoked_at`,[v.id,v.subject,v.issuer,v.versionId,v.scopes,v.expiresAt,v.status,v.tokenHash,v.priceMinor,v.currency,v.createdAt,v.revokedAt??null]);
  }
  async getCapability(id: string) { const r=await this.db.query('SELECT * FROM scion_private.capabilities WHERE id=$1',[id]); return r.rows[0]&&toCapability(r.rows[0]); }
  async putFork(v: ForkEdge) { await this.db.query(`INSERT INTO scion_private.fork_edges (id,parent_version_id,child_version_id,creator_account,changed_fields,royalty_bps,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,[v.id,v.parentVersionId,v.childVersionId,v.creator,v.changedFields,v.royaltyBps,v.createdAt]); }
  async listForks(strategyId: string) { const r=await this.db.query(`SELECT f.* FROM scion_private.fork_edges f JOIN scion_private.strategy_versions v ON v.id=f.parent_version_id OR v.id=f.child_version_id WHERE v.strategy_id=$1 ORDER BY f.created_at`,[strategyId]); return r.rows.map(toFork); }
  async getForkByChildVersion(versionId:string){const r=await this.db.query('SELECT * FROM scion_private.fork_edges WHERE child_version_id=$1',[versionId]);return r.rows[0]&&toFork(r.rows[0]);}
  async putExecution(v: ExecutionReceipt) { await this.db.query(`INSERT INTO scion_private.executions (id,executor_account,version_id,intent_hash,policy_hash,mode,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,[v.id,v.executor,v.versionId,v.intentHash,v.policyHash,v.mode,v.status,v.createdAt]); }
  async listExecutions(versionId:string){const r=await this.db.query('SELECT * FROM scion_private.executions WHERE version_id=$1 ORDER BY created_at DESC',[versionId]);return r.rows.map(toExecution);}
  async putOffer(v:AccessOffer){await this.db.query(`INSERT INTO scion_private.access_offers (id,issuer_account,version_id,scopes,expires_in_seconds,price_minor,currency,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status`,[v.id,v.issuer,v.versionId,v.scopes,v.expiresInSeconds,v.priceMinor,v.currency,v.status,v.createdAt]);}
  async getOffer(id:string){const r=await this.db.query('SELECT * FROM scion_private.access_offers WHERE id=$1',[id]);return r.rows[0]&&toOffer(r.rows[0]);}
  async getPurchaseByIdempotency(buyer:string,key:string){const r=await this.db.query('SELECT * FROM scion_private.access_purchases WHERE buyer_account=$1 AND idempotency_key=$2',[buyer,key]);return r.rows[0]&&toPurchase(r.rows[0]);}
  async settleAccessPurchase(p:AccessPurchase,c:Capability,entries:LedgerEntry[]){
    if(!this.db.connect)throw new Error('Database adapter does not support transactions'); const client=await this.db.connect();
    try{await client.query('BEGIN');const inserted=await client.query(`INSERT INTO scion_private.access_purchases (id,idempotency_key,buyer_account,offer_id,version_id,issuer_account,amount_minor,currency,status,settlement_ref,capability_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (buyer_account,idempotency_key) DO NOTHING RETURNING id`,[p.id,p.idempotencyKey,p.buyer,p.offerId,p.versionId,p.issuer,p.amountMinor,p.currency,p.status,p.settlementRef,p.capabilityId,p.createdAt]);if(!inserted.rows.length){await client.query('ROLLBACK');return;}await client.query(`INSERT INTO scion_private.capabilities (id,subject_account,issuer_account,version_id,scopes,expires_at,status,token_hash,price_minor,currency,created_at,revoked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[c.id,c.subject,c.issuer,c.versionId,c.scopes,c.expiresAt,c.status,c.tokenHash,c.priceMinor,c.currency,c.createdAt,c.revokedAt??null]);for(const e of entries)await client.query(`INSERT INTO scion_private.ledger_entries (id,purchase_id,account_id,kind,amount_minor,currency,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[e.id,e.purchaseId,e.account,e.kind,e.amountMinor,e.currency,e.createdAt]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async listLedgerEntries(account:string){const r=await this.db.query('SELECT * FROM scion_private.ledger_entries WHERE account_id=$1 ORDER BY created_at DESC,id DESC',[account]);return r.rows.map(toLedgerEntry);}
  async getProfile(account:string){const r=await this.db.query("SELECT payload FROM scion_private.product_objects WHERE id=$1 AND object_type='profile'",[`profile:${account}`]);return r.rows[0]?.payload as Profile|undefined;}
  async getProfileByHandle(handle:string){const r=await this.db.query("SELECT payload FROM scion_private.product_objects WHERE object_type='profile' AND lower(payload->>'handle')=lower($1) LIMIT 1",[handle]);return r.rows[0]?.payload as Profile|undefined;}
  async putProfile(value:Profile){await this.db.query(`INSERT INTO scion_private.product_objects (id,object_type,owner_account,visibility,payload,created_at,updated_at) VALUES ($1,'profile',$2,'public',$3::jsonb,$4,$5) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`,[`profile:${value.accountId}`,value.accountId,JSON.stringify(value),value.createdAt,value.updatedAt]);}
  async putProductObject(v:ProductObject){await this.db.query(`INSERT INTO scion_private.product_objects (id,object_type,owner_account,strategy_id,visibility,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,visibility=EXCLUDED.visibility,updated_at=EXCLUDED.updated_at`,[v.id,v.objectType,v.ownerAccount,v.strategyId??null,v.visibility,JSON.stringify(v.payload),v.createdAt,v.updatedAt]);}
  async getProductObject(id:string){const r=await this.db.query('SELECT * FROM scion_private.product_objects WHERE id=$1',[id]);return r.rows[0]&&toProductObject(r.rows[0]);}
  async deleteProductObject(id:string){await this.db.query('DELETE FROM scion_private.product_objects WHERE id=$1',[id]);}
  async listProductObjects(type:ProductObject['objectType']){const r=await this.db.query('SELECT * FROM scion_private.product_objects WHERE object_type=$1 ORDER BY created_at DESC',[type]);return r.rows.map(toProductObject);}
}

export class PostgresAuthStore implements AuthStore {
  constructor(privateDb: Queryable){this.db=privateDb;} private db:Queryable;
  async putChallenge(v:AuthChallenge){await this.db.query(`INSERT INTO scion_private.auth_challenges (id,account_id,public_key,message,expires_at,used_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET used_at=EXCLUDED.used_at`,[v.id,v.accountId,v.publicKey,v.message,v.expiresAt,v.usedAt??null]);}
  async getChallenge(id:string){const r=await this.db.query('SELECT * FROM scion_private.auth_challenges WHERE id=$1',[id]);const v=r.rows[0];return v?{id:v.id,accountId:v.account_id,publicKey:v.public_key,message:v.message,expiresAt:new Date(v.expires_at).toISOString(),usedAt:v.used_at?new Date(v.used_at).toISOString():undefined}:undefined;}
}

const toStrategy=(r:any):Strategy=>({id:r.id,slug:r.slug,name:r.name,owner:r.owner_account,latestVersionId:r.latest_version_id,visibility:r.visibility,royaltyBps:r.royalty_bps});
const toCapability=(r:any):Capability=>({id:r.id,subject:r.subject_account,issuer:r.issuer_account,versionId:r.version_id,scopes:r.scopes,expiresAt:new Date(r.expires_at).toISOString(),status:r.status,tokenHash:r.token_hash,priceMinor:Number(r.price_minor),currency:r.currency,createdAt:new Date(r.created_at).toISOString(),revokedAt:r.revoked_at?new Date(r.revoked_at).toISOString():undefined});
const toFork=(r:any):ForkEdge=>({id:r.id,parentVersionId:r.parent_version_id,childVersionId:r.child_version_id,creator:r.creator_account,changedFields:r.changed_fields,royaltyBps:r.royalty_bps,createdAt:new Date(r.created_at).toISOString()});
const toOffer=(r:any):AccessOffer=>({id:r.id,issuer:r.issuer_account,versionId:r.version_id,scopes:r.scopes,expiresInSeconds:r.expires_in_seconds,priceMinor:Number(r.price_minor),currency:r.currency,status:r.status,createdAt:new Date(r.created_at).toISOString()});
const toPurchase=(r:any):AccessPurchase=>({id:r.id,idempotencyKey:r.idempotency_key,buyer:r.buyer_account,offerId:r.offer_id,versionId:r.version_id,issuer:r.issuer_account,amountMinor:Number(r.amount_minor),currency:r.currency,status:r.status,settlementRef:r.settlement_ref,capabilityId:r.capability_id,createdAt:new Date(r.created_at).toISOString()});
const toLedgerEntry=(r:any):LedgerEntry=>({id:r.id,purchaseId:r.purchase_id,account:r.account_id,kind:r.kind,amountMinor:Number(r.amount_minor),currency:r.currency,createdAt:new Date(r.created_at).toISOString()});
const toExecution=(r:any):ExecutionReceipt=>({id:r.id,executor:r.executor_account,versionId:r.version_id,intentHash:r.intent_hash,policyHash:r.policy_hash,mode:r.mode,status:r.status,createdAt:new Date(r.created_at).toISOString()});
const toProductObject=(r:any):ProductObject=>({id:r.id,objectType:r.object_type,ownerAccount:r.owner_account,strategyId:r.strategy_id??undefined,visibility:r.visibility,payload:r.payload,createdAt:new Date(r.created_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()});
