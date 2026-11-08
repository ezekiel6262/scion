import type { ExecutionProposal, ExecutionReceipt, PolicyDecision, StrategyVersion } from './domain.ts';
import { hash, id, verifyToken } from './crypto.ts';
import { DomainError } from './domain.ts';

export interface ExecutionAdapter { submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt>; }
export type SettlementReceipt = { reference: string; status: 'settled'; settledAt: string };
export interface SettlementAdapter { settle(input: { idempotencyKey: string; offerId:string; buyer: string; amountMinor: number; currency: 'USDC'; proof?:string }): Promise<SettlementReceipt>; }

export class SimulatedNearIntentsAdapter implements ExecutionAdapter {
  async submit(executor: string, version: StrategyVersion, proposal: ExecutionProposal, decision: PolicyDecision): Promise<ExecutionReceipt> {
    return { id:id('exec'), executor, versionId:version.id, intentHash:hash({ executor, version:version.manifestHash, proposal, policyHash:decision.policyHash }), policyHash:decision.policyHash, mode:'simulated', status:'simulated-settled', createdAt:new Date().toISOString() };
  }
}

export class SimulatedUsdcSettlementAdapter implements SettlementAdapter {
  async settle(input:{idempotencyKey:string;offerId:string;buyer:string;amountMinor:number;currency:'USDC';proof?:string}):Promise<SettlementReceipt>{
    return {reference:`sim_${hash(input).slice(0,24)}`,status:'settled',settledAt:new Date().toISOString()};
  }
}

export class VerifiedUsdcSettlementAdapter implements SettlementAdapter {
  private secret:string;private contractId:string;private treasury:string;private now:()=>Date;
  constructor(secret:string,contractId:string,treasury:string,now=()=>new Date()){this.secret=secret;this.contractId=contractId;this.treasury=treasury;this.now=now;}
  async settle(input:{idempotencyKey:string;offerId:string;buyer:string;amountMinor:number;currency:'USDC';proof?:string}):Promise<SettlementReceipt>{
    if(!input.proof)throw new DomainError('settlement_proof_required','Submit a finalized NEAR USDC payment proof',422);
    const raw=verifyToken(input.proof,this.secret);if(!raw)throw new DomainError('invalid_settlement_proof','Payment proof signature is invalid',422);
    let proof:any;try{proof=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('invalid_settlement_proof','Payment proof is malformed',422)}
    if(proof.kind!=='near-usdc-payment'||proof.sub!==input.buyer||proof.offerId!==input.offerId||proof.contractId!==this.contractId||proof.protocolReceiver!==this.treasury||proof.amountMinor!==input.amountMinor||proof.currency!=='USDC')throw new DomainError('settlement_mismatch','The verified payment does not match this purchase',422);
    if(typeof proof.txHash!=='string'||new Date(proof.exp)<=this.now())throw new DomainError('settlement_proof_expired','Payment proof is expired or invalid',422);
    return {reference:`near:${proof.txHash}`,status:'settled',settledAt:String(proof.settledAt)};
  }
}
