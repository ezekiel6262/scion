import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LiveApi, type CreateLiveStrategy, type LiveBalances, type LiveHealth, type LiveProfile, type LiveStrategy } from '../core/live-api';
import { connectNear, disconnectNear, restoreNearWallet, type LiveSession } from '../core/near-wallet';

type LiveState = {
  status: 'connecting' | 'live' | 'offline';
  health?: LiveHealth;
  strategies: LiveStrategy[];
  error?: string;
  refreshedAt?: number;
  session?: LiveSession;
  profile?: LiveProfile;
  balances?: LiveBalances;
  balancesLoading: boolean;
  publishing: boolean;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  saveProfile: (input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string})=>Promise<LiveProfile>;
  refreshBalances:()=>Promise<void>;
  publish: (strategy: CreateLiveStrategy) => Promise<LiveStrategy>;
};

const LiveCtx = createContext<LiveState | null>(null);
const SESSION='scion.near.session';
const restoredSession=()=>{try{const value=JSON.parse(localStorage.getItem(SESSION)??'null') as LiveSession|null;return value&&Date.parse(value.expiresAt)>Date.now()+30000?value:undefined}catch{return undefined}};

export function LiveProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => new LiveApi(import.meta.env.VITE_API_BASE_URL ?? '/api'), []);
  const [state, setState] = useState<Omit<LiveState, 'refresh' | 'publish'|'connect'|'disconnect'|'saveProfile'|'refreshBalances'>>({ status: 'connecting', strategies: [], session: restoredSession(), publishing: false, balancesLoading:false });
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: current.refreshedAt ? current.status : 'connecting' }));
    try {
      const [health, strategies] = await Promise.all([api.health(), api.strategies()]);
      setState((current) => ({ ...current, status: 'live', health, strategies, error: undefined, refreshedAt: Date.now() }));
    } catch (error) {
      setState((current) => ({ ...current, status: 'offline', error: error instanceof Error ? error.message : 'Scion API is unavailable', refreshedAt: Date.now() }));
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    void restoreNearWallet();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(()=>{if(!state.session)return;void api.me(state.session.token).then((me)=>setState((current)=>({...current,profile:me.profile}))).catch(()=>{localStorage.removeItem(SESSION);setState((current)=>({...current,session:undefined,profile:undefined}))});},[api,state.session?.token]);
  const refreshBalances=useCallback(async()=>{if(!state.session)return;setState((current)=>({...current,balancesLoading:true}));try{const balances=await api.balances(state.session.token);setState((current)=>({...current,balances,balancesLoading:false}));}catch(error){setState((current)=>({...current,balancesLoading:false,error:error instanceof Error?error.message:'Balance lookup failed'}));throw error;}},[api,state.session]);
  useEffect(()=>{if(state.session)void refreshBalances();},[state.session?.token]);
  const connect=useCallback(async()=>{const session=await connectNear(api);localStorage.setItem(SESSION,JSON.stringify(session));const me=await api.me(session.token);setState((current)=>({...current,session,profile:me.profile}));},[api]);
  const disconnect=useCallback(async()=>{await disconnectNear();localStorage.removeItem(SESSION);setState((current)=>({...current,session:undefined,profile:undefined,balances:undefined}));},[]);
  const saveProfile=useCallback(async(input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string})=>{if(!state.session)throw new Error('Connect a NEAR wallet first.');const profile=await api.saveProfile(state.session.token,input);setState((current)=>({...current,profile}));return profile;},[api,state.session]);
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
  return <LiveCtx.Provider value={{ ...state, refresh, publish, connect, disconnect, saveProfile, refreshBalances }}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  const value = useContext(LiveCtx);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
