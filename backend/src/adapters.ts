import type { ExecutionProposal, ExecutionReceipt, PolicyDecision, StrategyVersion } from './domain.ts';
import { hash, id } from './crypto.ts';

export interface ExecutionAdapter { submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt>; }
export type SettlementReceipt = { reference: string; status: 'settled'; settledAt: string };
export interface SettlementAdapter { settle(input: { idempotencyKey: string; buyer: string; amountMinor: number; currency: 'USDC' }): Promise<SettlementReceipt>; }

export class SimulatedNearIntentsAdapter implements ExecutionAdapter {
  async submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt> {
    return { id:id('exec'), executor, versionId:version.id, intentHash:hash({ executor, version:version.manifestHash, proposal, policyHash:decision.policyHash }), policyHash:decision.policyHash, mode:'simulated', status:'simulated-settled', createdAt:new Date().toISOString() };
  }
}

export class SimulatedUsdcSettlementAdapter implements SettlementAdapter {
  async settle(input:{idempotencyKey:string;buyer:string;amountMinor:number;currency:'USDC'}):Promise<SettlementReceipt>{
    return {reference:`sim_${hash(input).slice(0,24)}`,status:'settled',settledAt:new Date().toISOString()};
  }
}
