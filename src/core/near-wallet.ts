import { NearConnector, type NearWalletBase } from '@hot-labs/near-connect';
import type { LiveApi } from './live-api';
export type LiveSession = { token:string; accountId:string; expiresAt:string };

const connector = new NearConnector({ network:'mainnet', features:{signMessage:true,mainnet:true}, footerBranding:{heading:'Connect to Scion',link:'https://d30lp8j3k8uetx.cloudfront.net',linkText:'Scion'} });
let activeWallet:NearWalletBase|undefined;

export async function connectNear(api:LiveApi):Promise<LiveSession>{
  const challenge=await api.authChallenge();
  activeWallet=await connector.connect();
  const accounts=await activeWallet.getAccounts({network:'mainnet'}),account=accounts[0];
  if(!account)throw new Error('The wallet did not return a NEAR account.');
  const signed=await activeWallet.signMessage({message:challenge.message,recipient:challenge.recipient,nonce:Uint8Array.from(atob(challenge.nonce),(c)=>c.charCodeAt(0)),network:'mainnet',signerId:account.accountId});
  return api.authVerify({challengeId:challenge.challengeId,accountId:signed.accountId,publicKey:signed.publicKey,signature:signed.signature});
}

export async function restoreNearWallet(){try{const connected=await connector.getConnectedWallet();activeWallet=connected.wallet;return connected;}catch{return undefined;}}
export async function disconnectNear(){if(activeWallet)await connector.disconnect(activeWallet);activeWallet=undefined;}
export async function nearWallet(){activeWallet??=(await connector.getConnectedWallet()).wallet;return activeWallet;}
