import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LiveApi, type CreateLiveStrategy, type LiveAgent, type LiveAgentPolicy, type LiveAgentProposal, type LiveAuditEvent, type LiveBalances, type LiveComment, type LiveCommerce, type LiveDeviceSession, type LiveExecution, type LiveFeedItem, type LiveHealth, type LiveInviteStatus, type LiveNotification, type LiveProfile, type LivePublicProfile, type LiveStrategy, type LiveStrategyDetail, type LiveSwap } from '../core/live-api';
import { connectEmbeddedNear, connectNear, createAgentAccount, disconnectNear, restoreNearWallet, sendUsdcPayment, type LiveSession } from '../core/near-wallet';

type LiveState = {
  status: 'connecting' | 'live' | 'offline';
  health?: LiveHealth;
  strategies: LiveStrategy[];
  feed:LiveFeedItem[];
  notifications:LiveNotification[];
  error?: string;
  refreshedAt?: number;
  session?: LiveSession;
  profile?: LiveProfile;
  balances?: LiveBalances;
  balancesLoading: boolean;
  publishing: boolean;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  connectEmail: () => Promise<void>;
  disconnect: () => Promise<void>;
  saveProfile: (input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string;inviteCode?:string})=>Promise<LiveProfile>;
  uploadAvatar:(file:File)=>Promise<string>;
  refreshBalances:()=>Promise<void>;
  publish: (strategy: CreateLiveStrategy) => Promise<LiveStrategy>;
  loadStrategy:(id:string)=>Promise<LiveStrategyDetail>;
  updateStrategy:(id:string,input:Partial<CreateLiveStrategy>)=>Promise<LiveStrategy>;
  recordExecution:(input:{strategyId:string;txHash:string;status:'SUCCESS';depositAddress:string;amountIn:string;amountOut?:string;originContract?:string})=>Promise<LiveExecution>;
  swaps:()=>Promise<LiveSwap[]>;recordSwap:(input:Omit<LiveSwap,'id'|'status'|'verified'|'createdAt'>)=>Promise<LiveSwap>;
  toggleFollow:(account:string)=>Promise<void>;toggleLike:(strategyId:string)=>Promise<void>;comments:(strategyId:string)=>Promise<LiveComment[]>;addComment:(strategyId:string,body:string)=>Promise<LiveComment>;createFork:(input:{parentVersionId:string;name:string;slug:string;changes:Record<string,unknown>;capabilityToken?:string})=>Promise<LiveStrategy>;markNotificationsRead:()=>Promise<void>;
  loadProfile:(account:string)=>Promise<LivePublicProfile>;
  loadSecurity:()=>Promise<{sessions:LiveDeviceSession[];audit:LiveAuditEvent[]}>;revokeSession:(id:string)=>Promise<void>;blockAccount:(account:string)=>Promise<boolean>;report:(input:{targetType:'profile'|'strategy'|'comment';targetId:string;reason:string})=>Promise<void>;
  loadCommerce:()=>Promise<LiveCommerce>;loadInvites:()=>Promise<LiveInviteStatus>;createInvite:()=>Promise<string>;createOffer:(input:{versionId:string;scopes:string[];expiresInSeconds:number;priceMinor:number})=>Promise<void>;purchaseOffer:(offerId:string,amountMinor:number,config:{contractId:string;treasury:string})=>Promise<void>;
  loadAgents:()=>Promise<LiveAgent[]>;loadAgent:(id:string)=>Promise<LiveAgent>;createAgent:(input:{name:string;handle:string;description:string;mode:LiveAgent['mode'];visibility:'public'|'private';policy:Omit<LiveAgentPolicy,'requiresOwnerApproval'>})=>Promise<LiveAgent>;provisionAgentAccount:(agent:LiveAgent)=>Promise<LiveAgent>;setAgentStatus:(id:string,status:'active'|'paused'|'revoked')=>Promise<LiveAgent>;createAgentProposal:(id:string,input:{action:'watch'|'trade';thesis:string;rationale:string;asset?:string;side?:'buy'|'sell';notionalMinor?:number;confidence:number})=>Promise<LiveAgentProposal>;decideAgentProposal:(id:string,decision:'approve'|'reject')=>Promise<LiveAgentProposal>;
  runAgent:(id:string)=>Promise<{agentId:string;run:{id:string;model:string;inputTokens:number;outputTokens:number;latencyMs:number};proposal:LiveAgentProposal}>;
};

