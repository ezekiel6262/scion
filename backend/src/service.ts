import { DomainError, type AccessOffer, type AccessPurchase, type Capability, type ExecutionProposal, type FollowerPolicy, type ForkEdge, type LedgerEntry, type PolicyDecision, type Scope, type Strategy, type StrategyVersion } from './domain.ts';
import type { Repository } from './repository.ts';
import { SimulatedUsdcSettlementAdapter, type ExecutionAdapter, type SettlementAdapter } from './adapters.ts';
import { hash, id, signToken, verifyToken } from './crypto.ts';

const publicVersion = (v: StrategyVersion) => ({ id:v.id, strategyId:v.strategyId, semver:v.semver, owner:v.owner, parentVersionId:v.parentVersionId, riskClass:v.risk.maxDrawdownBps<=500?'conservative':'balanced', horizonDays:v.horizonDays, manifestHash:v.manifestHash, createdAt:v.createdAt, restricted:['thesis','positions','rules'] });

export class ScionService {
  private repo: Repository;
  private execution: ExecutionAdapter;
  private secret: string;
  private now: () => Date;
  private settlement: SettlementAdapter;
  constructor(repo: Repository, execution: ExecutionAdapter, secret: string, now=()=>new Date(), settlement: SettlementAdapter=new SimulatedUsdcSettlementAdapter()) { this.repo=repo; this.execution=execution; this.secret=secret; this.now=now; this.settlement=settlement; }
  async seed() {
    if ((await this.repo.listStrategies()).length) return;
    const strategy:Strategy={id:'strat_quiet_delta',slug:'quiet-delta',name:'Quiet Delta',owner:'alice.near',latestVersionId:'ver_quiet_delta_130',visibility:'public-metrics-private-content',royaltyBps:500};
    const version:StrategyVersion={id:strategy.latestVersionId,strategyId:strategy.id,semver:'1.3.0',owner:strategy.owner,thesis:{summary:'Stablecoin routing dislocations mean-revert when cross-chain volatility falls below its 20-day band.',evidence:['dataset:bridge-flows@2026-10','model:31b4…8fe0']},positions:[{asset:'USDC',chain:'near',targetWeightBps:6000},{asset:'USDT',chain:'arbitrum',targetWeightBps:4000}],rules:{maxSlippageBps:50,entry:'volatility_below_20d_band',exit:'spread_mean_reverted'},risk:{maxDrawdownBps:800,leverageBps:10000},horizonDays:30,manifestHash:'',createdAt:this.now().toISOString()};
    version.manifestHash=hash(version); await this.repo.putStrategy(strategy); await this.repo.putVersion(version);
  }
  async listStrategies(){ return Promise.all((await this.repo.listStrategies()).map(async s=>({...s,latestVersion:publicVersion((await this.repo.getVersion(s.latestVersionId))!)}))); }
  async createStrategy(actor:string,input:any){
    requireFields(input,['name','slug','thesis','positions','rules','risk','horizonDays']); const strategyId=id('strat'),versionId=id('ver');
    const version:StrategyVersion={id:versionId,strategyId,semver:'1.0.0',owner:actor,thesis:input.thesis,positions:input.positions,rules:input.rules,risk:input.risk,horizonDays:input.horizonDays,manifestHash:'',createdAt:this.now().toISOString()}; version.manifestHash=hash(version);
    const strategy:Strategy={id:strategyId,slug:input.slug,name:input.name,owner:actor,latestVersionId:versionId,visibility:'public-metrics-private-content',royaltyBps:input.royaltyBps??500}; await this.repo.putStrategy(strategy); await this.repo.putVersion(version); return {strategy,version:publicVersion(version)};
  }
  async readVersion(actor:string|undefined,versionId:string,token?:string){
    const version=await this.mustVersion(versionId); if(actor===version.owner)return version; const base=publicVersion(version); if(!token||!actor)return base;
    const capability=await this.validateCapability(actor,versionId,token); const out:any={...base};
    if(capability.scopes.includes('thesis.summary'))out.thesis={summary:version.thesis.summary};
    if(capability.scopes.includes('positions.assets'))out.positions=version.positions.map(p=>({asset:p.asset,chain:p.chain}));
    if(capability.scopes.includes('positions.sizes'))out.positions=version.positions;
    out.capability={id:capability.id,scopes:capability.scopes,expiresAt:capability.expiresAt}; return out;
  }
  async issueCapability(actor:string,input:any){
    requireFields(input,['subject','versionId','scopes','expiresInSeconds']); const version=await this.mustVersion(input.versionId); if(version.owner!==actor)throw new DomainError('forbidden','Only the version owner can issue access',403);
    const allowed:Scope[]=['thesis.summary','positions.assets','positions.sizes','strategy.fork','execution.preview','execution.submit']; if(!Array.isArray(input.scopes)||input.scopes.some((s:string)=>!allowed.includes(s as Scope)))throw new DomainError('invalid_scope','Capability contains an unsupported scope');
    if(!Number.isInteger(input.expiresInSeconds)||input.expiresInSeconds<1||input.expiresInSeconds>86400)throw new DomainError('invalid_expiry','Capability lifetime must be between 1 and 86400 seconds');
    const capabilityId=id('cap'),token=this.tokenForCapability(capabilityId,input.subject,input.versionId);
    const cap:Capability={id:capabilityId,subject:input.subject,issuer:actor,versionId:input.versionId,scopes:input.scopes,expiresAt:new Date(this.now().getTime()+Math.min(input.expiresInSeconds,86400)*1000).toISOString(),status:'active',tokenHash:hash(token),priceMinor:input.priceMinor??100000,currency:'USDC',createdAt:this.now().toISOString()}; await this.repo.putCapability(cap); return {capability:{...cap,tokenHash:undefined},token};
  }
  async revoke(actor:string,capabilityId:string){ const cap=await this.repo.getCapability(capabilityId); if(!cap)throw new DomainError('not_found','Capability not found',404); if(cap.issuer!==actor)throw new DomainError('forbidden','Only the issuer can revoke access',403); cap.status='revoked';cap.revokedAt=this.now().toISOString();await this.repo.putCapability(cap);return {id:cap.id,status:cap.status,revokedAt:cap.revokedAt}; }
  async createOffer(actor:string,input:any){
    requireFields(input,['versionId','scopes','expiresInSeconds','priceMinor']); const version=await this.mustVersion(input.versionId); if(version.owner!==actor)throw new DomainError('forbidden','Only the version owner can create an offer',403);
    const allowed:Scope[]=['thesis.summary','positions.assets','positions.sizes','strategy.fork','execution.preview','execution.submit'];
    if(!Array.isArray(input.scopes)||input.scopes.length===0||input.scopes.some((s:string)=>!allowed.includes(s as Scope)))throw new DomainError('invalid_scope','Offer contains an unsupported scope');
    if(!Number.isInteger(input.expiresInSeconds)||input.expiresInSeconds<1||input.expiresInSeconds>86400)throw new DomainError('invalid_expiry','Offer lifetime must be between 1 and 86400 seconds');
    if(!Number.isSafeInteger(input.priceMinor)||input.priceMinor<1)throw new DomainError('invalid_price','Offer price must be a positive safe integer');
    const offer:AccessOffer={id:id('offer'),issuer:actor,versionId:version.id,scopes:[...new Set(input.scopes)] as Scope[],expiresInSeconds:input.expiresInSeconds,priceMinor:input.priceMinor,currency:'USDC',status:'active',createdAt:this.now().toISOString()};
    await this.repo.putOffer(offer); return offer;
  }
  async purchaseAccess(actor:string,input:any,idempotencyKey:string|undefined){
    requireFields(input,['offerId']); if(!idempotencyKey||idempotencyKey.length>128||!/^[A-Za-z0-9._:-]+$/.test(idempotencyKey))throw new DomainError('invalid_idempotency_key','A valid Idempotency-Key header is required');
    const existing=await this.repo.getPurchaseByIdempotency(actor,idempotencyKey); if(existing)return this.purchaseResult(existing);
    const offer=await this.repo.getOffer(input.offerId); if(!offer||offer.status!=='active')throw new DomainError('offer_unavailable','Access offer is unavailable',404); if(offer.issuer===actor)throw new DomainError('self_purchase','Creators cannot purchase their own offer');
    const settlement=await this.settlement.settle({idempotencyKey,buyer:actor,amountMinor:offer.priceMinor,currency:offer.currency});
    const capabilityId=id('cap'),token=this.tokenForCapability(capabilityId,actor,offer.versionId),createdAt=this.now().toISOString();
    const capability:Capability={id:capabilityId,subject:actor,issuer:offer.issuer,versionId:offer.versionId,scopes:offer.scopes,expiresAt:new Date(this.now().getTime()+offer.expiresInSeconds*1000).toISOString(),status:'active',tokenHash:hash(token),priceMinor:offer.priceMinor,currency:'USDC',createdAt};
    const purchase:AccessPurchase={id:id('purchase'),idempotencyKey,buyer:actor,offerId:offer.id,versionId:offer.versionId,issuer:offer.issuer,amountMinor:offer.priceMinor,currency:'USDC',status:'settled',settlementRef:settlement.reference,capabilityId,createdAt};
    const entries=await this.revenueEntries(purchase); await this.repo.settleAccessPurchase(purchase,capability,entries);
    const committed=await this.repo.getPurchaseByIdempotency(actor,idempotencyKey); return this.purchaseResult(committed??purchase);
  }
  async earnings(actor:string){const entries=await this.repo.listLedgerEntries(actor);return {account:actor,currency:'USDC',totalMinor:entries.reduce((sum,e)=>sum+e.amountMinor,0),entries};}
  async createFork(actor:string,input:any){
    requireFields(input,['parentVersionId','name','slug','changes','capabilityToken']); const parent=await this.mustVersion(input.parentVersionId); const cap=await this.validateCapability(actor,parent.id,input.capabilityToken); if(!cap.scopes.includes('strategy.fork'))throw new DomainError('missing_scope','Fork scope required',403);
    const strategyId=id('strat'),versionId=id('ver'); const child:StrategyVersion={...structuredClone(parent),...input.changes,id:versionId,strategyId,semver:'0.1.0',owner:actor,parentVersionId:parent.id,createdAt:this.now().toISOString(),manifestHash:''};child.manifestHash=hash(child);
    const strategy:Strategy={id:strategyId,slug:input.slug,name:input.name,owner:actor,latestVersionId:versionId,visibility:'public-metrics-private-content',royaltyBps:500}; const edge:ForkEdge={id:id('fork'),parentVersionId:parent.id,childVersionId:child.id,creator:actor,changedFields:Object.keys(input.changes),royaltyBps:500,createdAt:this.now().toISOString()}; await this.repo.putStrategy(strategy);await this.repo.putVersion(child);await this.repo.putFork(edge);return {strategy,version:publicVersion(child),edge};
  }
  evaluatePolicy(proposal:ExecutionProposal,policy:FollowerPolicy):PolicyDecision{
    const violations:string[]=[],clamps:string[]=[]; const disallowed=proposal.assets.filter(a=>!policy.allowedAssets.includes(a)); if(disallowed.length)violations.push(`assets_not_allowed:${disallowed.join(',')}`); if(proposal.slippageBps>policy.maxSlippageBps)violations.push('slippage_exceeds_limit'); if(proposal.leverageBps>policy.maxLeverageBps)violations.push('leverage_exceeds_limit'); const effective=Math.min(proposal.requestedAllocationBps,policy.maxAllocationBps); if(effective<proposal.requestedAllocationBps)clamps.push(`allocation:${proposal.requestedAllocationBps}->${effective}`); const decision={allowed:violations.length===0,requiresConfirmation:proposal.notionalMinor>policy.manualConfirmationAboveMinor,effectiveAllocationBps:effective,violations,clamps,policyHash:''};decision.policyHash=hash({proposal,policy,effective});return decision;
  }
  async previewExecution(actor:string,input:any){
    requireFields(input,['proposal','policy']); const version=await this.mustVersion(input.proposal.versionId);
    await this.authorizeExecution(actor,version,input.capabilityToken,'execution.preview');
    return this.evaluatePolicy(input.proposal,input.policy);
  }
  async execute(actor:string,input:any){
    requireFields(input,['proposal','policy']); const version=await this.mustVersion(input.proposal.versionId);
    await this.authorizeExecution(actor,version,input.capabilityToken,'execution.submit');
    const decision=this.evaluatePolicy(input.proposal,input.policy); if(!decision.allowed)throw new DomainError('policy_rejected',decision.violations.join('; '),422);
    if(decision.requiresConfirmation&&input.confirmedPolicyHash!==decision.policyHash)throw new DomainError('confirmation_required','Manual confirmation is required for this policy decision',409);
    const receipt=await this.execution.submit(actor,version,input.proposal,decision);await this.repo.putExecution(receipt);return {decision,receipt};
  }
  async lineage(strategyId:string){ const strategy=await this.repo.getStrategy(strategyId);if(!strategy)throw new DomainError('not_found','Strategy not found',404);return {strategyId,nodes:[{versionId:strategy.latestVersionId,owner:strategy.owner,name:strategy.name}],edges:await this.repo.listForks(strategyId)}; }
  private async mustVersion(id:string){const v=await this.repo.getVersion(id);if(!v)throw new DomainError('not_found','Strategy version not found',404);return v;}
  private async authorizeExecution(actor:string,version:StrategyVersion,token:string|undefined,scope:'execution.preview'|'execution.submit'){
    if(actor===version.owner)return;
    if(!token)throw new DomainError('capability_required',`${scope} capability required`,403);
    const capability=await this.validateCapability(actor,version.id,token); if(!capability.scopes.includes(scope))throw new DomainError('missing_scope',`${scope} scope required`,403);
  }
  private tokenForCapability(capabilityId:string,subject:string,versionId:string){const payload=Buffer.from(JSON.stringify({id:capabilityId,sub:subject,ver:versionId})).toString('base64url');return signToken(payload,this.secret);}
  private async purchaseResult(purchase:AccessPurchase){const capability=await this.repo.getCapability(purchase.capabilityId);if(!capability)throw new DomainError('incomplete_purchase','Settled purchase is missing its capability',500);return {purchase,capability:{...capability,tokenHash:undefined},token:this.tokenForCapability(capability.id,capability.subject,capability.versionId)};}
  private async revenueEntries(purchase:AccessPurchase){
    const entries:LedgerEntry[]=[],edge=await this.repo.getForkByChildVersion(purchase.versionId); let royalty=0;
    if(edge){const parent=await this.mustVersion(edge.parentVersionId);if(parent.owner!==purchase.issuer)royalty=Math.floor(purchase.amountMinor*edge.royaltyBps/10000);if(royalty>0)entries.push({id:id('ledger'),purchaseId:purchase.id,account:parent.owner,kind:'upstream_royalty',amountMinor:royalty,currency:'USDC',createdAt:purchase.createdAt});}
    entries.push({id:id('ledger'),purchaseId:purchase.id,account:purchase.issuer,kind:'creator_revenue',amountMinor:purchase.amountMinor-royalty,currency:'USDC',createdAt:purchase.createdAt}); return entries;
  }
  private async validateCapability(actor:string,versionId:string,token:string){const raw=verifyToken(token,this.secret);if(!raw)throw new DomainError('invalid_capability','Capability signature is invalid',401);let payload:any;try{payload=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('invalid_capability','Capability payload is invalid',401)} const cap=await this.repo.getCapability(payload.id);if(!cap||cap.tokenHash!==hash(token))throw new DomainError('invalid_capability','Capability is unknown',401);if(cap.subject!==actor)throw new DomainError('wrong_subject','Capability belongs to another account',403);if(cap.versionId!==versionId)throw new DomainError('wrong_resource','Capability does not cover this version',403);if(cap.status==='revoked')throw new DomainError('revoked','Capability was revoked',403);if(new Date(cap.expiresAt)<=this.now())throw new DomainError('expired','Capability expired',403);return cap;}
}
function requireFields(value:any,fields:string[]){if(!value||typeof value!=='object')throw new DomainError('invalid_body','JSON object required');const missing=fields.filter(f=>value[f]===undefined);if(missing.length)throw new DomainError('missing_fields',`Missing: ${missing.join(', ')}`);}
