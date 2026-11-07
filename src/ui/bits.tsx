import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { engine, type State } from '../core/engine';
import type { PlannedOrder } from '../core/policy';
import type { Attestation, Section, User } from '../core/types';

export const useStore = (): State => useSyncExternalStore(engine.subscribe, engine.getState);

export type Route =
  | { name: 'home' } | { name: 'explore' } | { name: 'lineage' } | { name: 'studio' } | { name: 'keys' } | { name: 'earnings' } | { name: 'security' } | {name:'account'}
  | { name: 'plays' } | { name: 'trade' } | { name: 'duels' } | { name: 'portfolio' } | { name: 'collection' } | { name: 'studio-portfolio' }
  | { name: 'strategy'; id: string; tab?: string } | { name: 'fork'; id: string } | { name: 'profile'; id: string }
  | { name: 'live-strategy'; id: string };

export interface Ui {
  go: (r: Route) => void;
  execute: (sid: string, orders: PlannedOrder[], slippage: number, manual?: boolean) => void;
}
export const UiCtx = createContext<Ui>({ go: () => {}, execute: () => {} });
export const useUi = () => useContext(UiCtx);

export const usd = (n: number, d = 2) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const usdc = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDC`;
export const pct = (n: number) => (Math.abs(n) < 0.05 ? '0.0%' : `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`);
export const date = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
export const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export function left(ms: number) {
  if (ms <= 0) return 'Expired';
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}
export function ago(now: number, then: number) {
  const d = Math.floor((now - then) / 86_400_000);
  if (d <= 0) return 'today';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export const SECTION_LABEL: Record<Section, string> = { thesis: 'Thesis', positions: 'Positions', rules: 'Rules', evidence: 'Evidence', trades: 'Trades' };
export const SECTION_ORDER: Section[] = ['thesis', 'positions', 'rules', 'evidence', 'trades'];

const P: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  graph: 'M6 4v16M6 8c0 4 6 3 9 6M6 14c0 2 4 2 6 4M15 14a2 2 0 1 0 0-.1M12 18a2 2 0 1 0 0-.1',
  plus: 'M12 5v14M5 12h14',
  key: 'M14.5 9.5a4 4 0 1 1-1.2-2.9 4 4 0 0 1 1.2 2.9zM12 12.5 4 20.5M7 17.5l2 2M5.5 19l1.5 1.5',
  coins: 'M9 10a5 2.5 0 1 0 0-.1M4 10v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4M14 8.5c2.8 0 5 1.1 5 2.5v4c0 1.4-2.2 2.5-5 2.5',
  shield: 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  fork: 'M7 5a2 2 0 1 0 0-.1M17 5a2 2 0 1 0 0-.1M12 19a2 2 0 1 0 0-.1M7 7v2a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V7M12 12v5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  chat: 'M5 5h14v10H9l-4 4z',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5v14l11-7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  flame: 'M12 21c-4 0-6.5-2.6-6.5-6.3 0-3.4 2.4-5.4 3.6-8.7 1.8 1.6 2.4 3.4 2.4 5 1.2-.6 2-2 2.2-3.4 2.3 2 3.8 4.6 3.8 7.1 0 3.7-2.5 6.3-5.5 6.3z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4',
  pie: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  swords: 'M5 19 19 5M15 5h4v4M19 19 5 5M5 9V5h4M7.5 16.5l-2.5 2.5M16.5 16.5l2.5 2.5',
  pr: 'M7 5a2 2 0 1 0 0-.1M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1M7 7v10M17 17V9a3 3 0 0 0-3-3h-4M12 3.5 10 6l2 2.5',
  room: 'M4 6h12v9H8l-4 3zM16 9h4v8l-3-2h-5',
  gem: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16M15 4l-3 16',
  rail: 'M4 6h16M4 12h16M4 18h16',
  swap: 'M5 8h13l-3.5-3.5M19 16H6l3.5 3.5',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4zM4 7V6a2 2 0 0 1 2-2h11M16 13h1',
};
export function Icon({ n, s = 16, w = 1.8 }: { n: string; s?: number; w?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={P[n]} />
    </svg>
  );
}

/** Wordmark glyph: a family tree with one fork. */
export function Logo({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--inv)" />
      <path d="M11 9v14M11 19c0-3.4 3-5 9-5" stroke="var(--on-inv)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="11" cy="9" r="2.8" fill="var(--on-inv)" />
      <circle cx="11" cy="23" r="2.8" fill="var(--on-inv)" />
      <circle cx="21.5" cy="14" r="2.8" fill="var(--on-inv)" />
    </svg>
  );
}

export function Av({ u, size }: { u: User; size?: 'xs' | 'sm' | 'lg' }) {
  return <span className={`av ${u.kind === 'agent' ? 'agent' : ''} ${size ?? ''}`} aria-hidden="true">{u.name[0]}</span>;
}

export function Ret({ v, className }: { v: number; className?: string }) {
  return <span className={`${v >= 0 ? 'gain' : 'loss'} ${className ?? ''}`}>{pct(v)}</span>;
}

export function Verified({ a }: { a?: Attestation }) {
  if (!a) return null;
  return (
    <span className="verified" title={`Signed attestation. Receipt chain head ${a.head.slice(0, 12)}`}>
      <Icon n="shield" s={14} /> {a.seeded ? 'Seeded history' : `Verified from ${a.receipts} receipt${a.receipts === 1 ? '' : 's'}`}
    </span>
  );
}

/** The signature device: sealed content drawn as redaction bars with a stamp. */
export function Redacted({ widths = [92, 78, 85, 60, 72], children }: { widths?: number[]; children?: ReactNode }) {
  return (
    <div className="redacted">
      {widths.map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}
      {children && <div className="stamp"><div>{children}</div></div>}
    </div>
  );
}

export function Toasts() {
  const s = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {s.toasts.slice(-2).map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
    </div>
  );
}

export async function act<T>(fn: () => Promise<T> | T): Promise<T | undefined> {
  try { return await fn(); } catch (e) { engine.toast((e as Error).message, 'bad'); return undefined; }
}

/** Explore has three ways to look at the same network: a ranked list, the family tree, and fork duels. */
export function ExploreViews({ current }: { current: 'explore' | 'lineage' | 'duels' }) {
  const { go } = useUi();
  const views: [typeof current, string, string][] = [['explore', 'List', 'compass'], ['lineage', 'Family tree', 'graph'], ['duels', 'Duels', 'swords']];
  return (
    <div className="viewas" role="group" aria-label="View as">
      <span className="small faint">View as</span>
      <div className="seg2">{views.map(([k, l, ic]) => <button key={k} aria-pressed={current === k} onClick={() => go({ name: k })}><Icon n={ic} s={13} /> {l}</button>)}</div>
    </div>
  );
}
