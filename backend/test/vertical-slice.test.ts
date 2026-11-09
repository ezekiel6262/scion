import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRepository } from '../src/repository.ts';
import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { ScionService } from '../src/service.ts';
import { signToken } from '../src/crypto.ts';

test('Scion usernames are unique regardless of letter case',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');await service.saveProfile('one.near',{displayName:'One',handle:'Alpha_User',bio:'',avatarUrl:'https://example.com/avatar.webp'});await assert.rejects(()=>service.saveProfile('two.near',{displayName:'Two',handle:'alpha_user',bio:''}),/already taken/i);assert.equal((await service.profile('one.near'))?.handle,'alpha_user');});

test('device sessions revoke fail closed',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');const id=await service.ensureSession('one.near','signed-session-token','Edge');assert.equal((await service.sessions('one.near','signed-session-token'))[0].current,true);await service.revokeSession('one.near',id);await assert.rejects(()=>service.ensureSession('one.near','signed-session-token','Edge'),/revoked/i);});

test('blocking hides creators and reports create private audit events',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');await service.seed();await service.saveProfile('viewer.near',{displayName:'Viewer',handle:'viewer',bio:''});assert.equal((await service.feed('viewer.near')).some(item=>item.strategy.owner==='alice.near'),true);await service.toggleBlock('viewer.near','alice.near');assert.equal((await service.feed('viewer.near')).some(item=>item.strategy.owner==='alice.near'),false);await service.report('viewer.near',{targetType:'profile',targetId:'alice.near',reason:'Misleading performance claims'});assert.equal((await service.auditLog('viewer.near')).some(event=>event.event==='report.created'),true);});

test('moderation queue is restricted and records resolution',async()=>{const service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),'test-secret',undefined,undefined,false,true,undefined,['admin.near']);const report=await service.report('viewer.near',{targetType:'profile',targetId:'bad.near',reason:'Repeated impersonation'});await assert.rejects(()=>service.moderationQueue('viewer.near'),/moderator/i);assert.equal((await service.moderationQueue('admin.near')).length,1);assert.equal((await service.resolveReport('admin.near',report.id,{status:'resolved',note:'Account reviewed'})).status,'resolved');});

test('user-owned agents enforce mode, policy, approval, and revocation boundaries',async()=>{const service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),'test-secret');await service.saveProfile('owner.near',{displayName:'Owner',handle:'owner',bio:''});const research:any=await service.createAgent('owner.near',{name:'Macro Scout',handle:'macro-scout',description:'Research only',mode:'research',policy:{allowedAssets:['NEAR','USDC'],maxTradeMinor:5000000,dailyLimitMinor:10000000,maxAllocationBps:2000,maxSlippageBps:100,maxLeverageBps:10000}});assert.equal(research.owner,'owner.near');await assert.rejects(()=>service.createAgentProposal('owner.near',research.id,{action:'trade',thesis:'NEAR momentum improved',rationale:'Breakout confirmed',asset:'NEAR',side:'buy',notionalMinor:1000000,confidence:75}),/research agents/i);const proposalAgent:any=await service.createAgent('owner.near',{name:'Proposal Bot',handle:'proposal-bot',mode:'proposal',executionAccount:'proposal-bot.near',policy:{allowedAssets:['NEAR'],maxTradeMinor:2000000,dailyLimitMinor:5000000,maxAllocationBps:1000,maxSlippageBps:50,maxLeverageBps:10000}});await assert.rejects(()=>service.createAgentProposal('owner.near',proposalAgent.id,{action:'trade',thesis:'Buy BTC',rationale:'Not allowed',asset:'BTC',side:'buy',notionalMinor:1000000,confidence:70}),/outside/i);const proposal:any=await service.createAgentProposal('owner.near',proposalAgent.id,{action:'trade',thesis:'Buy NEAR',rationale:'Within owner limits',asset:'NEAR',side:'buy',notionalMinor:1000000,confidence:70});assert.equal(proposal.status,'awaiting_owner');assert.equal((await service.decideAgentProposal('owner.near',proposal.id,'approve')).executionState,'wallet_confirmation_required');await service.setAgentStatus('owner.near',proposalAgent.id,'revoked');await assert.rejects(()=>service.setAgentStatus('owner.near',proposalAgent.id,'active'),/revoked/i);});

