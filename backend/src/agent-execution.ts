import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { createOneClickClient } from '@fastnear/intents';
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, teraToGas, type KeyPairString } from 'near-api-js';
import { DomainError, type ProductObject } from './domain.ts';

export type AgentAuthority = { publicKey:string; envelope:string; keyId:string; preparedAt:string };
export type AgentExecutionResult = { txHash:string; depositAddress:string; originAsset:string; destinationAsset:string; amountIn:string; amountOut:string; status:'SUCCESS'; settledAt:string };

export interface AgentExecutor {
  prepare(agentId:string):Promise<AgentAuthority>;
  execute(agent:ProductObject,proposal:ProductObject):Promise<AgentExecutionResult>;
  revoke?(agent:ProductObject):Promise<string>;
}

export class DisabledAgentExecutor implements AgentExecutor {
  async prepare(){throw new DomainError('agent_signer_unavailable','The isolated agent signer is not configured',503);}
  async execute(){throw new DomainError('agent_signer_unavailable','The isolated agent signer is not configured',503);}
}

export class AwsKmsAgentExecutor implements AgentExecutor {
  private kms:KMSClient;private keyId:string;private rpc:string;private usdcAssetId:string;private oneClick= createOneClickClient();
  constructor(keyId:string,usdcContract:string,rpc='https://rpc.fastnear.com',kms=new KMSClient({})){this.keyId=keyId;this.rpc=rpc;this.kms=kms;this.usdcAssetId=`nep141:${usdcContract}`;}
  async prepare(agentId:string):Promise<AgentAuthority>{
    const key=KeyPair.fromRandom('secp256k1'),secret=key.toString(),encrypted=await this.kms.send(new EncryptCommand({KeyId:this.keyId,Plaintext:Buffer.from(secret),EncryptionContext:{agentId,purpose:'scion-agent-execution'}}));
    if(!encrypted.CiphertextBlob)throw new DomainError('agent_key_failed','AWS KMS did not return an encrypted agent key',503);
    return {publicKey:key.getPublicKey().toString(),envelope:Buffer.from(encrypted.CiphertextBlob).toString('base64'),keyId:this.keyId,preparedAt:new Date().toISOString()};
  }
  async execute(agent:ProductObject,proposal:ProductObject):Promise<AgentExecutionResult>{
    const accountId=String(agent.payload.executionAccount??''),authority=agent.payload.authority as AgentAuthority|undefined;
    if(!accountId||!authority?.envelope)throw new DomainError('agent_authority_missing','The agent has no verified execution authority',409);
    const decrypted=await this.kms.send(new DecryptCommand({KeyId:this.keyId,CiphertextBlob:Buffer.from(authority.envelope,'base64'),EncryptionContext:{agentId:agent.id,purpose:'scion-agent-execution'}}));
    if(!decrypted.Plaintext)throw new DomainError('agent_key_failed','AWS KMS could not decrypt the isolated agent key',503);
    let secret='';try{secret=Buffer.from(decrypted.Plaintext).toString();const signer=KeyPairSigner.fromSecretKey(secret as KeyPairString),tokens=await this.oneClick.tokens() as any[],asset=String(proposal.payload.asset),side=String(proposal.payload.side),notional=Number(proposal.payload.notionalMinor)/1e6;
      const candidates=(value:string)=>tokens.filter(token=>value.startsWith('nep141:')?String(token.assetId)===value:String(token.symbol).toUpperCase()===value&&String(token.assetId).startsWith('nep141:')).sort((a,b)=>Number(b.price??0)-Number(a.price??0));
      const usdc=tokens.find(token=>String(token.assetId)===this.usdcAssetId),target=candidates(asset)[0];if(!usdc||!target)throw new DomainError('agent_asset_unavailable','A policy asset is not available as a verified NEAR 1Click token',422);
      const origin=side==='buy'?usdc:target,destination=side==='buy'?target:usdc,price=Number(origin.price);if(!price||price<=0)throw new DomainError('agent_price_unavailable','The origin asset has no usable live price',422);
      const raw=BigInt(Math.max(1,Math.floor(notional/price*10**Number(origin.decimals)))).toString(),slippage=Number((agent.payload.policy as any).maxSlippageBps);
      const quote:any=await this.oneClick.quote({dry:false,swapType:'EXACT_INPUT',slippageTolerance:slippage,originAsset:origin.assetId,destinationAsset:destination.assetId,amount:raw,depositType:'ORIGIN_CHAIN',refundTo:accountId,refundType:'ORIGIN_CHAIN',recipient:accountId,recipientType:'DESTINATION_CHAIN',deadline:new Date(Date.now()+10*60_000).toISOString()});
      const depositAddress=String(quote.quote?.depositAddress??''),amountIn=String(quote.quote?.amountIn??raw),amountOut=String(quote.quote?.amountOut??'');if(!depositAddress||!amountOut)throw new DomainError('agent_quote_invalid','1Click returned an incomplete executable quote',502);
      const contract=String(origin.assetId).replace(/^nep141:/,''),account=new Account(accountId,new JsonRpcProvider({url:this.rpc}),signer),outcome=await account.callFunction({contractId:contract,methodName:'ft_transfer',args:{receiver_id:depositAddress,amount:amountIn,memo:'Scion bounded agent via NEAR Intents'},gas:teraToGas('30'),deposit:1n});
      const txHash=outcome.transaction.hash;await this.oneClick.submitDeposit({txHash,depositAddress,nearSenderAccount:accountId});let settled:any;
      for(let attempt=0;attempt<18;attempt++){settled=await this.oneClick.status({depositAddress});if(['SUCCESS','REFUNDED','FAILED'].includes(settled.status))break;await new Promise(resolve=>setTimeout(resolve,5000));}
      if(settled?.status!=='SUCCESS')throw new DomainError('agent_settlement_failed',settled?.status==='REFUNDED'?'The autonomous swap was refunded':'The autonomous swap did not settle in time',502);
      return {txHash,depositAddress,originAsset:origin.assetId,destinationAsset:destination.assetId,amountIn,amountOut,status:'SUCCESS',settledAt:new Date().toISOString()};
    }finally{secret='';if(decrypted.Plaintext)Buffer.from(decrypted.Plaintext).fill(0);}
  }
  async revoke(agent:ProductObject){const accountId=String(agent.payload.executionAccount??''),authority=agent.payload.authority as AgentAuthority|undefined;if(!accountId||!authority?.envelope||!authority.publicKey)throw new DomainError('agent_authority_missing','The agent has no execution key to remove',409);const decrypted=await this.kms.send(new DecryptCommand({KeyId:this.keyId,CiphertextBlob:Buffer.from(authority.envelope,'base64'),EncryptionContext:{agentId:agent.id,purpose:'scion-agent-execution'}}));if(!decrypted.Plaintext)throw new DomainError('agent_key_failed','AWS KMS could not decrypt the isolated agent key',503);let secret='';try{secret=Buffer.from(decrypted.Plaintext).toString();const signer=KeyPairSigner.fromSecretKey(secret as KeyPairString),account=new Account(accountId,new JsonRpcProvider({url:this.rpc}),signer),outcome=await account.deleteKey(authority.publicKey);return outcome.transaction.hash;}finally{secret='';Buffer.from(decrypted.Plaintext).fill(0);}}
}
