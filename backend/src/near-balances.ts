import { DomainError } from './domain.ts';
import { signToken, verifyToken } from './crypto.ts';

export type NearHolding = { asset:string; chain:'near'; contractId?:string; units:string; raw:string; decimals:number; usdPrice?:number; observedAt:string };

export class NearBalanceService {
  constructor(private secret:string,private now=()=>new Date(),private rpcUrl='https://rpc.mainnet.fastnear.com',private oneClickUrl='https://1click.chaindefuser.com'){}
  actor(token:string){
    const raw=verifyToken(token,this.secret);if(!raw)throw new DomainError('unauthorized','A valid bearer session is required',401);
    let value:any;try{value=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('unauthorized','Session is malformed',401)}
    if(value.auth!=='nep413'||typeof value.sub!=='string'||new Date(value.exp)<=this.now())throw new DomainError('unauthorized','Session is expired or invalid',401);
    return value.sub as string;
  }
  async holdings(accountId:string){
    const observedAt=this.now().toISOString();
    const [account,tokensResponse]=await Promise.all([this.rpc('query',{request_type:'view_account',finality:'final',account_id:accountId}),fetch(`${this.oneClickUrl}/v0/tokens`)]);
    if(!tokensResponse.ok)throw new DomainError('balance_provider_unavailable','Token registry is temporarily unavailable',503);
    const tokens=await tokensResponse.json() as Array<{assetId:string;blockchain:string;symbol:string;decimals:number;price?:number;contractAddress?:string}>;
    const nearTokens=tokens.filter((token)=>token.blockchain.toLowerCase()==='near'&&token.assetId.startsWith('nep141:'));
    const nearToken=nearTokens.find((token)=>token.assetId==='nep141:wrap.near');
    const nativeRaw=String(account.amount??'0');
    const holdings:NearHolding[]=[{asset:'NEAR',chain:'near',units:formatUnits(nativeRaw,24),raw:nativeRaw,decimals:24,usdPrice:nearToken?.price,observedAt}];
    holdings.push(...await Promise.all(nearTokens.map(async(token)=>{const contractId=token.contractAddress??token.assetId.replace(/^nep141:/,''),asset=token.symbol.toUpperCase()==='WNEAR'?'wNEAR':token.symbol.toUpperCase();try{const raw=await this.ftBalance(contractId,accountId);return {asset,chain:'near' as const,contractId,units:formatUnits(raw,token.decimals),raw,decimals:token.decimals,usdPrice:token.price,observedAt};}catch{return {asset,chain:'near' as const,contractId,units:'0',raw:'0',decimals:token.decimals,usdPrice:token.price,observedAt};}})));
    const proofPayload=Buffer.from(JSON.stringify({sub:accountId,observedAt,exp:new Date(this.now().getTime()+300000).toISOString(),holdings:holdings.map(({asset,raw,contractId})=>({asset,raw,contractId}))})).toString('base64url');
    return {accountId,network:'mainnet' as const,observedAt,holdings,proof:signToken(proofPayload,this.secret)};
  }
  private async ftBalance(contractId:string,accountId:string){
    const result=await this.rpc('query',{request_type:'call_function',finality:'final',account_id:contractId,method_name:'ft_balance_of',args_base64:Buffer.from(JSON.stringify({account_id:accountId})).toString('base64')});
    return JSON.parse(Buffer.from(result.result).toString()) as string;
  }
  private async rpc(method:string,params:unknown){
    const response=await fetch(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'scion',method,params})});
    const body=await response.json() as any;if(!response.ok||body.error)throw new DomainError('near_rpc_error','NEAR mainnet balance lookup failed',503);return body.result;
  }
}

function formatUnits(raw:string,decimals:number){
  const value=raw.padStart(decimals+1,'0'),whole=value.slice(0,-decimals),fraction=value.slice(-decimals).replace(/0+$/,'').slice(0,8);return fraction?`${whole}.${fraction}`:whole;
}