test('bounded agents remain paused until execution authority exists',async()=>{const service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),'test-secret');await service.saveProfile('owner.near',{displayName:'Owner',handle:'owner',bio:''});const agent:any=await service.createAgent('owner.near',{name:'Bounded Bot',handle:'bounded-bot',mode:'bounded',executionAccount:'bounded-bot.near',policy:{allowedAssets:['NEAR'],maxTradeMinor:1000000,dailyLimitMinor:2000000,maxAllocationBps:500,maxSlippageBps:30,maxLeverageBps:10000}});assert.equal(agent.status,'paused');await assert.rejects(()=>service.setAgentStatus('owner.near',agent.id,'active'),/execution key/i);});

test('model cycles remain policy checked and preserve runtime receipts',async()=>{const service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),'test-secret');await service.saveProfile('owner.near',{displayName:'Owner',handle:'owner',bio:''});const agent:any=await service.createAgent('owner.near',{name:'Model Scout',handle:'model-scout',mode:'proposal',policy:{allowedAssets:['NEAR'],maxTradeMinor:1000000,dailyLimitMinor:2000000,maxAllocationBps:500,maxSlippageBps:30,maxLeverageBps:10000}});await assert.rejects(()=>service.createAutomatedAgentProposal(agent.id,{action:'trade',thesis:'Buy BTC after breakout',rationale:'Model output outside policy',asset:'BTC',side:'buy',notionalMinor:500000,confidence:80},{id:'run-bad',model:'test'}),/outside/i);const value:any=await service.createAutomatedAgentProposal(agent.id,{action:'trade',thesis:'NEAR momentum remains constructive',rationale:'Price and usage inputs support a small policy-bounded proposal',asset:'NEAR',side:'buy',notionalMinor:500000,confidence:72},{id:'run-good',model:'bedrock-test',inputTokens:100,outputTokens:50,latencyMs:250});assert.equal(value.source,'model');assert.equal(value.status,'awaiting_owner');assert.equal(value.run.model,'bedrock-test');assert.equal(value.executionState,'not_authorized');});

test('demo network is populated and unmistakably labeled',async()=>{const service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),'test-secret');await service.seed();const feed=await service.feed(),agents:any[]=await service.agents();assert.ok(feed.filter(value=>value.demo).length>=6);assert.ok(agents.filter(value=>value.demo).length>=6);assert.ok(agents.filter(value=>value.demo).every(value=>value.automationReady===false));const detail:any=await service.agentDetail('demo_agent_flow');assert.ok(detail.proposals.every((value:any)=>value.demo===true));});

test('verified swaps persist privately and idempotently',async()=>{const secret='test-secret',now=()=>new Date('2026-11-08T12:00:00Z'),service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),secret,now),txHash='swapTx123',depositAddress='deposit.near',amountIn='100000000000000000000000';const proof=signToken(Buffer.from(JSON.stringify({kind:'near-intents-execution',sub:'trader.near',txHash,depositAddress,amountIn,originContract:'wrap.near',settledAt:now().toISOString(),exp:'2026-11-08T12:10:00Z'})).toString('base64url'),secret),input={txHash,depositAddress,amountIn,amountOut:'1234567',originAsset:'nep141:wrap.near',destinationAsset:'nep141:usdc.near',originSymbol:'NEAR',destinationSymbol:'USDC',amountInFormatted:'0.1',amountOutFormatted:'1.234567',verificationProof:proof},original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({status:'SUCCESS',quoteResponse:{quoteRequest:{originAsset:input.originAsset,destinationAsset:input.destinationAsset},quote:{amountIn,amountOut:input.amountOut}}})}) as Response;try{const first:any=await service.recordSwap('trader.near',input),second:any=await service.recordSwap('trader.near',input),history:any[]=await service.swaps('trader.near');assert.equal(first.id,second.id);assert.equal(history.length,1);assert.equal(history[0].verified,true);assert.equal((await service.swaps('other.near')).length,0);}finally{globalThis.fetch=original;}});

