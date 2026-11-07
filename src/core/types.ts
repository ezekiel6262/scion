import type { Sealed, Box } from './crypto';

export type UserId = string;
export type Persona = 'public' | 'alice' | 'bob';

export interface User {
  id: UserId;
  handle: string;
  name: string;
  kind: 'human' | 'agent';
  bio: string;
  followers: number;
  hue: number;
}

/** Sections are sealed independently so access can be granted section by section. */
export type Section = 'thesis' | 'evidence' | 'positions' | 'rules' | 'trades';
export const SECTIONS: Section[] = ['thesis', 'positions', 'rules', 'evidence', 'trades'];

export type KeyClass = 'view' | 'delayed' | 'live' | 'mirror' | 'fork' | 'thesis' | 'room' | 'api' | 'onetime';
export type Permission = 'read' | 'fork' | 'mirror' | 'room' | 'api';

export interface KeySpec {
  cls: KeyClass;
  label: string;
  what: string;
  sections: Section[];
  permissions: Permission[];
  price: number; // USDC
  days: number;
  delayHours?: number;
  live: boolean; // false = specified in protocol, not built in this slice
}

export interface Holding { asset: string; chain: string; weight: number }
export interface Thesis { claim: string; catalysts: string[]; invalidation: string[]; targets: string[]; confidence: number }
export interface Rules { entry: string[]; exit: string[]; rebalance: string; maxDrawdownPct: number; leverage: number; watch?: WatchCond[] }

/** Machine-checkable invalidation conditions, sealed inside the rules section. */
export type WatchCond =
  | { kind: 'feed-falls'; feed: 'intentsVolume'; weeks: number; label: string }
  | { kind: 'price-drop'; asset: string; pct: number; ref?: number; label: string }
  | { kind: 'drawdown'; pct: number; label: string };
export interface WatchResult { label: string; tripped: boolean; value: string }
/** Public, gateway-signed status. Never names the condition that tripped. */
export interface WatchStatus { sid: string; state: 'holding' | 'invalidated'; at?: number; checks: number; lastCheck: number; sig: string; seeded?: boolean }
export interface DataRow { week: string; volumeM: number }
export interface Evidence { kind?: 'near-intents'; dataset: { name: string; source: string; rows: DataRow[] }; model: { name: string; formula: string; threshold: number } }
export interface Trade { id: string; ts: number; from: string; to: string; fromChain: string; toChain: string; amountIn: number; amountOut: number; price: number; receiptHash: string }

export interface SectionPayloads {
  thesis: Thesis;
  evidence: Evidence;
  positions: { holdings: Holding[]; base?: Holding[] };
  rules: Rules;
  trades: { trades: Trade[] };
}

export interface StrategyVersion {
  v: number;
  ts: number;
  note: string;
  contentHash: string; // hash over ciphertexts: public, binds the version without revealing it
  sealed: Partial<Record<Section, Sealed>>;
}

export interface Strategy {
  id: string;
  owner: UserId;
  title: string;
  summary: string; // public
  tags: string[];
  horizon: string;
  riskScore: number; // 1-10, public
  chains: number; // count only, public
  createdAt: number;
  parent?: { id: string; v: number };
  royaltyBps: number; // upstream share on this strategy's revenue to its parent
  execRoyaltyBps: number; // share of fork notional routed to parent on execution
  versions: StrategyVersion[];
  keys: KeyClass[];
  likes: number;
  comments: number;
  seeded: boolean;
  paper?: boolean; // paper fork: tracked, never executed, never counts as a co-sign
  visibility?: 'public' | 'sealed'; // public: readable and forkable by anyone, still versioned, signed and royalty-bearing
  publicContent?: Partial<SectionPayloads>;
  contributors?: Contributor[]; // merged pull requests earn a share of key revenue
  shares?: RoyaltyShares; // NFT royalty shares issued on this strategy
  seedCosign?: { count: number; usd: number };
  holdingProof?: HoldingProof; // assets already held at publish, signed by the gateway
  pendingBuys?: { asset: string; chain: string; usd: number; weight: number }[]; // buys chosen at publish, not yet settled
  walletFunded?: boolean;
}

/** Public part says only how many assets and when. Units and value stay sealed with the book. */
export interface HoldingProof { count: number; ts: number; wallet: string; digest: string; sig: string }
export interface WalletTrade { id: string; ts: number; from: string; to: string; amountIn: number; amountOut: number; route: string; hash: string; simulated: boolean }

export interface Contributor { user: UserId; prId: string; shareBps: number; title: string }
export interface RoyaltyShares { total: number; price: number; royaltyBps: number; sold: number }

