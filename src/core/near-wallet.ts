import { NearConnector, type NearWalletBase } from '@hot-labs/near-connect';
import type { LiveApi } from './live-api';
export type LiveSession = { token:string; accountId:string; expiresAt:string };
export type WalletAuthMode='connected-wallet'|'embedded';
export type WalletAuthAdapter={mode:WalletAuthMode;label:string;connect(api:LiveApi):Promise<LiveSession>;restore():Promise<unknown>;disconnect():Promise<void>};

const connector = new NearConnector({ network:'mainnet', features:{signMessage:true,mainnet:true}, footerBranding:{heading:'Connect to Scion',link:'https://d30lp8j3k8uetx.cloudfront.net',linkText:'Scion'} });
let activeWallet:NearWalletBase|undefined;

async function connectExistingWallet(api:LiveApi):Promise<LiveSession>{
  const challenge=await api.authChallenge();
  activeWallet=await connector.connect();
  const accounts=await activeWallet.getAccounts({network:'mainnet'}),account=accounts[0];
  if(!account)throw new Error('The wallet did not return a NEAR account.');
  const signed=await activeWallet.signMessage({message:challenge.message,recipient:challenge.recipient,nonce:Uint8Array.from(atob(challenge.nonce),(c)=>c.charCodeAt(0)),network:'mainnet',signerId:account.accountId});
  return api.authVerify({challengeId:challenge.challengeId,accountId:signed.accountId,publicKey:signed.publicKey,signature:signed.signature});
}

async function restoreExistingWallet(){try{const connected=await connector.getConnectedWallet();activeWallet=connected.wallet;return connected;}catch{return undefined;}}
async function disconnectExistingWallet(){if(activeWallet)await connector.disconnect(activeWallet);activeWallet=undefined;}
export const connectedWalletAdapter:WalletAuthAdapter={mode:'connected-wallet',label:'Connect an existing wallet',connect:connectExistingWallet,restore:restoreExistingWallet,disconnect:disconnectExistingWallet};
export const embeddedWalletStatus=()=>{const domain=import.meta.env.VITE_NEAR_AUTH_DOMAIN,clientId=import.meta.env.VITE_NEAR_AUTH_CLIENT_ID,relayer=import.meta.env.VITE_NEAR_AUTH_RELAYER_URL;return {configured:!!(domain&&clientId&&relayer),domain,clientId,relayer};};
export async function connectNear(api:LiveApi):Promise<LiveSession>{return connectedWalletAdapter.connect(api);}
export async function restoreNearWallet(){return connectedWalletAdapter.restore();}
export async function disconnectNear(){return connectedWalletAdapter.disconnect();}
export async function nearWallet(){activeWallet??=(await connector.getConnectedWallet()).wallet;return activeWallet;}
export async function sendUsdcPayment(accountId:string,contractId:string,transfers:{receiverId:string;amountMinor:number;kind:string}[]){
  if(!transfers.length||transfers.some(value=>!Number.isSafeInteger(value.amountMinor)||value.amountMinor<1))throw new Error('Invalid USDC payment split.');
  const wallet=await nearWallet(),actions:Array<{type:'FunctionCall';params:{methodName:string;args:Record<string,unknown>;gas:string;deposit:string}}>=[];
  const bounds=await viewContract(contractId,'storage_balance_bounds',{}),minimum=String(bounds?.min??'1250000000000000000000');
  for(const receiver of [...new Set(transfers.map(value=>value.receiverId))]){const registered=await viewContract(contractId,'storage_balance_of',{account_id:receiver});if(!registered)actions.push({type:'FunctionCall',params:{methodName:'storage_deposit',args:{account_id:receiver,registration_only:true},gas:'30000000000000',deposit:minimum}});}
  actions.push(...transfers.map(value=>({type:'FunctionCall' as const,params:{methodName:'ft_transfer',args:{receiver_id:value.receiverId,amount:String(value.amountMinor),memo:`Scion ${value.kind.replaceAll('_',' ')}`},gas:'30000000000000',deposit:'1'}})));
  const outcome=await wallet.signAndSendTransaction({network:'mainnet',signerId:accountId,receiverId:contractId,actions});return outcome.transaction.hash;
}
async function viewContract(contractId:string,methodName:string,args:Record<string,unknown>){const response=await fetch('https://rpc.mainnet.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'scion-storage',method:'query',params:{request_type:'call_function',finality:'final',account_id:contractId,method_name:methodName,args_base64:btoa(JSON.stringify(args))}})}),body=await response.json() as any;if(!response.ok||body.error)throw new Error('Could not verify USDC account registration.');return JSON.parse(new TextDecoder().decode(Uint8Array.from(body.result.result)));}
