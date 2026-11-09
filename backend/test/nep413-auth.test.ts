import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Nep413AuthService, serializeNep413Message } from '../src/nep413-auth.ts';

test('an unfunded implicit NEAR account can prove ownership off-chain',async()=>{
  const now=()=>new Date('2026-11-09T12:00:00Z'),auth=new Nep413AuthService('session-secret','scionhub.xyz',now),pair=generateKeyPairSync('ed25519'),raw=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32),accountId=raw.toString('hex'),publicKey=`ed25519:${base58Encode(raw)}`,challenge=auth.challenge(),payload={message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signature=sign(null,serializeNep413Message(payload),pair.privateKey).toString('base64');
  const session=await auth.verify(challenge.challengeId,accountId,publicKey,signature);
  assert.equal(session.accountId,accountId);
});

test('implicit authentication fails when the account is not derived from the key',async()=>{
  const now=()=>new Date('2026-11-09T12:00:00Z'),auth=new Nep413AuthService('session-secret','scionhub.xyz',now),pair=generateKeyPairSync('ed25519'),raw=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32),publicKey=`ed25519:${base58Encode(raw)}`,challenge=auth.challenge(),payload={message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signature=sign(null,serializeNep413Message(payload),pair.privateKey).toString('base64');
  await assert.rejects(()=>auth.verify(challenge.challengeId,'0'.repeat(64),publicKey,signature),/invalid/i);
});

function base58Encode(bytes:Uint8Array){const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let value=0n;for(const byte of bytes)value=value*256n+BigInt(byte);let out='';while(value){out=alphabet[Number(value%58n)]+out;value/=58n;}for(const byte of bytes){if(byte!==0)break;out='1'+out;}return out||'1';}