export type AssetClass = 'crypto' | 'meme' | 'stock' | 'cash';

export interface PlayPayload { asset: string; chain: string; entry: number; targetPct: number; stopPct: number; note: string }
export interface Play {
  id: string;
  author: UserId;
  kind: 'play' | 'trench';
  createdAt: number;
  revealAt: number;
  commitHash: string; // sha256(stable(payload) + salt), public from the moment of posting
  sealed: Sealed;
  price: number;
  holders: UserId[];
  status: 'sealed' | 'revealed';
  outcome?: 'open' | 'hit' | 'stopped' | 'exited';
  changePct?: number;
  revealed?: PlayPayload & { salt: string; verified: boolean };
  revealedAt?: number;
  proof?: { receiptHash: string; amountUsd: number };
  exit?: { noticeAt: number; exitAt: number; delayMin: number };
  exitDelayMin: number;
  visibility?: 'public' | 'sealed';
  publicPayload?: PlayPayload; // public calls show the call at once; the seal still proves when it was made
  trophyId?: string;
  seeded: boolean;
}

export interface PullRequest {
  id: string;
  forkId: string;
  parentId: string;
  author: UserId;
  to: UserId;
  title: string;
  createdAt: number;
  status: 'open' | 'merged' | 'closed';
  box: Box; // diff sealed to the parent owner's wallet key
  shareBps: number;
}
export interface Diff { before: Holding[]; after: Holding[]; note: string }

export interface Nft {
  id: string;
  kind: 'royalty-share' | 'trophy';
  owner: UserId;
  mintedAt: number;
  sid?: string;
  amount?: number;
  meta?: { asset: string; gainPct: number; calledAt: number; hitAt: number; commitHash: string; kind: string };
}

/** Back or fade: a free public stance on a thesis or a call, settled by data, never by vote. */
export type Side = 'back' | 'fade';
export interface Stance { uid: UserId; side: Side; ts: number; result?: 'right' | 'wrong' }
export interface Sentiment { stances: Stance[]; seed?: { back: number; fade: number }; settled?: { winner: Side; at: number; reason: string } }
export interface Record_ { right: number; wrong: number; seeded?: { right: number; wrong: number } }

export interface Notice { id: string; to: UserId; ts: number; text: string; read: boolean }
export interface RoomMsg { id: string; who: UserId; ts: number; text: string }
export interface PortfolioHolding { asset: string; units: number; cost: number }
export interface Portfolio { connected: boolean; holdings: PortfolioHolding[]; navs: number[]; trades?: WalletTrade[] }

export interface CapabilityPayload {
  grantId: string;
  strategyId: string;
  holder: UserId;
  holderKey: string; // thumbprint of holder ECDH key: capability is bound to it
  cls: KeyClass;
  sections: Section[];
  permissions: Permission[];
  issuedAt: number;
  expiresAt: number;
  delayHours?: number;
}

export interface Grant {
  id: string;
  payload: CapabilityPayload;
  sig: string; // gateway ECDSA signature
  price: number;
  revoked: boolean;
}

export interface GatewayEvent {
  id: string;
  ts: number;
  grantId: string;
  requester: UserId;
  strategyId: string;
  decision: 'released' | 'denied';
  reason: string;
  sections: Section[];
}

export interface Attestation {
  strategyId: string;
  epoch: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  winRate: number;
  receipts: number;
  head: string; // receipt hash-chain head
  historyDays: number;
  sig: string;
  seeded: boolean;
  paper?: boolean;
}

export interface Commitment { strategyId: string; hash: string; epoch: number }

export interface LedgerEntry { id: string; ts: number; from: UserId; to: UserId; amount: number; memo: string; kind: 'key' | 'royalty' | 'protocol' | 'exec-royalty' | 'contributor' | 'share-payout' | 'share-sale' | 'play-access' }

export interface RiskPolicy {
  capital: number;
  maxPositionPct: number;
  allowedAssets: string[];
  allowedChains: string[];
  maxSlippageBps: number;
  dailyLossPct: number;
  maxLeverage: number;
  copyDelayMin: number;
  sizing: 'proportional' | 'fixed';
  manualConfirm: boolean;
}

export interface Unlocked { grantId: string; fetchedAt: number; data: Partial<SectionPayloads> }

export interface Book { cash: number; units: Record<string, number>; capital: number; peak: number; trough: number }

export interface Toast { id: string; text: string; tone: 'ok' | 'warn' | 'bad' }

export type { Sealed, Box };
