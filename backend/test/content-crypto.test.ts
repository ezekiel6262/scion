import test from 'node:test';
import assert from 'node:assert/strict';
import { StrategyContentCipher } from '../src/content-crypto.ts';

const version={id:'ver_secret',strategyId:'strat_secret',semver:'1.0.0',owner:'alice.near',thesis:{summary:'private alpha',evidence:['private dataset']},positions:[{asset:'NEAR',chain:'near',targetWeightBps:10000}],rules:{maxSlippageBps:50,entry:'private entry',exit:'private exit'},risk:{maxDrawdownBps:1000,leverageBps:10000},horizonDays:30,manifestHash:'hash',createdAt:'2026-11-09T12:00:00.000Z'};

test('production strategy payloads are AES-GCM ciphertext with resource-bound authentication',()=>{const cipher=new StrategyContentCipher('a-production-shaped-secret-with-more-than-thirty-two-characters'),sealed=cipher.seal(version);assert.equal(JSON.stringify(sealed).includes('private alpha'),false);assert.deepEqual(cipher.open(sealed,version.id),version);assert.throws(()=>cipher.open(sealed,'another-version'));});