test('beta invites are single-use and production checkout fails closed',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret',undefined,undefined,true,false);await service.seed();const {code}=await service.createInvite('alice.near');await service.saveProfile('new.near',{displayName:'New',handle:'new_user',bio:'',inviteCode:code});await assert.rejects(()=>service.saveProfile('other.near',{displayName:'Other',handle:'other_user',bio:'',inviteCode:code}),/already used|invalid/i);await assert.rejects(()=>service.purchaseAccess('new.near',{offerId:'missing'},'purchase-key'),/disabled/i);});

test('Alice grants access, Bob forks and executes, then access is revoked', async () => {
  const repo = new MemoryRepository();
  const service = new ScionService(repo, new SimulatedNearIntentsAdapter(), 'test-secret', () => new Date('2026-11-06T12:00:00Z'));
  await service.seed();
  const publicView: any = await service.readVersion(undefined, 'ver_quiet_delta_130');
  assert.equal(publicView.thesis, undefined); assert.equal(publicView.positions, undefined);
  const issued: any = await service.issueCapability('alice.near', { subject:'bob.near', versionId:'ver_quiet_delta_130', scopes:['thesis.summary','positions.assets','strategy.fork'], expiresInSeconds:900, priceMinor:100000 });
  const scoped: any = await service.readVersion('bob.near', 'ver_quiet_delta_130', issued.token);
  assert.equal(scoped.positions[0].asset, 'USDC'); assert.equal(scoped.positions[0].targetWeightBps, undefined);
  const fork: any = await service.createFork('bob.near', { parentVersionId:'ver_quiet_delta_130', name:'Conservative Delta', slug:'conservative-delta', capabilityToken:issued.token, changes:{risk:{maxDrawdownBps:400,leverageBps:10000}} });
  assert.equal(fork.edge.parentVersionId, 'ver_quiet_delta_130');
  const result: any = await service.execute('bob.near', { proposal:{versionId:fork.strategy.latestVersionId,requestedAllocationBps:2000,slippageBps:25,leverageBps:10000,assets:['USDC','USDT'],notionalMinor:20000}, policy:{maxAllocationBps:800,maxSlippageBps:30,allowedAssets:['USDC','USDT'],maxLeverageBps:10000,dailyLossLimitBps:200,manualConfirmationAboveMinor:25000} });
  assert.equal(result.decision.effectiveAllocationBps, 800); assert.equal(result.receipt.status, 'simulated-settled');
  await service.revoke('alice.near', issued.capability.id);
  await assert.rejects(() => service.readVersion('bob.near', 'ver_quiet_delta_130', issued.token), /revoked/i);
});

test('policy engine rejects disallowed assets and excessive slippage', () => {
  const service = new ScionService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), 'test');
  const decision = service.evaluatePolicy({versionId:'v',requestedAllocationBps:1000,slippageBps:80,leverageBps:10000,assets:['BTC'],notionalMinor:100},{maxAllocationBps:800,maxSlippageBps:30,allowedAssets:['USDC'],maxLeverageBps:10000,dailyLossLimitBps:200,manualConfirmationAboveMinor:25000});
  assert.equal(decision.allowed, false); assert.deepEqual(decision.violations, ['assets_not_allowed:BTC','slippage_exceeds_limit']); assert.equal(decision.effectiveAllocationBps, 800);
});

test('execution capabilities and manual confirmation fail closed', async () => {
  const repo = new MemoryRepository();
  const service = new ScionService(repo, new SimulatedNearIntentsAdapter(), 'test-secret', () => new Date('2026-11-06T12:00:00Z'));
  await service.seed();
  const proposal={versionId:'ver_quiet_delta_130',requestedAllocationBps:500,slippageBps:20,leverageBps:10000,assets:['USDC'],notionalMinor:50000};
  const policy={maxAllocationBps:800,maxSlippageBps:30,allowedAssets:['USDC'],maxLeverageBps:10000,dailyLossLimitBps:200,manualConfirmationAboveMinor:25000};
  await assert.rejects(() => service.previewExecution('bob.near',{proposal,policy}), /capability required/i);
  const issued:any=await service.issueCapability('alice.near',{subject:'bob.near',versionId:'ver_quiet_delta_130',scopes:['execution.preview','execution.submit'],expiresInSeconds:900});
  const decision=await service.previewExecution('bob.near',{proposal,policy,capabilityToken:issued.token});
  assert.equal(decision.requiresConfirmation,true);
  await assert.rejects(() => service.execute('bob.near',{proposal,policy,capabilityToken:issued.token}), /manual confirmation/i);
  const result=await service.execute('bob.near',{proposal,policy,capabilityToken:issued.token,confirmedPolicyHash:decision.policyHash});
  assert.equal(result.receipt.status,'simulated-settled');
});

