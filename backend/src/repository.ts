import type { Capability, ExecutionReceipt, ForkEdge, Strategy, StrategyVersion } from './domain.ts';

export interface Repository {
  putStrategy(value: Strategy): Promise<void>; getStrategy(id: string): Promise<Strategy | undefined>; listStrategies(): Promise<Strategy[]>;
  putVersion(value: StrategyVersion): Promise<void>; getVersion(id: string): Promise<StrategyVersion | undefined>;
  putCapability(value: Capability): Promise<void>; getCapability(id: string): Promise<Capability | undefined>;
  putFork(value: ForkEdge): Promise<void>; listForks(strategyId: string): Promise<ForkEdge[]>;
  putExecution(value: ExecutionReceipt): Promise<void>;
}

export class MemoryRepository implements Repository {
  strategies = new Map<string, Strategy>(); versions = new Map<string, StrategyVersion>(); capabilities = new Map<string, Capability>(); forks = new Map<string, ForkEdge>(); executions = new Map<string, ExecutionReceipt>();
  async putStrategy(v: Strategy) { this.strategies.set(v.id, structuredClone(v)); }
  async getStrategy(id: string) { const v=this.strategies.get(id); return v&&structuredClone(v); }
  async listStrategies() { return [...this.strategies.values()].map(value => structuredClone(value)); }
  async putVersion(v: StrategyVersion) { this.versions.set(v.id, structuredClone(v)); }
  async getVersion(id: string) { const v=this.versions.get(id); return v&&structuredClone(v); }
  async putCapability(v: Capability) { this.capabilities.set(v.id, structuredClone(v)); }
  async getCapability(id: string) { const v=this.capabilities.get(id); return v&&structuredClone(v); }
  async putFork(v: ForkEdge) { this.forks.set(v.id, structuredClone(v)); }
  async listForks(strategyId: string) { const strategy=await this.getStrategy(strategyId); if(!strategy)return []; const ids=new Set([strategy.latestVersionId]); return [...this.forks.values()].filter(f=>ids.has(f.parentVersionId)||ids.has(f.childVersionId)).map(value => structuredClone(value)); }
  async putExecution(v: ExecutionReceipt) { this.executions.set(v.id, structuredClone(v)); }
}
