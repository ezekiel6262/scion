import { randomBytes } from 'node:crypto';
import { JsonRpcProvider } from 'near-api-js';
import { verifyMessage } from 'near-api-js/nep413';
import { DomainError } from './domain.ts';
import { id, signToken, verifyToken } from './crypto.ts';

type Challenge = { jti:string; message:string; nonce:string; recipient:string; exp:string };

export class Nep413AuthService {
  private provider: JsonRpcProvider;
  constructor(private secret:string,private recipient:string,private now=()=>new Date(),rpcUrl='https://rpc.mainnet.fastnear.com') { this.provider=new JsonRpcProvider({url:rpcUrl}); }
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
    try{await verifyMessage({signerAccountId:accountId,signerPublicKey:publicKey,payload:{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signature:Buffer.from(signature,'base64'),provider:this.provider});}
    catch{throw new DomainError('invalid_signature','Wallet signature or NEAR account key is invalid',401)}
    const expiresAt=new Date(this.now().getTime()+3600000).toISOString();const payload=Buffer.from(JSON.stringify({sub:accountId,exp:expiresAt,pk:publicKey,auth:'nep413'})).toString('base64url');
    return {token:signToken(payload,this.secret),accountId,expiresAt};
  }
}