const LiveCtx = createContext<LiveState | null>(null);
const SESSION='scion.near.session';
const restoredSession=()=>{try{const value=JSON.parse(localStorage.getItem(SESSION)??'null') as LiveSession|null;return value&&Date.parse(value.expiresAt)>Date.now()+30000?value:undefined}catch{return undefined}};

export function LiveProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => new LiveApi(import.meta.env.VITE_API_BASE_URL ?? '/api'), []);
  const [state, setState] = useState<Omit<LiveState, 'refresh' | 'publish'|'connect'|'connectEmail'|'disconnect'|'saveProfile'|'uploadAvatar'|'refreshBalances'|'loadStrategy'|'updateStrategy'|'recordExecution'|'swaps'|'recordSwap'|'toggleFollow'|'toggleLike'|'comments'|'addComment'|'createFork'|'markNotificationsRead'|'loadProfile'|'loadSecurity'|'revokeSession'|'blockAccount'|'report'|'loadCommerce'|'loadInvites'|'createInvite'|'createOffer'|'purchaseOffer'|'loadAgents'|'loadAgent'|'createAgent'|'provisionAgentAccount'|'setAgentStatus'|'createAgentProposal'|'decideAgentProposal'|'runAgent'>>({ status: 'connecting', strategies: [], feed:[],notifications:[],session: restoredSession(), publishing: false, balancesLoading:false });
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: current.refreshedAt ? current.status : 'connecting' }));
    try {
      const [health, strategies,feed] = await Promise.all([api.health(), api.strategies(),api.feed(state.session?.token)]);
      setState((current) => ({ ...current, status: 'live', health, strategies,feed, error: undefined, refreshedAt: Date.now() }));
    } catch (error) {
      setState((current) => ({ ...current, status: 'offline', error: error instanceof Error ? error.message : 'Scion API is unavailable', refreshedAt: Date.now() }));
    }
  }, [api,state.session?.token]);
  useEffect(() => {
    void refresh();
    void restoreNearWallet();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(()=>{if(!state.session)return;void api.me(state.session.token).then((me)=>setState((current)=>({...current,profile:me.profile}))).catch(()=>{localStorage.removeItem(SESSION);setState((current)=>({...current,session:undefined,profile:undefined}))});},[api,state.session?.token]);
  useEffect(()=>{if(!state.session)return;void api.notifications(state.session.token).then(notifications=>setState(current=>({...current,notifications})));},[api,state.session?.token,state.refreshedAt]);
  const refreshBalances=useCallback(async()=>{if(!state.session)return;setState((current)=>({...current,balancesLoading:true}));try{const balances=await api.balances(state.session.token);setState((current)=>({...current,balances,balancesLoading:false}));}catch(error){setState((current)=>({...current,balancesLoading:false,error:error instanceof Error?error.message:'Balance lookup failed'}));throw error;}},[api,state.session]);
  useEffect(()=>{if(state.session)void refreshBalances();},[state.session?.token]);
  const connect=useCallback(async()=>{const session=await connectNear(api);localStorage.setItem(SESSION,JSON.stringify(session));const me=await api.me(session.token);setState((current)=>({...current,session,profile:me.profile}));},[api]);
  const connectEmail=useCallback(async()=>{const session=await connectEmbeddedNear(api);localStorage.setItem(SESSION,JSON.stringify(session));const me=await api.me(session.token);setState((current)=>({...current,session,profile:me.profile}));},[api]);
  const disconnect=useCallback(async()=>{await disconnectNear();localStorage.removeItem(SESSION);setState((current)=>({...current,session:undefined,profile:undefined,balances:undefined}));},[]);
  const saveProfile=useCallback(async(input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string;inviteCode?:string})=>{if(!state.session)throw new Error('Connect a NEAR wallet first.');const profile=await api.saveProfile(state.session.token,input);setState((current)=>({...current,profile}));return profile;},[api,state.session]);
  const uploadAvatar=useCallback(async(file:File)=>{if(!state.session)throw new Error('Connect a NEAR wallet first.');const prepared=await prepareAvatar(file);const value=await api.uploadAvatar(state.session.token,prepared);return value.avatarUrl;},[api,state.session]);
  const publish = useCallback(async (strategy: CreateLiveStrategy) => {
    setState((current) => ({ ...current, publishing: true }));
    try {
      const session = state.session;
      if (!session) throw new Error('Connect and verify a NEAR wallet before publishing.');
      const result = await api.createStrategy(session.token, strategy);
      await refresh();
      setState((current) => ({ ...current, session, publishing: false }));
      return { ...result.strategy, latestVersion: result.version };
    } catch (error) {
      setState((current) => ({ ...current, publishing: false }));
      throw error;
    }
  }, [api, refresh, state.session]);
  const loadStrategy=useCallback((id:string)=>api.strategy(id,state.session?.token),[api,state.session]);
  const updateStrategy=useCallback(async(id:string,input:Partial<CreateLiveStrategy>)=>{if(!state.session)throw new Error('Connect your wallet first.');const result=await api.updateStrategy(state.session.token,id,input);await refresh();return {...result.strategy,latestVersion:result.version};},[api,refresh,state.session]);
  const recordExecution=useCallback(async(input:{strategyId:string;txHash:string;status:'SUCCESS';depositAddress:string;amountIn:string;amountOut?:string;originContract?:string})=>{if(!state.session)throw new Error('Connect your wallet first.');const verified=await api.verifyExecution(state.session.token,{txHash:input.txHash,depositAddress:input.depositAddress,amountIn:input.amountIn,originContract:input.originContract});return api.recordExecution(state.session.token,{...input,verificationProof:verified.proof});},[api,state.session]);
  const swaps=useCallback(()=>api.swaps(requireSession().token),[api,state.session]);
  const recordSwap=useCallback(async(input:Omit<LiveSwap,'id'|'status'|'verified'|'createdAt'>)=>{const session=requireSession(),verified=await api.verifyExecution(session.token,{txHash:input.txHash,depositAddress:input.depositAddress,amountIn:input.amountIn,originContract:input.originAsset.replace(/^nep141:/,'')});return api.recordSwap(session.token,{...input,verificationProof:verified.proof});},[api,state.session]);
  const requireSession=()=>{if(!state.session)throw new Error('Connect your NEAR wallet first.');return state.session;};
  const toggleFollow=useCallback(async(account:string)=>{await api.toggleFollow(requireSession().token,account);await refresh();},[api,refresh,state.session]);
  const toggleLike=useCallback(async(strategyId:string)=>{await api.toggleLike(requireSession().token,strategyId);await refresh();},[api,refresh,state.session]);
  const comments=useCallback((strategyId:string)=>api.comments(strategyId),[api]);
  const addComment=useCallback((strategyId:string,body:string)=>api.addComment(requireSession().token,strategyId,body),[api,state.session]);
  const createFork=useCallback(async(input:{parentVersionId:string;name:string;slug:string;changes:Record<string,unknown>;capabilityToken?:string})=>{const result=await api.createFork(requireSession().token,input);await refresh();return {...result.strategy,latestVersion:result.version};},[api,refresh,state.session]);
  const markNotificationsRead=useCallback(async()=>{const session=requireSession();await api.readNotifications(session.token);setState(current=>({...current,notifications:current.notifications.map(n=>({...n,read:true}))}));},[api,state.session]);
  const loadProfile=useCallback((account:string)=>api.publicProfile(account,state.session?.token),[api,state.session]);
  const loadSecurity=useCallback(async()=>{const session=requireSession();const [sessions,audit]=await Promise.all([api.sessions(session.token),api.audit(session.token)]);return {sessions,audit};},[api,state.session]);
  const revokeSession=useCallback(async(id:string)=>{const session=requireSession();await api.revokeSession(session.token,id);},[api,state.session]);
  const blockAccount=useCallback(async(account:string)=>{const session=requireSession();return (await api.block(session.token,account)).blocked;},[api,state.session]);
  const report=useCallback(async(input:{targetType:'profile'|'strategy'|'comment';targetId:string;reason:string})=>{const session=requireSession();await api.report(session.token,input);},[api,state.session]);
  const loadCommerce=useCallback(()=>api.commerce(requireSession().token),[api,state.session]);const loadInvites=useCallback(()=>api.invites(requireSession().token),[api,state.session]);const createInvite=useCallback(async()=>(await api.createInvite(requireSession().token)).code,[api,state.session]);
  const createOffer=useCallback(async(input:{versionId:string;scopes:string[];expiresInSeconds:number;priceMinor:number})=>{await api.createOffer(requireSession().token,input);},[api,state.session]);
  const purchaseOffer=useCallback(async(offerId:string,amountMinor:number,config:{contractId:string;treasury:string})=>{const session=requireSession(),plan=await api.checkoutPlan(session.token,offerId);if(plan.amountMinor!==amountMinor||plan.contractId!==config.contractId)throw new Error('Checkout plan changed. Refresh and try again.');const txHash=await sendUsdcPayment(session.accountId,plan.contractId,plan.transfers),verified=await api.verifyPayment(session.token,txHash,plan.token);await api.purchase(session.token,offerId,verified.proof,crypto.randomUUID());},[api,state.session]);
  const loadAgents=useCallback(()=>api.agents(state.session?.token),[api,state.session]);const loadAgent=useCallback((id:string)=>api.agent(id,state.session?.token),[api,state.session]);
  const createAgent=useCallback((input:{name:string;handle:string;description:string;mode:LiveAgent['mode'];visibility:'public'|'private';policy:Omit<LiveAgentPolicy,'requiresOwnerApproval'>})=>api.createAgent(requireSession().token,input),[api,state.session]);
  const provisionAgentAccount=useCallback(async(agent:LiveAgent)=>{const session=requireSession();if(agent.owner!==session.accountId)throw new Error('Only the agent owner can create its account.');const account=await createAgentAccount(session.accountId,agent.handle);return api.registerAgentAccount(session.token,agent.id,account);},[api,state.session]);
  const setAgentStatus=useCallback((id:string,status:'active'|'paused'|'revoked')=>api.setAgentStatus(requireSession().token,id,status),[api,state.session]);
  const createAgentProposal=useCallback((id:string,input:{action:'watch'|'trade';thesis:string;rationale:string;asset?:string;side?:'buy'|'sell';notionalMinor?:number;confidence:number})=>api.createAgentProposal(requireSession().token,id,input),[api,state.session]);
  const decideAgentProposal=useCallback((id:string,decision:'approve'|'reject')=>api.decideAgentProposal(requireSession().token,id,decision),[api,state.session]);
  const runAgent=useCallback((id:string)=>api.runAgent(requireSession().token,id),[api,state.session]);
  return <LiveCtx.Provider value={{ ...state, refresh, publish, connect, connectEmail, disconnect, saveProfile,uploadAvatar, refreshBalances, loadStrategy, updateStrategy, recordExecution,swaps,recordSwap,toggleFollow,toggleLike,comments,addComment,createFork,markNotificationsRead,loadProfile,loadSecurity,revokeSession,blockAccount,report,loadCommerce,loadInvites,createInvite,createOffer,purchaseOffer,loadAgents,loadAgent,createAgent,provisionAgentAccount,setAgentStatus,createAgentProposal,decideAgentProposal,runAgent }}>{children}</LiveCtx.Provider>;
}

async function prepareAvatar(file:File){if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>8_000_000)throw new Error('Choose an image smaller than 8 MB.');const bitmap=await createImageBitmap(file),size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is unavailable.');const side=Math.min(bitmap.width,bitmap.height),sx=(bitmap.width-side)/2,sy=(bitmap.height-side)/2;context.drawImage(bitmap,sx,sy,side,side,0,0,size,size);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not process image.')),'image/webp',.82));if(blob.size>600000)throw new Error('Processed profile picture is too large.');const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));return {contentType:'image/webp',data:btoa(binary)};}

export function useLive() {
  const value = useContext(LiveCtx);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
