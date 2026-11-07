import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticateDevice, restoredSession, type LiveSession } from '../core/device-auth';
import { LiveApi, type CreateLiveStrategy, type LiveHealth, type LiveStrategy } from '../core/live-api';

type LiveState = {
  status: 'connecting' | 'live' | 'offline';
  health?: LiveHealth;
  strategies: LiveStrategy[];
  error?: string;
  refreshedAt?: number;
  session?: LiveSession;
  publishing: boolean;
  refresh: () => Promise<void>;
  publish: (strategy: CreateLiveStrategy) => Promise<LiveStrategy>;
};

const LiveCtx = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => new LiveApi(import.meta.env.VITE_API_BASE_URL ?? '/api'), []);
  const [state, setState] = useState<Omit<LiveState, 'refresh' | 'publish'>>({ status: 'connecting', strategies: [], session: restoredSession(), publishing: false });
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
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const publish = useCallback(async (strategy: CreateLiveStrategy) => {
    setState((current) => ({ ...current, publishing: true }));
    try {
      const session = await authenticateDevice(api);
      const result = await api.createStrategy(session.token, strategy);
      await refresh();
      setState((current) => ({ ...current, session, publishing: false }));
      return { ...result.strategy, latestVersion: result.version };
    } catch (error) {
      setState((current) => ({ ...current, publishing: false }));
      throw error;
    }
  }, [api, refresh]);
  return <LiveCtx.Provider value={{ ...state, refresh, publish }}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  const value = useContext(LiveCtx);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
