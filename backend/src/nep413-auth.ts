import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { JsonRpcProvider } from 'near-api-js';
import { verifyMessage } from 'near-api-js/nep413';
import { DomainError } from './domain.ts';
import { id, signToken, verifyToken } from './crypto.ts';

type Challenge = { jti:string; message:string; nonce:string; recipient:string; exp:string };

export class Nep413AuthService {
  private provider: JsonRpcProvider;
  private secret:string;private recipient:string;private now:()=>Date;
  constructor(secret:string,recipient:string,now=()=>new Date(),rpcUrl='https://rpc.mainnet.fastnear.com') { this.secret=secret;this.recipient=recipient;this.now=now;this.provider=new JsonRpcProvider({url:rpcUrl}); }
  challenge(){
    const expiresAt=new Date(this.now().getTime()+120000).toISOString();
    const value:Challenge={jti:id('near'),message:`Sign in to Scion\nExpires: ${expiresAt}`,nonce:randomBytes(32).toString('base64'),recipient:this.recipient,exp:expiresAt};
    const challengeId=signToken(Buffer.from(JSON.stringify(value)).toString('base64url'),this.secret);
    return {challengeId,message:value.message,nonce:value.nonce,recipient:value.recipient,expiresAt};
  }
  async verify(challengeId:string,accountId:string,publicKey:string,signature:string){
    const raw=verifyToken(challengeId,this.secret);if(!raw)throw new DomainError('invalid_challenge','Authentication challenge is invalid',401);
    let challenge:Challenge;try{challenge=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('invalid_challenge','Authentication challenge is malformed',401)}
    if(new Date(challenge.exp)<=this.now())throw new DomainError('challenge_expired','Authentication challenge expired',401);
    if(!/^[a-z0-9._-]{2,64}$/i.test(accountId))throw new DomainError('invalid_account','A valid NEAR account is required');
    const payload={message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signatureBytes=Buffer.from(signature,'base64');
    try{if(/^[0-9a-f]{64}$/.test(accountId)){if(!isImplicitAccount(accountId,publicKey))throw new Error('Implicit account does not match key');verifyImplicitSignature(publicKey,payload,signatureBytes);}else await verifyMessage({signerAccountId:accountId,signerPublicKey:publicKey,payload,signature:signatureBytes,provider:this.provider});}
    catch{throw new DomainError('invalid_signature','Wallet signature or NEAR account key is invalid',401)}
    const expiresAt=new Date(this.now().getTime()+3600000).toISOString(),sessionPayload=Buffer.from(JSON.stringify({sub:accountId,exp:expiresAt,pk:publicKey,auth:'nep413'})).toString('base64url');
    return {token:signToken(sessionPayload,this.secret),accountId,expiresAt};
  }
}

function isImplicitAccount(accountId:string,publicKey:string){
  if(!/^[0-9a-f]{64}$/.test(accountId))return false;
  return parseEd25519Key(publicKey).toString('hex')===accountId;
}
function verifyImplicitSignature(publicKey:string,payload:{message:string;recipient:string;nonce:Uint8Array},signature:Uint8Array){
  const raw=parseEd25519Key(publicKey),key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),raw]),format:'der',type:'spki'});
  if(!verifySignature(null,serializeNep413Message(payload),key,signature))throw new Error('Invalid implicit account signature');
}
export function serializeNep413Message(payload:{message:string;recipient:string;nonce:Uint8Array}){
  if(payload.nonce.length!==32)throw new Error('NEP-413 nonce must contain 32 bytes');
  const prefix=Buffer.alloc(4);prefix.writeUInt32LE(2**31+413);
  return createHash('sha256').update(Buffer.concat([prefix,borshString(payload.message),Buffer.from(payload.nonce),borshString(payload.recipient),Buffer.from([0])])).digest();
}
function borshString(value:string){const bytes=Buffer.from(value,'utf8'),length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);return Buffer.concat([length,bytes]);}
function parseEd25519Key(value:string){
  const [curve,encoded]=value.split(':');if(curve!=='ed25519'||!encoded)throw new Error('Expected an ed25519 key');
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let number=0n;
  for(const char of encoded){const digit=alphabet.indexOf(char);if(digit<0)throw new Error('Invalid base58 key');number=number*58n+BigInt(digit);}
  const bytes:number[]=[];while(number){bytes.push(Number(number%256n));number/=256n;}for(const char of encoded){if(char!=='1')break;bytes.push(0);}
  const raw=Buffer.from(bytes.reverse());if(raw.length!==32)throw new Error('Invalid ed25519 key length');return raw;
}
