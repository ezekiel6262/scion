import { NearConnector, type NearWalletBase, type WalletManifest } from '@hot-labs/near-connect';
import type { LiveApi } from './live-api';
import { logoutPrivy } from './privy-auth';
export type LiveSession = { token:string; accountId:string; expiresAt:string };
export type WalletAuthMode='connected-wallet'|'embedded';
export type WalletAuthAdapter={mode:WalletAuthMode;label:string;connect(api:LiveApi):Promise<LiveSession>;restore():Promise<unknown>;disconnect():Promise<void>};

const connector = new NearConnector({ network:'mainnet', features:{signMessage:true,mainnet:true}, footerBranding:{heading:'Connect to Scion',link:'https://scionhub.xyz',linkText:'Scion'} });
let activeWallet:NearWalletBase|undefined;
let embeddedRegistered:Promise<void>|undefined;

const embeddedManifest = {
  id:'scion-embedded',name:'Scion email wallet',icon:'https://scionhub.xyz/favicon.svg',description:'A self-custodial NEAR wallet secured by your Scion email login.',website:'https://scionhub.xyz',version:'1.0.0',
  executor:'https://raw.githubusercontent.com/beneviolabs/privy-near-connect/3d56b782669d242a1ea432921e291abc26b4ebc7/executor.js',type:'sandbox',platform:{web:'https://scionhub.xyz'},
  features:{signMessage:true,signTransaction:true,signAndSendTransaction:true,signAndSendTransactions:true,signInWithoutAddKey:true,signInAndSignMessage:true,signInWithFunctionCallKey:true,signDelegateActions:false,mainnet:true,testnet:false},
  permissions:{storage:true,isPrivyConnect:true,allowsOpen:['https://scionhub.xyz']},metadata:{signPageURL:'https://scionhub.xyz/sign',debug:false},
} as unknown as WalletManifest;

async function authenticateWallet(api:LiveApi,walletId?:string):Promise<LiveSession>{
  const challenge=await api.authChallenge();
  activeWallet=await connector.connect(walletId?{walletId}:undefined);
  const accounts=await activeWallet.getAccounts({network:'mainnet'}),account=accounts[0];
  if(!account)throw new Error('The wallet did not return a NEAR account.');
  const signed=await activeWallet.signMessage({message:challenge.message,recipient:challenge.recipient,nonce:Uint8Array.from(atob(challenge.nonce),(c)=>c.charCodeAt(0)),network:'mainnet',signerId:account.accountId});
  return api.authVerify({challengeId:challenge.challengeId,accountId:signed.accountId,publicKey:signed.publicKey,signature:signed.signature});
}

async function connectExistingWallet(api:LiveApi):Promise<LiveSession>{
  return authenticateWallet(api);
}

async function connectEmbeddedWallet(api:LiveApi):Promise<LiveSession>{
  embeddedRegistered??=connector.registerWallet(embeddedManifest);
  await embeddedRegistered;
  return authenticateWallet(api,embeddedManifest.id);
}

async function restoreExistingWallet(){try{const connected=await connector.getConnectedWallet();activeWallet=connected.wallet;return connected;}catch{return undefined;}}
async function disconnectExistingWallet(){if(activeWallet)await connector.disconnect(activeWallet);activeWallet=undefined;}
export const connectedWalletAdapter:WalletAuthAdapter={mode:'connected-wallet',label:'Connect an existing wallet',connect:connectExistingWallet,restore:restoreExistingWallet,disconnect:disconnectExistingWallet};
export const embeddedWalletAdapter:WalletAuthAdapter={mode:'embedded',label:'Continue with email',connect:connectEmbeddedWallet,restore:restoreExistingWallet,disconnect:async()=>{await disconnectExistingWallet();await logoutPrivy();}};
export async function connectNear(api:LiveApi):Promise<LiveSession>{return connectedWalletAdapter.connect(api);}
export async function connectEmbeddedNear(api:LiveApi):Promise<LiveSession>{return embeddedWalletAdapter.connect(api);}
export async function restoreNearWallet(){return connectedWalletAdapter.restore();}
export async function disconnectNear(){await connectedWalletAdapter.disconnect();await logoutPrivy();}
export async function nearWallet(){activeWallet??=(await connector.getConnectedWallet()).wallet;return activeWallet;}
export function agentAccountId(handle:string,owner:string){const label=handle.toLowerCase().replaceAll('_','-').replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'');if(label.length<2)throw new Error('Use at least two letters or numbers in the agent handle.');return `${label}.${owner}`;}
export async function createAgentAccount(owner:string,handle:string,fundingNear='0.1'){
  const wallet=await nearWallet(),accounts=await wallet.getAccounts({network:'mainnet'}),account=accounts.find(value=>value.accountId===owner),accountId=agentAccountId(handle,owner);
  if(!account?.publicKey)throw new Error('Reconnect the owner wallet so Scion can read its public key.');
  const amount=BigInt(Math.round(Number(fundingNear)*1_000_000))*1_000_000_000_000_000_000n;
  const outcome=await wallet.signAndSendTransaction({network:'mainnet',signerId:owner,receiverId:accountId,actions:[{type:'CreateAccount'},{type:'Transfer',params:{deposit:String(amount)}},{type:'AddKey',params:{publicKey:account.publicKey,accessKey:{permission:'FullAccess'}}}]});
  return {accountId,txHash:outcome.transaction.hash};
}
export async function sendUsdcPayment(accountId:string,contractId:string,transfers:{receiverId:string;amountMinor:number;kind:string}[]){
  if(!transfers.length||transfers.some(value=>!Number.isSafeInteger(value.amountMinor)||value.amountMinor<1))throw new Error('Invalid USDC payment split.');
  const wallet=await nearWallet(),actions:Array<{type:'FunctionCall';params:{methodName:string;args:Record<string,unknown>;gas:string;deposit:string}}>=[];
  const bounds=await viewContract(contractId,'storage_balance_bounds',{}),minimum=String(bounds?.min??'1250000000000000000000');
  for(const receiver of [...new Set(transfers.map(value=>value.receiverId))]){const registered=await viewContract(contractId,'storage_balance_of',{account_id:receiver});if(!registered)actions.push({type:'FunctionCall',params:{methodName:'storage_deposit',args:{account_id:receiver,registration_only:true},gas:'30000000000000',deposit:minimum}});}
  actions.push(...transfers.map(value=>({type:'FunctionCall' as const,params:{methodName:'ft_transfer',args:{receiver_id:value.receiverId,amount:String(value.amountMinor),memo:`Scion ${value.kind.replaceAll('_',' ')}`},gas:'30000000000000',deposit:'1'}})));
  const outcome=await wallet.signAndSendTransaction({network:'mainnet',signerId:accountId,receiverId:contractId,actions});return outcome.transaction.hash;
}
async function viewContract(contractId:string,methodName:string,args:Record<string,unknown>){const response=await fetch('https://rpc.mainnet.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'scion-storage',method:'query',params:{request_type:'call_function',finality:'final',account_id:contractId,method_name:methodName,args_base64:btoa(JSON.stringify(args))}})}),body=await response.json() as any;if(!response.ok||body.error)throw new Error('Could not verify USDC account registration.');return JSON.parse(new TextDecoder().decode(Uint8Array.from(body.result.result)));}
