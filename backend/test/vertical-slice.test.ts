import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRepository } from '../src/repository.ts';
import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { ScionService } from '../src/service.ts';
import { signToken } from '../src/crypto.ts';

test('Scion usernames are unique regardless of letter case',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');await service.saveProfile('one.near',{displayName:'One',handle:'Alpha_User',bio:'',avatarUrl:'https://example.com/avatar.webp'});await assert.rejects(()=>service.saveProfile('two.near',{displayName:'Two',handle:'alpha_user',bio:''}),/already taken/i);assert.equal((await service.profile('one.near'))?.handle,'alpha_user');});

test('device sessions revoke fail closed',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');const id=await service.ensureSession('one.near','signed-session-token','Edge');assert.equal((await service.sessions('one.near','signed-session-token'))[0].current,true);await service.revokeSession('one.near',id);await assert.rejects(()=>service.ensureSession('one.near','signed-session-token','Edge'),/revoked/i);});

test('blocking hides creators and reports create private audit events',async()=>{const repo=new MemoryRepository(),service=new ScionService(repo,new SimulatedNearIntentsAdapter(),'test-secret');await service.seed();await service.saveProfile('viewer.near',{displayName:'Viewer',handle:'viewer',bio:''});assert.equal((await service.feed('viewer.near')).some(item=>item.strategy.owner==='alice.near'),true);await service.toggleBlock('viewer.near','alice.near');assert.equal((await service.feed('viewer.near')).some(item=>item.strategy.owner==='alice.near'),false);await service.report('viewer.near',{targetType:'profile',targetId:'alice.near',reason:'Misleading performance claims'});assert.equal((await service.auditLog('viewer.near')).some(event=>event.event==='report.created'),true);});

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
  const receipt=await service.recordLiveExecution('alice.near',{strategyId:result.strategy.id,txHash:'5N8wCzYzJwFu9M7EDqQJZV7mGQ4jX8nReAL12345',status:'SUCCESS',depositAddress:'deposit.near'});
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
  assert.equal(bob.totalMinor,95000); assert.equal(alice.totalMinor,5000);
  assert.equal(bob.entries[0].kind,'creator_revenue'); assert.equal(alice.entries[0].kind,'upstream_royalty');
  const scoped:any=await service.readVersion('carol.near',fork.strategy.latestVersionId,first.token);
  assert.equal(scoped.thesis.summary.length>0,true);
});
