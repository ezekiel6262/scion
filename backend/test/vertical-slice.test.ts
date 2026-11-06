import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRepository } from '../src/repository.ts';
import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { VeilbranchService } from '../src/service.ts';

test('Alice grants access, Bob forks and executes, then access is revoked', async () => {
  const repo = new MemoryRepository();
  const service = new VeilbranchService(repo, new SimulatedNearIntentsAdapter(), 'test-secret', () => new Date('2026-11-06T12:00:00Z'));
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
  const service = new VeilbranchService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), 'test');
  const decision = service.evaluatePolicy({versionId:'v',requestedAllocationBps:1000,slippageBps:80,leverageBps:10000,assets:['BTC'],notionalMinor:100},{maxAllocationBps:800,maxSlippageBps:30,allowedAssets:['USDC'],maxLeverageBps:10000,dailyLossLimitBps:200,manualConfirmationAboveMinor:25000});
  assert.equal(decision.allowed, false); assert.deepEqual(decision.violations, ['assets_not_allowed:BTC','slippage_exceeds_limit']); assert.equal(decision.effectiveAllocationBps, 800);
});
