import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresRepository } from '../src/postgres-repository.ts';

test('Postgres repository only queries the private schema with parameters',async()=>{
  const calls:{text:string;values?:unknown[]}[]=[];
  const db={query:async(text:string,values?:unknown[])=>{calls.push({text,values});return {rows:[]};}};
  const repo=new PostgresRepository(db);
  await repo.putStrategy({id:'s1',slug:'quiet-delta',name:'Quiet Delta',owner:'alice.near',latestVersionId:'v1',visibility:'public-metrics-private-content',royaltyBps:500});
  await repo.getStrategy('s1');
  assert.equal(calls.length,2);
  assert.ok(calls.every(call=>call.text.includes('scion_private.strategies')));
  assert.ok(calls.every(call=>!call.text.includes('alice.near')));
  assert.equal(calls[1].values?.[0],'s1');
});

test('purchase, capability, and royalty ledger commit in one transaction',async()=>{
  const calls:{text:string;values?:unknown[]}[]=[];
  const client={query:async(text:string,values?:unknown[])=>{calls.push({text,values});return {rows:text.includes('RETURNING id')?[{id:'p1'}]:[]};},release:()=>{calls.push({text:'RELEASE'});}};
  const db={query:client.query,connect:async()=>client}; const repo=new PostgresRepository(db);
  await repo.settleAccessPurchase(
    {id:'p1',idempotencyKey:'key-1',buyer:'carol.near',offerId:'o1',versionId:'v1',issuer:'bob.near',amountMinor:100000,currency:'USDC',status:'settled',settlementRef:'sim_1',capabilityId:'c1',createdAt:'2026-11-06T12:00:00.000Z'},
    {id:'c1',subject:'carol.near',issuer:'bob.near',versionId:'v1',scopes:['thesis.summary'],expiresAt:'2026-11-06T13:00:00.000Z',status:'active',tokenHash:'hash',priceMinor:100000,currency:'USDC',createdAt:'2026-11-06T12:00:00.000Z'},
    [{id:'l1',purchaseId:'p1',account:'bob.near',kind:'creator_revenue',amountMinor:95000,currency:'USDC',createdAt:'2026-11-06T12:00:00.000Z'}]
  );
  assert.equal(calls[0].text,'BEGIN'); assert.equal(calls.at(-2)?.text,'COMMIT'); assert.equal(calls.at(-1)?.text,'RELEASE');
  assert.ok(calls.slice(1,-2).every(call=>call.text.includes('scion_private.')));
  assert.ok(calls.some(call=>call.text.includes('access_purchases')&&call.text.includes('ON CONFLICT')));
});
