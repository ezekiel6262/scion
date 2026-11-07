import type { AssetClass, Holding, KeySpec, RiskPolicy } from './types';

export const KEY_SPECS: KeySpec[] = [
  { cls: 'view', label: 'View Key', what: 'Current thesis and position snapshot', sections: ['thesis', 'positions'], permissions: ['read'], price: 2, days: 7, live: true },
  { cls: 'delayed', label: 'Delayed Key', what: 'Trades after a 24 hour delay, plus positions', sections: ['positions', 'trades'], permissions: ['read'], price: 3, days: 30, delayHours: 24, live: true },
  { cls: 'live', label: 'Live Key', what: 'Trades as they settle, plus positions', sections: ['positions', 'trades'], permissions: ['read'], price: 12, days: 30, live: true },
  { cls: 'fork', label: 'Fork Key', what: 'Thesis, positions and rules, with the right to fork', sections: ['thesis', 'positions', 'rules'], permissions: ['read', 'fork'], price: 5, days: 7, live: true },
  { cls: 'thesis', label: 'Thesis Key', what: 'Full thesis, dataset and re-runnable model', sections: ['thesis', 'evidence'], permissions: ['read'], price: 4, days: 30, live: true },
  { cls: 'mirror', label: 'Mirror Key', what: 'Automated copying inside your limits', sections: ['positions', 'rules', 'trades'], permissions: ['read', 'mirror'], price: 15, days: 30, live: false },
  { cls: 'room', label: 'Room Code', what: 'Join the strategist’s private room', sections: ['thesis'], permissions: ['room'], price: 6, days: 30, live: false },
  { cls: 'api', label: 'API Key', what: 'Programmatic feed for terminals and agents', sections: ['positions', 'rules', 'trades'], permissions: ['read', 'api'], price: 25, days: 30, live: false },
  { cls: 'onetime', label: 'One-time Code', what: 'Unlock a single research drop', sections: ['evidence'], permissions: ['read'], price: 1, days: 1, live: false },
];

export const spec = (cls: string) => KEY_SPECS.find((k) => k.cls === cls)!;

export const ASSETS: Record<string, { chain: string; name: string; cls: AssetClass }> = {
  NEAR: { chain: 'near', name: 'NEAR', cls: 'crypto' },
  BTC: { chain: 'bitcoin', name: 'Bitcoin', cls: 'crypto' },
  ETH: { chain: 'ethereum', name: 'Ether', cls: 'crypto' },
  SOL: { chain: 'solana', name: 'Solana', cls: 'crypto' },
  ZEC: { chain: 'zcash', name: 'Zcash', cls: 'crypto' },
  MOTH: { chain: 'near', name: 'Moth (demo memecoin)', cls: 'meme' },
  GRUB: { chain: 'solana', name: 'Grub (demo memecoin)', cls: 'meme' },
  NVDAx: { chain: 'solana', name: 'Tokenized NVIDIA', cls: 'stock' },
  TSLAx: { chain: 'solana', name: 'Tokenized Tesla', cls: 'stock' },
  USDC: { chain: 'base', name: 'USD Coin', cls: 'cash' },
  'USDC.n': { chain: 'near', name: 'USD Coin on NEAR', cls: 'cash' },
};
export const CLASS_LABEL: Record<AssetClass, string> = { crypto: 'Crypto', meme: 'Trench', stock: 'Tokenized stock', cash: 'Cash' };

export const defaultPolicy = (): RiskPolicy => ({
  capital: 2500,
  maxPositionPct: 35,
  allowedAssets: ['NEAR', 'BTC', 'ETH', 'SOL', 'USDC'],
  allowedChains: ['near', 'bitcoin', 'ethereum', 'solana', 'base'],
  maxSlippageBps: 50,
  dailyLossPct: 5,
  maxLeverage: 1,
  copyDelayMin: 0,
  sizing: 'proportional',
  manualConfirm: true,
});

export interface PlannedOrder { asset: string; chain: string; usd: number; weight: number }
export interface PolicyResult { orders: PlannedOrder[]; notes: string[]; blocked: string[]; cashWeight: number }

/**
 * Apply the follower's own limits to a target allocation. The follower's policy
 * always wins over the creator's allocation: disallowed assets go to cash,
 * oversize positions are clipped, leverage above the cap blocks execution.
 */
export function applyPolicy(holdings: Holding[], policy: RiskPolicy, leverage = 1): PolicyResult {
  const notes: string[] = [];
  const blocked: string[] = [];
  const total = holdings.reduce((a, h) => a + h.weight, 0);
  if (Math.abs(total - 100) > 0.5) blocked.push(`Allocation adds up to ${total.toFixed(1)}%. Adjust it to 100% to continue.`);
  if (leverage > policy.maxLeverage) blocked.push(`Strategy uses ${leverage}x leverage, your limit is ${policy.maxLeverage}x.`);
  let cash = 0;
  const orders: PlannedOrder[] = [];
  for (const h of holdings) {
    if (h.asset === 'USDC') { cash += h.weight; continue; }
    if (!policy.allowedAssets.includes(h.asset)) { notes.push(`${h.asset} is not in your allowed assets, so its ${h.weight}% stays in USDC.`); cash += h.weight; continue; }
    if (!policy.allowedChains.includes(h.chain)) { notes.push(`${h.chain} is not an allowed chain, so ${h.asset} stays in USDC.`); cash += h.weight; continue; }
    let w = h.weight;
    if (w > policy.maxPositionPct) { notes.push(`${h.asset} clipped from ${w}% to your ${policy.maxPositionPct}% position cap.`); cash += w - policy.maxPositionPct; w = policy.maxPositionPct; }
    orders.push({ asset: h.asset, chain: h.chain, weight: w, usd: +(policy.capital * w / 100).toFixed(2) });
  }
  if (policy.capital <= 0) blocked.push('Set the capital you want to allocate.');
  return { orders, notes, blocked, cashWeight: cash };
}
