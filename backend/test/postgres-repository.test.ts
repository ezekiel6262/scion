import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresRepository } from '../src/postgres-repository.ts';

test('Supabase repository only queries the private schema with parameters',async()=>{
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