test('capability expiry must be positive and bounded', async () => {
  const service = new ScionService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), 'test-secret');
  await service.seed();
  await assert.rejects(() => service.issueCapability('alice.near',{subject:'bob.near',versionId:'ver_quiet_delta_130',scopes:['thesis.summary'],expiresInSeconds:0}), /lifetime/i);
  await assert.rejects(() => service.issueCapability('alice.near',{subject:'bob.near',versionId:'ver_quiet_delta_130',scopes:['thesis.summary'],expiresInSeconds:86401}), /lifetime/i);
});

test('strategy publishing is bounded by a fresh server-signed holdings proof', async () => {
  const now=()=>new Date('2026-11-06T12:00:00Z'),secret='test-secret',service=new ScionService(new MemoryRepository(),new SimulatedNearIntentsAdapter(),secret,now);
  const base={name:'Real NEAR',slug:'real-near',thesis:{summary:'A real wallet-backed NEAR thesis.',evidence:[]},positions:[{asset:'NEAR',chain:'near',targetWeightBps:10000,observedRaw:'500',observedUnits:'0.0000000000000000000005'}],rules:{maxSlippageBps:50,entry:'manual',exit:'manual'},risk:{maxDrawdownBps:1000,leverageBps:10000},horizonDays:90,royaltyBps:500};
  await assert.rejects(()=>service.createStrategy('alice.near',base),/balances|proof/i);
  const payload=Buffer.from(JSON.stringify({sub:'alice.near',observedAt:now().toISOString(),exp:'2026-11-06T12:05:00Z',holdings:[{asset:'NEAR',raw:'1000'}]})).toString('base64url');
  const result=await service.createStrategy('alice.near',{...base,holdingsProof:signToken(payload,secret)});
  assert.equal(result.strategy.owner,'alice.near');
  const updated=await service.updateStrategy('alice.near',result.strategy.id,{name:'Real NEAR v2',visibility:'public'});
  assert.equal(updated.version.semver,'1.0.1');assert.equal(updated.strategy.visibility,'public');
  const txHash='5N8wCzYzJwFu9M7EDqQJZV7mGQ4jX8nReAL12345',depositAddress='deposit.near',amountIn='1000';
  const executionPayload=Buffer.from(JSON.stringify({kind:'near-intents-execution',sub:'alice.near',txHash,depositAddress,amountIn,settledAt:now().toISOString(),exp:'2026-11-06T12:10:00Z'})).toString('base64url');
  const receipt=await service.recordLiveExecution('alice.near',{strategyId:result.strategy.id,txHash,status:'SUCCESS',depositAddress,amountIn,verificationProof:signToken(executionPayload,secret)});
  assert.equal(receipt.mode,'live');assert.equal(receipt.status,'settled');
  const detail:any=await service.strategyDetail(undefined,result.strategy.id);assert.equal(detail.version.thesis.summary,base.thesis.summary);assert.equal(detail.executions.length,1);assert.equal(detail.versions.length,2);
  await assert.rejects(()=>service.createStrategy('bob.near',{...base,holdingsProof:signToken(payload,secret)}),/another account/i);
  await assert.rejects(()=>service.createStrategy('alice.near',{...base,positions:[{...base.positions[0],observedRaw:'1001'}],holdingsProof:signToken(payload,secret)}),/do not cover/i);
});

