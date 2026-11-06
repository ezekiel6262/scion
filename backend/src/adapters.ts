import type { ExecutionProposal, ExecutionReceipt, PolicyDecision, StrategyVersion } from './domain.ts';
import { hash, id } from './crypto.ts';

export interface ExecutionAdapter { submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt>; }

export class SimulatedNearIntentsAdapter implements ExecutionAdapter {
  async submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt> {
    return { id:id('exec'), executor, versionId:version.id, intentHash:hash({ executor, version:version.manifestHash, proposal, policyHash:decision.policyHash }), policyHash:decision.policyHash, mode:'simulated', status:'simulated-settled', createdAt:new Date().toISOString() };
  }
}
