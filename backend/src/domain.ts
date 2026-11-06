export type Scope = 'thesis.summary' | 'positions.assets' | 'positions.sizes' | 'strategy.fork' | 'execution.preview' | 'execution.submit';
export type CapabilityStatus = 'active' | 'revoked';

export type Position = { asset: string; chain: string; targetWeightBps: number };
export type StrategyVersion = {
  id: string; strategyId: string; semver: string; owner: string; parentVersionId?: string;
  thesis: { summary: string; evidence: string[] }; positions: Position[];
  rules: { maxSlippageBps: number; entry: string; exit: string };
  risk: { maxDrawdownBps: number; leverageBps: number }; horizonDays: number;
  manifestHash: string; createdAt: string;
};
export type Strategy = { id: string; slug: string; name: string; owner: string; latestVersionId: string; visibility: 'public-metrics-private-content'; royaltyBps: number };
export type Capability = { id: string; subject: string; issuer: string; versionId: string; scopes: Scope[]; expiresAt: string; status: CapabilityStatus; tokenHash: string; priceMinor: number; currency: 'USDC'; createdAt: string; revokedAt?: string };
export type ForkEdge = { id: string; parentVersionId: string; childVersionId: string; creator: string; changedFields: string[]; royaltyBps: number; createdAt: string };
export type FollowerPolicy = { maxAllocationBps: number; maxSlippageBps: number; allowedAssets: string[]; maxLeverageBps: number; dailyLossLimitBps: number; manualConfirmationAboveMinor: number };
export type ExecutionProposal = { versionId: string; requestedAllocationBps: number; slippageBps: number; leverageBps: number; assets: string[]; notionalMinor: number };
export type PolicyDecision = { allowed: boolean; requiresConfirmation: boolean; effectiveAllocationBps: number; violations: string[]; clamps: string[]; policyHash: string };
export type ExecutionReceipt = { id: string; executor: string; versionId: string; intentHash: string; policyHash: string; mode: 'simulated' | 'live'; status: 'simulated-settled' | 'submitted'; createdAt: string };

export class DomainError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}
