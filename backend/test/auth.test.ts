import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { MemoryAuthStore, WalletAuthService } from '../src/auth.ts';

test('NEAR ed25519 challenge produces a subject-bound session',async()=>{
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const raw=publicKey.export({format:'der',type:'spki'}).subarray(-32);
  const nearKey=`ed25519:${base58Encode(raw)}`;
  const auth=new WalletAuthService(new MemoryAuthStore(),'session-secret',()=>new Date('2026-11-06T12:00:00Z'));
  const challenge=await auth.challenge('bob.near',nearKey);
  const signature=sign(null,Buffer.from(challenge.message),privateKey).toString('base64');
  const session=await auth.verify(challenge.id,signature);
  assert.equal(auth.actorFromToken(session.token),'bob.near');
  await assert.rejects(()=>auth.verify(challenge.id,signature),/already used/i);
});

test('invalid wallet signature fails closed',async()=>{
  const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
  const nearKey=`ed25519:${base58Encode(a.publicKey.export({format:'der',type:'spki'}).subarray(-32))}`;
  const auth=new WalletAuthService(new MemoryAuthStore(),'session-secret');
  const challenge=await auth.challenge('alice.near',nearKey);
  const signature=sign(null,Buffer.from(challenge.message),b.privateKey).toString('base64');
  await assert.rejects(()=>auth.verify(challenge.id,signature),/invalid/i);
});

function base58Encode(bytes:Uint8Array){const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let value=0n;for(const byte of bytes)value=value*256n+BigInt(byte);let out='';while(value){out=alphabet[Number(value%58n)]+out;value/=58n;}for(const byte of bytes){if(byte!==0)break;out='1'+out;}return out||'1';}
