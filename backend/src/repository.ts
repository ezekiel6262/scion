import type { AccessOffer, AccessPurchase, Capability, ExecutionReceipt, ForkEdge, LedgerEntry, Profile, Strategy, StrategyVersion } from './domain.ts';

export interface Repository {
  putStrategy(value: Strategy): Promise<void>; getStrategy(id: string): Promise<Strategy | undefined>; listStrategies(): Promise<Strategy[]>;
  putVersion(value: StrategyVersion): Promise<void>; getVersion(id: string): Promise<StrategyVersion | undefined>;
  putCapability(value: Capability): Promise<void>; getCapability(id: string): Promise<Capability | undefined>;
  putFork(value: ForkEdge): Promise<void>; listForks(strategyId: string): Promise<ForkEdge[]>;
  getForkByChildVersion(versionId: string): Promise<ForkEdge | undefined>;
  putExecution(value: ExecutionReceipt): Promise<void>;
  putOffer(value: AccessOffer): Promise<void>; getOffer(id: string): Promise<AccessOffer | undefined>;
  getPurchaseByIdempotency(buyer: string, key: string): Promise<AccessPurchase | undefined>;
  settleAccessPurchase(purchase: AccessPurchase, capability: Capability, entries: LedgerEntry[]): Promise<void>;
  listLedgerEntries(account: string): Promise<LedgerEntry[]>;
  getProfile(account: string): Promise<Profile | undefined>; putProfile(value: Profile): Promise<void>;
}

export class MemoryRepository implements Repository {
  strategies = new Map<string, Strategy>(); versions = new Map<string, StrategyVersion>(); capabilities = new Map<string, Capability>(); forks = new Map<string, ForkEdge>(); executions = new Map<string, ExecutionReceipt>(); offers = new Map<string, AccessOffer>(); purchases = new Map<string, AccessPurchase>(); ledger = new Map<string, LedgerEntry>(); profiles = new Map<string, Profile>();
  async putStrategy(v: Strategy) { this.strategies.set(v.id, structuredClone(v)); }
  async getStrategy(id: string) { const v=this.strategies.get(id); return v&&structuredClone(v); }
  async listStrategies() { return [...this.strategies.values()].map(value => structuredClone(value)); }
  async putVersion(v: StrategyVersion) { this.versions.set(v.id, structuredClone(v)); }
  async getVersion(id: string) { const v=this.versions.get(id); return v&&structuredClone(v); }
  async putCapability(v: Capability) { this.capabilities.set(v.id, structuredClone(v)); }
  async getCapability(id: string) { const v=this.capabilities.get(id); return v&&structuredClone(v); }
  async putFork(v: ForkEdge) { this.forks.set(v.id, structuredClone(v)); }
  async listForks(strategyId: string) { const strategy=await this.getStrategy(strategyId); if(!strategy)return []; const ids=new Set([strategy.latestVersionId]); return [...this.forks.values()].filter(f=>ids.has(f.parentVersionId)||ids.has(f.childVersionId)).map(value => structuredClone(value)); }
  async getForkByChildVersion(versionId:string){const v=[...this.forks.values()].find(f=>f.childVersionId===versionId);return v&&structuredClone(v);}
  async putExecution(v: ExecutionReceipt) { this.executions.set(v.id, structuredClone(v)); }
  async putOffer(v:AccessOffer){this.offers.set(v.id,structuredClone(v));}
  async getOffer(id:string){const v=this.offers.get(id);return v&&structuredClone(v);}
  async getPurchaseByIdempotency(buyer:string,key:string){const v=[...this.purchases.values()].find(p=>p.buyer===buyer&&p.idempotencyKey===key);return v&&structuredClone(v);}
  async settleAccessPurchase(purchase:AccessPurchase,capability:Capability,entries:LedgerEntry[]){const existing=await this.getPurchaseByIdempotency(purchase.buyer,purchase.idempotencyKey);if(existing)return;this.purchases.set(purchase.id,structuredClone(purchase));this.capabilities.set(capability.id,structuredClone(capability));for(const entry of entries)this.ledger.set(entry.id,structuredClone(entry));}
  async listLedgerEntries(account:string){return [...this.ledger.values()].filter(e=>e.account===account).map(e=>structuredClone(e));}
  async getProfile(account:string){const value=this.profiles.get(account);return value&&structuredClone(value);}
  async putProfile(value:Profile){this.profiles.set(value.accountId,structuredClone(value));}
}