test('paid access is idempotent and splits fork royalties', async () => {
  const repo = new MemoryRepository();
  const service = new ScionService(repo, new SimulatedNearIntentsAdapter(), 'test-secret', () => new Date('2026-11-06T12:00:00Z'));
  await service.seed();
  const forkGrant:any=await service.issueCapability('alice.near',{subject:'bob.near',versionId:'ver_quiet_delta_130',scopes:['strategy.fork'],expiresInSeconds:900});
  const fork:any=await service.createFork('bob.near',{parentVersionId:'ver_quiet_delta_130',name:'Conservative Delta',slug:'conservative-delta-paid',capabilityToken:forkGrant.token,changes:{risk:{maxDrawdownBps:400,leverageBps:10000}}});
  const offer=await service.createOffer('bob.near',{versionId:fork.strategy.latestVersionId,scopes:['thesis.summary','execution.preview'],expiresInSeconds:3600,priceMinor:100000});
  const first:any=await service.purchaseAccess('carol.near',{offerId:offer.id},'purchase-001');
  const replay:any=await service.purchaseAccess('carol.near',{offerId:offer.id},'purchase-001');
  assert.equal(replay.purchase.id,first.purchase.id); assert.equal(replay.token,first.token); assert.equal(repo.purchases.size,1);
  const bob=await service.earnings('bob.near'),alice=await service.earnings('alice.near');
  assert.equal(bob.totalMinor,85000); assert.equal(alice.totalMinor,5000);assert.equal((await service.earnings('scion.protocol')).totalMinor,10000);
  assert.equal(bob.entries[0].kind,'creator_revenue'); assert.equal(alice.entries[0].kind,'upstream_royalty');
  const scoped:any=await service.readVersion('carol.near',fork.strategy.latestVersionId,first.token);
  assert.equal(scoped.thesis.summary.length>0,true);
});

test('bounded agents isolate keys, enforce daily limits, and persist live receipts',async()=>{
  const repo=new MemoryRepository(),now=()=>new Date('2026-11-09T12:00:00Z'),executor={
    async prepare(agentId:string){return {publicKey:'secp256k1:agent-public-key',envelope:`kms:${agentId}:ciphertext`,keyId:'kms-test',preparedAt:now().toISOString()};},
    async execute(){return {txHash:'agent-live-tx',depositAddress:'solver.near',originAsset:'nep141:usdc.near',destinationAsset:'nep141:wrap.near',amountIn:'1000000',amountOut:'200000000000000000000000',status:'SUCCESS' as const,settledAt:now().toISOString()};}
  },service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret',now,undefined,false,true,undefined,[],executor);
  await service.saveProfile('owner.near',{displayName:'Owner',handle:'owner',bio:''});
  const created:any=await service.createAgent('owner.near',{name:'Bounded buyer',handle:'bounded-buyer',mode:'bounded',visibility:'public',policy:{allowedAssets:['NEAR'],maxTradeMinor:1_000_000,dailyLimitMinor:1_000_000,maxAllocationBps:1000,maxSlippageBps:100,maxLeverageBps:10000}}),authority=await service.prepareAgentAuthority('owner.near',created.id),stored=(await repo.getProductObject(created.id))!;
  assert.equal(authority.publicKey,'secp256k1:agent-public-key');assert.equal((await service.agentDetail(created.id)).authority,undefined);
  stored.payload={...stored.payload,executionAccount:'bounded-buyer.owner.near',earningsAccount:'bounded-buyer.owner.near',accountStatus:'active',automationReady:true};await repo.putProductObject(stored);await service.setAgentStatus('owner.near',created.id,'active');
  const proposal:any=await service.createAutomatedAgentProposal(created.id,{action:'trade',thesis:'Buy only after the verified signal and remain inside the one USDC daily policy.','rationale':'The current market snapshot meets the owner-defined entry rule.',asset:'NEAR',side:'buy',notionalMinor:1_000_000,confidence:70},{id:'run1',model:'test',inputTokens:1,outputTokens:1,latencyMs:1});
  assert.equal(proposal.executionState,'queued');const settled:any=await service.executeAutomatedAgentProposal(created.id,proposal.id);assert.equal(settled.executionState,'settled');assert.equal(settled.executionReceiptId,'agent-live-tx');
  const second:any=await service.createAutomatedAgentProposal(created.id,{action:'trade',thesis:'A second valid signal still cannot bypass the owner daily spending ceiling.','rationale':'Policy accounting must reject cumulative spending above the daily limit.',asset:'NEAR',side:'buy',notionalMinor:1,confidence:70},{id:'run2',model:'test',inputTokens:1,outputTokens:1,latencyMs:1});
  await assert.rejects(()=>service.executeAutomatedAgentProposal(created.id,second.id),/daily limit/i);
});
