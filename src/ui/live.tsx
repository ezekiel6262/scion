import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LiveApi, type LiveHealth, type LiveStrategy } from '../core/live-api';

type LiveState = {
  status: 'connecting' | 'live' | 'offline';
  health?: LiveHealth;
  strategies: LiveStrategy[];
  error?: string;
  refreshedAt?: number;
  refresh: () => Promise<void>;
};

const LiveCtx = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => new LiveApi(import.meta.env.VITE_API_BASE_URL ?? '/api'), []);
  const [state, setState] = useState<Omit<LiveState, 'refresh'>>({ status: 'connecting', strategies: [] });
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: current.refreshedAt ? current.status : 'connecting' }));
    try {
      const [health, strategies] = await Promise.all([api.health(), api.strategies()]);
      setState({ status: 'live', health, strategies, refreshedAt: Date.now() });
    } catch (error) {
      setState((current) => ({ ...current, status: 'offline', error: error instanceof Error ? error.message : 'Scion API is unavailable', refreshedAt: Date.now() }));
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return <LiveCtx.Provider value={{ ...state, refresh }}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  const value = useContext(LiveCtx);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
