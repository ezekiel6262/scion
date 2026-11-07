import { b64, boxFor, exportPub, newBoxKeys, newDek, newSigner, open, seal, sha256, sign, stable, unbox, verify, type Box } from './crypto';
import { SimulatedIntents, type Quote, type SolverReceipt } from './intents';
import { ASSETS, spec } from './policy';
import { DAY, FEED_PATH, HOUR, INTENTS_DATASET, MARKET_PATH, PRICES, SEED_PORTFOLIOS, SEED_ROOMS, SEED_STRATEGIES, START, USERS, type Draft } from './seed';
import type {
  Attestation, Book, CapabilityPayload, Commitment, GatewayEvent, Grant, Holding, KeyClass, LedgerEntry,
  Persona, Section, SectionPayloads, Strategy, Toast, Unlocked, User, UserId,
  Play, PlayPayload, PullRequest, Diff, Nft, Notice, RoomMsg, Portfolio, Sealed, Rules, WatchCond, WatchResult, WatchStatus, DataRow, HoldingProof, WalletTrade, Side, Sentiment, Record_,
} from './types';

export interface State {
  ready: boolean;
  persona: Persona;
  clock: number;
  tick: number;
  prices: Record<string, number>;
  users: Record<UserId, User>;
  strategies: Record<string, Strategy>;
  grants: Record<string, Grant>;
  attestations: Record<string, Attestation>;
  commitments: Commitment[];
  ledger: LedgerEntry[];
  balances: Record<UserId, number>;
  gatewayLog: GatewayEvent[];
  /** Client-side views, per user. The UI only ever reads views[currentUser]. */
  views: Record<UserId, Record<string, Unlocked>>;
  following: Record<UserId, string[]>;
  toasts: Toast[];
  lineageSeen: boolean;
  gatewayPub?: JsonWebKey;
  plays: Record<string, Play>;
  playViews: Record<UserId, Record<string, PlayPayload>>;
  prs: Record<string, PullRequest>;
  prViews: Record<UserId, Record<string, Diff>>;
  nfts: Record<string, Nft>;
  notices: Notice[];
  roomCounts: Record<string, number>;
  portfolios: Record<UserId, Portfolio>;
  tried: Record<string, boolean>;
  watches: Record<string, WatchStatus>;
  feed: DataRow[];
  sentiment: Record<string, Sentiment>; // keyed by play id or strategy id
  records: Record<UserId, Record_>;
}

const PROTOCOL = 'protocol';
const PROTOCOL_BPS = 500; // 5% protocol fee on access revenue
export const personaUser = (p: Persona): UserId | null => (p === 'public' ? null : p);
const id = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;

async function thumbprint(pub: CryptoKey) {
  const j = await exportPub(pub);
  return (await sha256(`${j.crv}:${j.x}:${j.y}`)).slice(0, 16);
}

export class Engine {
  state: State = {
    ready: false, persona: 'public', clock: START, tick: 0, prices: { ...PRICES },
    users: Object.fromEntries(USERS.map((u) => [u.id, u])), strategies: {}, grants: {}, attestations: {}, commitments: [],
    ledger: [], balances: { alice: 20, bob: 100, tunde: 0, maren: 0, kestrel: 40, [PROTOCOL]: 0 }, gatewayLog: [], views: {},
    following: { bob: ['tunde'], alice: ['maren'] }, toasts: [], lineageSeen: false,
    plays: {}, playViews: {}, prs: {}, prViews: {}, nfts: {}, notices: [], roomCounts: {}, portfolios: {}, tried: {}, watches: {}, feed: [...INTENTS_DATASET], sentiment: {}, records: {},
  };
  private listeners = new Set<() => void>();

  // ---- secrets: never placed in state, never rendered ----
  private wallets = new Map<UserId, CryptoKeyPair>(); // each user's ECDH keypair (client side)
  private gateway!: CryptoKeyPair; // access gateway signing key (sim TEE)
  private enclave = new Map<string, Map<Section, CryptoKey>>(); // DEKs escrowed in the gateway (sim TEE)
  private vaults = new Map<UserId, Map<string, Map<Section, CryptoKey>>>(); // owner-held DEKs
  private books = new Map<string, Book & { navs: number[] }>(); // per-strategy book, inside the gateway
  private heads = new Map<string, string>(); // receipt hash-chain heads
  private oneTimeUsed = new Set<string>();
  private playSecrets = new Map<string, { dek: CryptoKey; salt: string }>(); // inside the gateway
  private rooms = new Map<string, RoomMsg[]>(); // room messages, released only to key holders
  readonly intents = new SimulatedIntents();

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getState = () => this.state;
  private set(patch: Partial<State> | ((s: State) => Partial<State>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }
  toast(text: string, tone: Toast['tone'] = 'ok') {
    const t = { id: id('t'), text, tone };
    this.set((s) => ({ toasts: [...s.toasts, t] }));
    setTimeout(() => this.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 4200);
  }

  private booting?: Promise<void>;
  init() { return (this.booting ??= this.boot()); }
  private async boot() {
    this.gateway = await newSigner();
    for (const u of USERS) this.wallets.set(u.id, await newBoxKeys());
    const strategies: Record<string, Strategy> = {};
    const attestations: Record<string, Attestation> = {};
    for (const s of SEED_STRATEGIES) {
      const { strategy } = await this.sealStrategy({
        id: s.id, owner: s.owner, draft: { visibility: s.visibility, title: s.title, summary: s.summary, tags: s.tags, horizon: s.horizon, riskScore: s.riskScore, royaltyBps: 1000, execRoyaltyBps: 10, keys: s.keys, content: s.content },
        parent: s.parent ? { id: s.parent, v: 1 } : undefined, createdAt: START - s.ageDays * DAY, seeded: true, chains: s.chains,
      });
      strategy.likes = s.likes; strategy.comments = s.comments;
      if (s.cosign) strategy.seedCosign = s.cosign;
      strategies[s.id] = strategy;
      const head = await sha256(`seed:${s.id}`);
      const body = { strategyId: s.id, epoch: 0, ...s.stats, head, historyDays: s.ageDays, seeded: true };
      attestations[s.id] = { ...body, sig: await sign(this.gateway.privateKey, body) };
    }
    strategies.s_barbell.shares = { total: 100, price: 3, royaltyBps: 4000, sold: 12 };
    const seedNft: Nft = { id: 'nft_seed1', kind: 'royalty-share', owner: 'kestrel', mintedAt: START - 40 * DAY, sid: 's_barbell', amount: 12 };
    for (const [sid, msgs] of Object.entries(SEED_ROOMS)) this.rooms.set(sid, msgs.map((m, i) => ({ id: `m_${sid}_${i}`, who: m.who, ts: START - m.hoursAgo * HOUR, text: m.text })));
    this.set({
      ready: true, strategies, attestations, gatewayPub: await exportPub(this.gateway.publicKey), nfts: { [seedNft.id]: seedNft },
      roomCounts: Object.fromEntries([...this.rooms].map(([k, v]) => [k, v.length])),
    });
    await this.seedPlays();
    const pw = { sid: 's_privacy', state: 'invalidated' as const, at: START - 3 * DAY, checks: 38, lastCheck: START, seeded: true };
    const hw = { sid: 's_barbell', state: 'holding' as const, checks: 210, lastCheck: START, seeded: true };
    this.seedSentiment();
    const nw = { sid: 's_near', state: 'holding' as const, checks: 23, lastCheck: START, seeded: true };
    this.set({ watches: { s_privacy: { ...pw, sig: await sign(this.gateway.privateKey, pw) }, s_barbell: { ...hw, sig: await sign(this.gateway.privateKey, hw) }, s_near: { ...nw, sig: await sign(this.gateway.privateKey, nw) } } });
  }

  private async seedPlays() {
    const entry = 4.31;
    const t = await this.createPlay('tunde', { kind: 'play', asset: 'NEAR', targetPct: 6, stopPct: 8, hours: 72, note: 'Breakout above the range with intents volume confirming.', price: 1, exitDelayMin: 0 }, START - 9 * DAY, true, entry);
    await this.revealPlay(t, 'hit', +(((PRICES.NEAR - entry) / entry) * 100).toFixed(1), START - 6 * DAY);
    await this.createPlay('kestrel', { kind: 'trench', asset: 'GRUB', targetPct: 40, stopPct: 25, hours: 48, note: 'Holder count doubling, liquidity locked.', price: 2, exitDelayMin: 15, proofUsd: 150 }, START - 5 * HOUR, true);
    await this.createPlay('maren', { kind: 'play', asset: 'NVDAx', targetPct: 8, stopPct: 5, hours: 96, note: 'Earnings drift into the print.', price: 0, exitDelayMin: 0, visibility: 'public' }, START - 2 * HOUR, true);
  }

  me() { return personaUser(this.state.persona); }
  setPersona(p: Persona) { this.set({ persona: p }); this.syncAccess(); }

  // ------------------------------------------------------------------ publishing
  private async sealStrategy(o: { id: string; owner: UserId; draft: Draft; parent?: { id: string; v: number }; createdAt: number; seeded: boolean; chains?: number }) {
    const deks = new Map<Section, CryptoKey>();
    const sealed: Strategy['versions'][0]['sealed'] = {};
    const isPublic = o.draft.visibility === 'public';
    if (!isPublic) {
      for (const [sec, payload] of Object.entries(o.draft.content) as [Section, unknown][]) {
        const k = await newDek();
        deks.set(sec, k);
        sealed[sec] = await seal(k, payload);
      }
      this.enclave.set(o.id, deks);
      if (!this.vaults.has(o.owner)) this.vaults.set(o.owner, new Map());
      this.vaults.get(o.owner)!.set(o.id, deks);
    }
    const holdings = (o.draft.content.positions?.holdings ?? []) as Holding[];
    const strategy: Strategy = {
      id: o.id, owner: o.owner, title: o.draft.title, summary: o.draft.summary, tags: o.draft.tags, horizon: o.draft.horizon,
      riskScore: o.draft.riskScore, chains: o.chains ?? new Set(holdings.map((h) => h.chain)).size, createdAt: o.createdAt, parent: o.parent,
      royaltyBps: o.draft.royaltyBps, execRoyaltyBps: o.draft.execRoyaltyBps,
      versions: [{ v: 1, ts: o.createdAt, note: o.parent ? 'Forked' : 'Initial publish', contentHash: await sha256(stable(isPublic ? o.draft.content : sealed)), sealed }],
      keys: isPublic ? [] : o.draft.keys as KeyClass[], likes: 0, comments: 0, seeded: o.seeded,
      visibility: isPublic ? 'public' : 'sealed', publicContent: isPublic ? o.draft.content : undefined,
    };
    return { strategy, deks };
  }

  async publish(draft: Draft, parent?: { id: string; v: number }, capital = 10_000, paper = false,
    setup?: { held?: { asset: string; units: number }[]; buys?: { asset: string; chain: string; usd: number; weight: number }[]; walletFunded?: boolean }) {
    const owner = this.me();
    if (!owner) throw new Error('Switch to a wallet to publish.');
    const sid = id('s');
    const rules = draft.content.rules;
    if (rules?.watch) draft = { ...draft, content: { ...draft.content, rules: { ...rules, watch: rules.watch.map((c) => (c.kind === 'price-drop' ? { ...c, ref: this.state.prices[c.asset] } : c)) } } };
    const { strategy } = await this.sealStrategy({ id: sid, owner, draft, parent, createdAt: this.state.clock, seeded: false });
    if (draft.content.rules?.watch?.length) await this.putWatch({ sid, state: 'holding', checks: 0, lastCheck: this.state.clock });
    if (paper) strategy.paper = true;
    const units: Record<string, number> = {};
    let heldValue = 0;
    if (setup?.held?.length) {
      const p = this.state.portfolios[owner];
      if (!p) throw new Error('Connect your wallet to use tokens you already hold.');
      for (const h of setup.held) {
        const have = p.holdings.find((x) => x.asset === h.asset)?.units ?? 0;
        if (h.units <= 0 || h.units > have + 1e-9) throw new Error(`Your wallet holds ${have} ${h.asset}. Choose up to that amount.`);
        units[h.asset] = (units[h.asset] ?? 0) + h.units;
        heldValue += h.units * this.state.prices[h.asset];
      }
      const body = { sid, count: setup.held.length, ts: this.state.clock, wallet: this.state.users[owner].handle, digest: await sha256(stable(setup.held)) };
      const proof: HoldingProof = { count: body.count, ts: body.ts, wallet: body.wallet, digest: body.digest, sig: await sign(this.gateway.privateKey, body) };
      strategy.holdingProof = proof;
    }
    if (setup?.buys?.length) strategy.pendingBuys = setup.buys;
    if (setup?.walletFunded) {
      const need = capital - heldValue;
      if (this.cashIn(owner) + 1e-6 < need) throw new Error(`Your wallet has ${this.cashIn(owner).toFixed(2)} USDC. This strategy needs ${need.toFixed(2)} for buys and reserve.`);
      strategy.walletFunded = true;
    }
    this.books.set(sid, { cash: capital - heldValue, units, capital, peak: capital, trough: capital, navs: [capital] });
    this.heads.set(sid, '0'.repeat(64));
    const att = await this.attest(sid, 0);
    this.set((s) => ({ strategies: { ...s.strategies, [sid]: strategy }, attestations: { ...s.attestations, [sid]: { ...att, paper } } }));
    await this.ownerView(sid);
    if (paper) { this.toast('Paper fork published. It tracks results without executing.'); return sid; }
    this.toast(parent ? 'Fork published. Your sections are sealed with your own keys.' : 'Strategy published. Every private section is sealed.');
    return sid;
  }

  /** Owners read their own strategy with keys they hold. No gateway involved. */
  async ownerView(sid: string) {
    const owner = this.me();
    const pst = this.state.strategies[sid];
    if (pst?.visibility === 'public') { if (owner === pst.owner) this.putView(owner, sid, { grantId: 'owner', fetchedAt: this.state.clock, data: pst.publicContent ?? {} }); return; }
    const deks = owner ? this.vaults.get(owner)?.get(sid) : undefined;
    if (!owner || !deks) return;
    const latest = this.state.strategies[sid].versions.at(-1)!;
    const data: Partial<SectionPayloads> = {};
    for (const [sec, sealed] of Object.entries(latest.sealed) as [Section, any][]) (data as any)[sec] = await open(deks.get(sec)!, sealed);
    this.putView(owner, sid, { grantId: 'owner', fetchedAt: this.state.clock, data });
  }

  private putView(uid: UserId, sid: string, u: Unlocked | null) {
    this.set((s) => {
      const mine = { ...(s.views[uid] ?? {}) };
      if (u) mine[sid] = u; else delete mine[sid];
      return { views: { ...s.views, [uid]: mine } };
    });
  }

  // ------------------------------------------------------------------ access keys
  async buyKey(sid: string, cls: KeyClass) {
    const holder = this.me();
    const st = this.state.strategies[sid];
    if (!holder) throw new Error('Switch to a wallet to buy a key.');
    if (holder === st.owner) throw new Error('You already own this strategy.');
    if (st.visibility === 'public') throw new Error('This portfolio is public. Read and fork it free.');
    const ks = spec(cls);
    if (!ks.live) throw new Error(`${ks.label} is specified in the protocol and ships in a later milestone.`);
    if ((this.state.balances[holder] ?? 0) < ks.price) throw new Error(`You need ${ks.price} USDC. Your balance is ${this.state.balances[holder].toFixed(2)} USDC.`);
    this.pay(holder, sid, ks.price, `${ks.label} for “${st.title}”`);
    const payload: CapabilityPayload = {
      grantId: id('g'), strategyId: sid, holder, holderKey: await thumbprint(this.wallets.get(holder)!.publicKey), cls,
      sections: ks.sections, permissions: ks.permissions, issuedAt: this.state.clock, expiresAt: this.state.clock + ks.days * DAY, delayHours: ks.delayHours,
    };
    const grant: Grant = { id: payload.grantId, payload, sig: await sign(this.gateway.privateKey, payload), price: ks.price, revoked: false };
    this.set((s) => ({ grants: { ...s.grants, [grant.id]: grant } }));
    this.toast(`${ks.label} issued. It expires in ${ks.days} days.`);
    await this.release(grant.id);
    return grant.id;
  }

  /** A batch of ledger moves from one payer, committed together. */
  private mover(from: UserId) {
    const entries: LedgerEntry[] = [];
    const bal = { ...this.state.balances };
    const move = (to: UserId, amt: number, kind: LedgerEntry['kind'], m: string) => {
      amt = +amt.toFixed(4);
      if (amt <= 0) return;
      bal[from] = +(bal[from] - amt).toFixed(4); bal[to] = +((bal[to] ?? 0) + amt).toFixed(4);
      entries.push({ id: id('l'), ts: this.state.clock, from, to, amount: amt, memo: m, kind });
    };
    const commit = () => this.set((s) => ({ balances: bal, ledger: [...entries.reverse(), ...s.ledger] }));
    return { move, commit };
  }

  /** Royalty income into a strategy: NFT royalty-share holders take their pro-rata cut first. */
  private credit(st: Strategy, amount: number, kind: LedgerEntry['kind'], memo: string, move: ReturnType<Engine['mover']>['move']) {
    const sh = st.shares;
    if (sh && sh.sold > 0) {
      const pool = amount * sh.royaltyBps / 10000;
      for (const n of Object.values(this.state.nfts).filter((x) => x.kind === 'royalty-share' && x.sid === st.id)) {
        const amt = pool * (n.amount! / sh.total);
        move(n.owner, amt, 'share-payout', `Royalty share payout from “${st.title}”`);
        amount -= +amt.toFixed(4);
      }
    }
    move(st.owner, amount, kind, memo);
  }

  /** Key revenue: protocol fee, royalties up the lineage, contributor shares from merged pull requests, then the creator. */
  private pay(from: UserId, sid: string, amount: number, memo: string) {
    const { move, commit } = this.mover(from);
    const fee = amount * PROTOCOL_BPS / 10000;
    move(PROTOCOL, fee, 'protocol', `Protocol fee on ${memo}`);
    let remaining = amount - fee;
    let node = this.state.strategies[sid];
    while (node.parent) {
      const parent = this.state.strategies[node.parent.id];
      const share = remaining * parent.royaltyBps / 10000; // parent's terms, set by its creator
      this.credit(parent, share, 'royalty', `Royalty from fork “${node.title}”`, move);
      remaining -= share;
      node = parent;
    }
    const st = this.state.strategies[sid];
    const base = remaining;
    for (const c of st.contributors ?? []) {
      const amt = base * c.shareBps / 10000;
      move(c.user, amt, 'contributor', `Improver share on “${st.title}” for “${c.title}”`);
      remaining -= amt;
    }
    move(st.owner, remaining, 'key', memo);
    commit();
  }

  async revoke(grantId: string) {
    const g = this.state.grants[grantId];
    if (this.me() !== this.state.strategies[g.payload.strategyId].owner) throw new Error('Only the strategy owner can revoke a key.');
    this.set((s) => ({ grants: { ...s.grants, [grantId]: { ...g, revoked: true } } }));
    this.log(g, this.me()!, 'denied', 'Revoked by owner. Future releases are refused.', []);
    this.toast('Key revoked. The holder loses access on their next sync.', 'warn');
  }

  private log(g: Grant, requester: UserId, decision: GatewayEvent['decision'], reason: string, sections: Section[]) {
    const e: GatewayEvent = { id: id('e'), ts: this.state.clock, grantId: g.id, requester, strategyId: g.payload.strategyId, decision, reason, sections };
    this.set((s) => ({ gatewayLog: [e, ...s.gatewayLog] }));
  }

  /**
   * The access gateway (simulated TEE). It verifies the capability, checks holder
   * binding, revocation and expiry, then decrypts only the permitted sections,
   * applies delay filters, and re-seals each to the holder's ECDH key.
   * It never returns a DEK.
   */
  async gatewayRelease(grantId: string, requester: UserId): Promise<{ ok: true; boxes: Partial<Record<Section, Box>> } | { ok: false; reason: string }> {
    const g = this.state.grants[grantId];
    if (!g) return { ok: false, reason: 'Unknown key.' };
    const deny = (reason: string) => { this.log(g, requester, 'denied', reason, []); return { ok: false as const, reason }; };
    if (!(await verify(this.gateway.publicKey, g.payload, g.sig))) return deny('Signature check failed. The key was altered.');
    if (g.payload.holder !== requester) return deny('This key belongs to another wallet.');
    if (g.payload.holderKey !== (await thumbprint(this.wallets.get(requester)!.publicKey))) return deny('Key is bound to a different device key.');
    if (g.revoked) return deny('Revoked by owner.');
    if (this.state.clock > g.payload.expiresAt) return deny('Expired.');
    if (g.payload.cls === 'onetime' && this.oneTimeUsed.has(g.id)) return deny('One-time code already used.');
    const st = this.state.strategies[g.payload.strategyId];
    const latest = st.versions.at(-1)!;
    const deks = this.enclave.get(st.id)!;
    const boxes: Partial<Record<Section, Box>> = {};
    const released: Section[] = [];
    for (const sec of g.payload.sections) {
      const sealed = latest.sealed[sec];
      if (!sealed) continue;
      let data: any = await open(deks.get(sec)!, sealed);
      if (sec === 'trades' && g.payload.delayHours) {
        const cutoff = this.state.clock - g.payload.delayHours * HOUR;
        data = { trades: data.trades.filter((t: any) => t.ts <= cutoff), delayedUntil: cutoff };
      }
      boxes[sec] = await boxFor(this.wallets.get(requester)!.publicKey, data);
      released.push(sec);
    }
    if (g.payload.cls === 'onetime') this.oneTimeUsed.add(g.id);
    this.log(g, requester, 'released', `Re-sealed ${released.length} section${released.length === 1 ? '' : 's'} to holder key`, released);
    return { ok: true, boxes };
  }

  /** Client side: request a release and decrypt it with this wallet's private key. */
  async release(grantId: string) {
    const me = this.me();
    if (!me) return;
    const res = await this.gatewayRelease(grantId, me);
    const sid = this.state.grants[grantId]?.payload.strategyId;
    if (!res.ok) { if (sid) this.putView(me, sid, null); throw new Error(`Access refused: ${res.reason}`); }
    const data: Partial<SectionPayloads> = {};
    for (const [sec, box] of Object.entries(res.boxes) as [Section, Box][]) (data as any)[sec] = await unbox(this.wallets.get(me)!.privateKey, box);
    const prev = this.state.views[me]?.[sid!];
    this.putView(me, sid!, { grantId, fetchedAt: this.state.clock, data: { ...(prev?.grantId !== 'owner' ? prev?.data : {}), ...data } });
  }

  activeGrants(uid: UserId | null, sid?: string) {
    if (!uid) return [];
    return Object.values(this.state.grants).filter((g) => g.payload.holder === uid && (!sid || g.payload.strategyId === sid) && !g.revoked && this.state.clock <= g.payload.expiresAt);
  }

  /** Client sync: drop cached views whose keys are no longer valid. */
  syncAccess() {
    const me = this.me();
    if (!me) return;
    for (const [sid, v] of Object.entries(this.state.views[me] ?? {})) {
      if (v.grantId === 'owner') continue;
      const valid = this.activeGrants(me, sid);
      if (valid.length === 0) {
        this.putView(me, sid, null);
        this.toast('A key ended, so this wallet dropped its cached view. Copies you already made stay with you.', 'warn');
      }
    }
  }

  // ------------------------------------------------------------------ execution
  async quoteOrders(sid: string, orders: { asset: string; chain: string; usd: number }[], slippageBps: number) {
    const me = this.me()!;
    return Promise.all(orders.map((o) => this.intents.quote({ fromAsset: 'USDC', fromChain: 'base', toAsset: o.asset, toChain: o.chain, amountUsd: o.usd, slippageBps, wallet: this.state.users[me].handle }, this.state.prices, this.state.clock)));
  }

  /** Settle signed intents. Updates the private book, sealed trade log, and public commitments only. */
  async settle(sid: string, quotes: Quote[]): Promise<SolverReceipt[]> {
    const me = this.me()!;
    const st = this.state.strategies[sid];
    if (st.owner !== me) throw new Error('Only the strategy’s owner can execute it.');
    const book = this.books.get(sid)!;
    const receipts: SolverReceipt[] = [];
    let head = this.heads.get(sid)!;
    for (const q of quotes) {
      if (book.cash < q.req.amountUsd - 0.01) throw new Error('Not enough USDC in this book for that order.');
      const r = await this.intents.settle(q, head, this.state.clock);
      head = r.hash;
      book.cash -= q.req.amountUsd;
      book.units[q.req.toAsset] = (book.units[q.req.toAsset] ?? 0) + r.amountOut;
      receipts.push(r);
    }
    if (st.walletFunded) for (const r of receipts) this.walletMove(me, [['USDC', -r.amountIn], [r.to, r.amountOut]], r.price);
    this.heads.set(sid, head);
    const newTrades = receipts.map((r) => ({ id: r.quoteId, ts: r.ts, from: r.from, to: r.to, fromChain: r.fromChain, toChain: r.toChain, amountIn: r.amountIn, amountOut: r.amountOut, price: r.price, receiptHash: r.hash }));
    if (st.visibility === 'public') {
      const pc = st.publicContent ?? {};
      const trades = { trades: [...(pc.trades?.trades ?? []), ...newTrades] };
      this.set((s) => ({ strategies: { ...s.strategies, [sid]: { ...st, publicContent: { ...pc, trades }, pendingBuys: undefined } }, commitments: [...receipts.map((r) => ({ strategyId: sid, hash: r.hash, epoch: s.tick })), ...s.commitments] }));
      await this.afterSettle(me, st, quotes, sid);
      return receipts;
    }
    // append to the sealed trade log, re-encrypted with the same section key
    const deks = this.enclave.get(sid)!;
    const latest = st.versions.at(-1)!;
    const log = latest.sealed.trades ? await open<any>(deks.get('trades')!, latest.sealed.trades) : { trades: [] };
    log.trades.push(...receipts.map((r) => ({ id: r.quoteId, ts: r.ts, from: r.from, to: r.to, fromChain: r.fromChain, toChain: r.toChain, amountIn: r.amountIn, amountOut: r.amountOut, price: r.price, receiptHash: r.hash })));
    if (!deks.has('trades')) { const k = await newDek(); deks.set('trades', k); this.vaults.get(st.owner)!.get(sid)!.set('trades', k); }
    const sealedTrades = await seal(deks.get('trades')!, log);
    const versions = [...st.versions.slice(0, -1), { ...latest, sealed: { ...latest.sealed, trades: sealedTrades } }];
    const epoch = this.state.tick;
    this.set((s) => ({
      strategies: { ...s.strategies, [sid]: { ...st, versions, pendingBuys: undefined } },
      commitments: [...receipts.map((r) => ({ strategyId: sid, hash: r.hash, epoch })), ...s.commitments],
    }));
    // execution royalty to the parent's owner, paid by the executor
    await this.afterSettle(me, st, quotes, sid);
    return receipts;
  }

  /** Execution royalty to the parent, refresh the owner's view, re-attest. */
  private async afterSettle(me: UserId, st: Strategy, quotes: Quote[], sid: string) {
    const parentSt = st.parent ? this.state.strategies[st.parent.id] : undefined;
    if (parentSt && parentSt.execRoyaltyBps > 0) {
      const notional = quotes.reduce((a, q) => a + q.req.amountUsd, 0);
      const amt = +(notional * parentSt.execRoyaltyBps / 10000).toFixed(4);
      const { move, commit } = this.mover(me);
      this.credit(parentSt, amt, 'exec-royalty', `Execution royalty, ${parentSt.execRoyaltyBps} bps of ${notional.toFixed(0)} USDC fork notional`, move);
      commit();
    }
    await this.ownerView(sid);
    await this.closeEpoch([sid]);
  }

  /** Owner-only: capital and cash in this strategy's book. */
  bookSummary(sid: string) {
    const b = this.books.get(sid);
    if (!b || this.me() !== this.state.strategies[sid]?.owner) return null;
    return { capital: b.capital, cash: +b.cash.toFixed(2), nav: +this.nav(sid).toFixed(2) };
  }

  private nav(sid: string) {
    const b = this.books.get(sid)!;
    return b.cash + Object.entries(b.units).reduce((a, [k, u]) => a + u * this.state.prices[k], 0);
  }

  /** Gateway computes and signs public stats from the private book. Only aggregates leave. */
  private async attest(sid: string, epoch: number): Promise<Attestation> {
    const b = this.books.get(sid)!;
    const nav = this.nav(sid);
    const navs = b.navs;
    let peak = navs[0], mdd = 0;
    for (const n of [...navs, nav]) { peak = Math.max(peak, n); mdd = Math.max(mdd, (peak - n) / peak); }
    const rets = navs.slice(1).map((n, i) => n / navs[i] - 1);
    const mean = rets.reduce((a, r) => a + r, 0) / (rets.length || 1);
    const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length || 1)) || 1;
    const holdings = Object.entries(b.units);
    const st = this.state.strategies[sid];
    const body = {
      strategyId: sid, epoch,
      returnPct: +((nav / b.capital - 1) * 100).toFixed(2),
      maxDrawdownPct: +(mdd * 100).toFixed(2),
      sharpe: rets.length >= 7 ? +((mean / sd) * Math.sqrt(365)).toFixed(2) : 0, // too noisy under a week of data
      winRate: holdings.length ? +(holdings.filter(([k]) => this.state.prices[k] >= PRICES[k]).length / holdings.length).toFixed(2) : 0,
      receipts: this.state.commitments.filter((c) => c.strategyId === sid).length,
      head: this.heads.get(sid) ?? '0'.repeat(64),
      historyDays: Math.max(0, Math.round((this.state.clock - (st?.createdAt ?? this.state.clock)) / DAY)),
      seeded: false,
      paper: !!st?.paper,
    };
    return { ...body, sig: await sign(this.gateway.privateKey, body) };
  }

  private async closeEpoch(only?: string[]) {
    const atts = { ...this.state.attestations };
    for (const sid of only ?? [...this.books.keys()]) atts[sid] = await this.attest(sid, this.state.tick);
    this.set({ attestations: atts });
  }

  async verifyAttestation(a: Attestation) {
    const { sig, ...body } = a;
    return verify(this.gateway.publicKey, body, sig);
  }

  /** Simulated market: advance the clock one day along a fixed path, then close the epoch. */
  async advanceDay() {
    const row = MARKET_PATH[this.state.tick % MARKET_PATH.length];
    const prices = { ...this.state.prices };
    for (const [k, f] of Object.entries(row)) prices[k] = +(prices[k] * f).toFixed(4);
    const wk = this.state.feed.length - INTENTS_DATASET.length;
    const feedRow = { week: `W${45 + wk}`, volumeM: FEED_PATH[wk % FEED_PATH.length] };
    this.set((s) => ({ prices, clock: s.clock + DAY, tick: s.tick + 1, feed: [...s.feed, feedRow] }));
    for (const [sid, b] of this.books) b.navs.push(this.nav(sid));
    this.set((s) => ({ portfolios: Object.fromEntries(Object.entries(s.portfolios).map(([u, p]) => [u, { ...p, navs: [...p.navs, this.portfolioValue(p)] }])) }));
    await this.closeEpoch();
    await this.evaluatePlays();
    await this.evaluateWatches();
    this.settleThesisStances();
    this.syncAccess();
    this.toast('Market advanced 24 hours. Public stats re-attested for the new epoch.');
  }

  // ------------------------------------------------------------------ forking
  async fork(parentId: string, draft: Draft, capital: number, paper = false) {
    const me = this.me();
    if (!me) throw new Error('Switch to a wallet to fork.');
    const parent = this.state.strategies[parentId];
    const ok = parent.visibility === 'public' || this.activeGrants(me, parentId).some((g) => g.payload.permissions.includes('fork'));
    if (!ok) throw new Error('Forking needs a valid Fork Key for this strategy.');
    return this.publish(draft, { id: parentId, v: parent.versions.at(-1)!.v }, capital, paper);
  }

  follow(uid: UserId) {
    const me = this.me();
    if (!me) { this.toast('Switch to a wallet to follow people.', 'warn'); return; }
    const list = this.state.following[me] ?? [];
    const on = list.includes(uid);
    this.set((s) => ({
      following: { ...s.following, [me]: on ? list.filter((x) => x !== uid) : [...list, uid] },
      users: { ...s.users, [uid]: { ...s.users[uid], followers: s.users[uid].followers + (on ? -1 : 1) } },
    }));
  }

  like(sid: string) { this.set((s) => ({ strategies: { ...s.strategies, [sid]: { ...s.strategies[sid], likes: s.strategies[sid].likes + 1 } } })); }
  markLineageSeen() { if (!this.state.lineageSeen) this.set({ lineageSeen: true }); }

  /** For the gateway inspector: ciphertext only, exactly what anyone could see. */
  ciphertext(sid: string) { return this.state.strategies[sid].versions.at(-1)!.sealed; }

  /** Public-safe: is this strategy currently executed? Count only. */
  receiptCount(sid: string) { return this.state.commitments.filter((c) => c.strategyId === sid).length; }

  lineageRoots() {
    return Object.values(this.state.strategies).filter((s) => !s.parent);
  }
  children(sid: string) { return Object.values(this.state.strategies).filter((s) => s.parent?.id === sid); }
  // ================================================================== social layer

  markTried(key: string) { if (!this.state.tried[key]) this.set((s) => ({ tried: { ...s.tried, [key]: true } })); }

  private notify(to: UserId, text: string) {
    const n: Notice = { id: id('n'), to, ts: this.state.clock, text, read: false };
    this.set((s) => ({ notices: [n, ...s.notices] }));
  }
  markNoticesRead() {
    const me = this.me();
    if (me) this.set((s) => ({ notices: s.notices.map((n) => (n.to === me ? { ...n, read: true } : n)) }));
  }

  /** Direct payment to a user (plays, royalty shares) with the protocol fee. */
  private payUser(from: UserId, to: UserId, amount: number, memo: string, kind: LedgerEntry['kind']) {
    if ((this.state.balances[from] ?? 0) < amount) throw new Error(`You need ${amount} USDC. Your balance is ${(this.state.balances[from] ?? 0).toFixed(2)} USDC.`);
    const { move, commit } = this.mover(from);
    const fee = amount * PROTOCOL_BPS / 10000;
    move(PROTOCOL, fee, 'protocol', `Protocol fee on ${memo}`);
    move(to, amount - fee, kind, memo);
    commit();
  }

  // ---------------------------------------------------------------- plays
  /**
   * A play is a single sealed call. Its commitment hash is public the moment it is posted,
   * so the author can later prove what they called and when, without anyone front-running it.
   * Trench plays (memecoins) also need proof of position: a settled buy before posting.
   */
  async createPlay(author: UserId, input: { kind: 'play' | 'trench'; asset: string; targetPct: number; stopPct: number; hours: number; note: string; price: number; exitDelayMin: number; proofUsd?: number; visibility?: 'public' | 'sealed' }, ts = this.state.clock, seeded = false, entry?: number) {
    const a = ASSETS[input.asset];
    if (!a || a.cls === 'cash') throw new Error('Choose an asset to call.');
    if (input.kind === 'trench' && a.cls !== 'meme') throw new Error('Trench plays are for memecoins.');
    if (input.kind === 'play' && a.cls === 'meme') throw new Error('Memecoins need a trench play, which requires proof of position.');
    if (!(input.targetPct > 0) || !(input.stopPct > 0)) throw new Error('Set a target and a stop above zero.');
    const payload: PlayPayload = { asset: input.asset, chain: a.chain, entry: entry ?? this.state.prices[input.asset], targetPct: input.targetPct, stopPct: input.stopPct, note: input.note };
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const commitHash = await sha256(stable(payload) + salt);
    const dek = await newDek();
    const sealed: Sealed = await seal(dek, { payload, salt });
    const pid = id('p');
    let proof: Play['proof'];
    if (input.kind === 'trench') {
      const usd = input.proofUsd ?? 100;
      const q = await this.intents.quote({ fromAsset: 'USDC', fromChain: 'base', toAsset: input.asset, toChain: a.chain, amountUsd: usd, slippageBps: 150, wallet: this.state.users[author].handle }, this.state.prices, ts);
      const r = await this.intents.settle(q, '0'.repeat(64), ts);
      proof = { receiptHash: r.hash, amountUsd: usd };
    }
    this.playSecrets.set(pid, { dek, salt });
    const play: Play = { id: pid, author, kind: input.kind, createdAt: ts, revealAt: ts + input.hours * HOUR, commitHash, sealed, price: input.price, holders: [], status: 'sealed', proof, exitDelayMin: input.kind === 'trench' ? input.exitDelayMin : 0, seeded,
      visibility: input.visibility ?? 'sealed', publicPayload: input.visibility === 'public' ? payload : undefined };
    if (input.visibility === 'public') play.price = 0;
    this.set((s) => ({ plays: { ...s.plays, [pid]: play }, playViews: { ...s.playViews, [author]: { ...(s.playViews[author] ?? {}), [pid]: payload } }, sentiment: { ...s.sentiment, [pid]: s.sentiment[pid] ?? { stances: [] } } }));
    return pid;
  }

  async postPlay(input: Parameters<Engine['createPlay']>[1]) {
    const me = this.me();
    if (!me) throw new Error('Choose a wallet to post a play.');
    const pid = await this.createPlay(me, input);
    this.markTried('play');
    this.toast(input.visibility === 'public' ? 'Public call posted. Its seal proves when you made it.' : input.kind === 'trench' ? 'Trench play sealed. Your proof-of-position buy settled first.' : 'Play sealed and timestamped. Its seal is public now.');
    return pid;
  }

  async buyPlayAccess(pid: string) {
    const me = this.me();
    const play = this.state.plays[pid];
    if (!me) throw new Error('Choose a wallet to get early access.');
    if (play.author === me) throw new Error('This is your play.');
    if (play.holders.includes(me)) throw new Error('You already have early access.');
    if (play.status === 'revealed' || play.visibility === 'public') throw new Error('This play is already public.');
    this.payUser(me, play.author, play.price, `Early access to a ${play.kind} by ${this.state.users[play.author].handle}`, 'play-access');
    // gateway: decrypt inside, re-seal to the holder's wallet key, client decrypts
    const { payload } = await open<{ payload: PlayPayload }>(this.playSecrets.get(pid)!.dek, play.sealed);
    const box = await boxFor(this.wallets.get(me)!.publicKey, payload);
    const mine = await unbox<PlayPayload>(this.wallets.get(me)!.privateKey, box);
    const e: GatewayEvent = { id: id('e'), ts: this.state.clock, grantId: pid, requester: me, strategyId: pid, decision: 'released', reason: `Play released to early-access holder`, sections: [] };
    this.set((s) => ({
      plays: { ...s.plays, [pid]: { ...play, holders: [...play.holders, me] } },
      playViews: { ...s.playViews, [me]: { ...(s.playViews[me] ?? {}), [pid]: mine } },
      gatewayLog: [e, ...s.gatewayLog],
    }));
    this.markTried('play-access');
    this.toast('Early access granted. You’ll be notified before the author exits.');
  }

  private async revealPlay(pid: string, outcome: NonNullable<Play['outcome']>, changePct: number, at = this.state.clock, exit?: Play['exit']) {
    const play = this.state.plays[pid];
    const { payload, salt } = await open<{ payload: PlayPayload; salt: string }>(this.playSecrets.get(pid)!.dek, play.sealed);
    const verified = (await sha256(stable(payload) + salt)) === play.commitHash;
    let trophyId = play.trophyId;
    const nfts = { ...this.state.nfts };
    if (outcome === 'hit' && !trophyId) {
      trophyId = id('nft');
      nfts[trophyId] = { id: trophyId, kind: 'trophy', owner: play.author, mintedAt: at, meta: { asset: payload.asset, gainPct: changePct, calledAt: play.createdAt, hitAt: at, commitHash: play.commitHash, kind: play.kind } };
    }
    this.set((s) => ({ nfts, plays: { ...s.plays, [pid]: { ...play, status: 'revealed', outcome, changePct, revealed: { ...payload, salt, verified }, revealedAt: at, trophyId, exit: exit ?? play.exit } } }));
    if (this.state.sentiment[pid]) this.settlePlayStances(pid, outcome, changePct);
    if (!play.seeded) {
      const msg = outcome === 'hit' ? `hit its target (${changePct > 0 ? '+' : ''}${changePct}%) and minted a trophy` : outcome === 'stopped' ? `hit its stop (${changePct}%)` : outcome === 'exited' ? `was exited at ${changePct > 0 ? '+' : ''}${changePct}%` : 'is now public';
      this.notify(play.author, `Your ${play.kind} on ${payload.asset} ${msg}.`);
      play.holders.forEach((h) => this.notify(h, `${this.state.users[play.author].handle}’s ${play.kind} on ${payload.asset} ${msg}.`));
    }
  }

  /** Gateway-side check of every live play against the market, run each epoch. */
  private async evaluatePlays() {
    for (const play of Object.values(this.state.plays)) {
      if (play.outcome && play.outcome !== 'open') continue;
      const { payload } = await open<{ payload: PlayPayload }>(this.playSecrets.get(play.id)!.dek, play.sealed);
      const change = +(((this.state.prices[payload.asset] - payload.entry) / payload.entry) * 100).toFixed(1);
      if (change >= payload.targetPct) await this.revealPlay(play.id, 'hit', change);
      else if (change <= -payload.stopPct) await this.revealPlay(play.id, 'stopped', change);
      else if (play.status === 'sealed' && this.state.clock >= play.revealAt) await this.revealPlay(play.id, 'open', change);
      else if (play.status === 'revealed') this.set((s) => ({ plays: { ...s.plays, [play.id]: { ...s.plays[play.id], changePct: change } } }));
    }
  }

  /** No-dump rule: early-access holders are notified before the author's exit can settle. */
  async exitPlay(pid: string) {
    const me = this.me();
    const play = this.state.plays[pid];
    if (play.author !== me) throw new Error('Only the author can exit a play.');
    if (play.outcome && play.outcome !== 'open') throw new Error('This play is already closed.');
    const { payload } = await open<{ payload: PlayPayload }>(this.playSecrets.get(pid)!.dek, play.sealed);
    const change = +(((this.state.prices[payload.asset] - payload.entry) / payload.entry) * 100).toFixed(1);
    const exit = { noticeAt: this.state.clock, exitAt: this.state.clock + play.exitDelayMin * 60_000, delayMin: play.exitDelayMin };
    play.holders.forEach((h) => this.notify(h, `Exit notice: ${this.state.users[me].handle} is leaving ${payload.asset}. The creator’s sell cannot settle for ${play.exitDelayMin} minutes.`));
    await this.revealPlay(pid, 'exited', change, this.state.clock, exit);
    this.markTried('exit');
    this.toast(play.exitDelayMin ? `${play.holders.length} holder${play.holders.length === 1 ? '' : 's'} notified first. Your sell settles after ${play.exitDelayMin} minutes.` : 'Play exited and revealed.', 'ok');
  }

  // ---------------------------------------------------------------- pull requests
  async openPR(forkId: string, title: string) {
    const me = this.me();
    const fork = this.state.strategies[forkId];
    if (!me || fork.owner !== me) throw new Error('Only the fork’s owner can suggest changes to the original.');
    if (!fork.parent) throw new Error('Only forks can suggest changes to the original.');
    if (!title.trim()) throw new Error('Describe what your change does.');
    await this.ownerView(forkId);
    const pos = this.state.views[me]?.[forkId]?.data.positions;
    const before = pos?.base ?? [], after = pos?.holdings ?? [];
    if (stable(before) === stable(after)) throw new Error('Your allocation matches the original. Change it before suggesting.');
    const parent = this.state.strategies[fork.parent.id];
    const diff: Diff = { before, after, note: title };
    const box = await boxFor(this.wallets.get(parent.owner)!.publicKey, diff); // only the upstream owner can read it
    const pr: PullRequest = { id: id('pr'), forkId, parentId: parent.id, author: me, to: parent.owner, title, createdAt: this.state.clock, status: 'open', box, shareBps: 1000 };
    this.set((s) => ({ prs: { ...s.prs, [pr.id]: pr } }));
    this.notify(parent.owner, `${this.state.users[me].handle} suggested a change to “${parent.title}”: ${title}`);
    this.toast('Suggestion sent. Only the original’s creator can open it.');
    return pr.id;
  }

  async readPR(prId: string) {
    const me = this.me();
    const pr = this.state.prs[prId];
    if (pr.to !== me) throw new Error('Only the original’s creator can open this change.');
    const diff = await unbox<Diff>(this.wallets.get(me)!.privateKey, pr.box);
    this.set((s) => ({ prViews: { ...s.prViews, [me]: { ...(s.prViews[me] ?? {}), [prId]: diff } } }));
    return diff;
  }

  /** Merge: new version with every section re-sealed under fresh keys, contributor credited. */
  async mergePR(prId: string) {
    const me = this.me();
    const pr = this.state.prs[prId];
    if (pr.to !== me || pr.status !== 'open') throw new Error('Only the original’s creator can accept a waiting suggestion.');
    const diff = this.state.prViews[me]?.[prId] ?? (await this.readPR(prId));
    const st = this.state.strategies[pr.parentId];
    if (st.visibility === 'public') {
      const publicContent = { ...(st.publicContent ?? {}), positions: { holdings: diff.after } };
      const latestP = st.versions.at(-1)!;
      const author = this.state.users[pr.author];
      const version = { v: latestP.v + 1, ts: this.state.clock, note: `Accepted change from ${author.handle}: ${pr.title}`, contentHash: await sha256(stable(publicContent)), sealed: {} };
      const contributors = [...(st.contributors ?? []), { user: pr.author, prId, shareBps: pr.shareBps, title: pr.title }];
      this.set((s) => ({ strategies: { ...s.strategies, [st.id]: { ...st, publicContent, versions: [...st.versions, version], contributors } }, prs: { ...s.prs, [prId]: { ...pr, status: 'merged' } } }));
      this.notify(pr.author, `${this.state.users[me].handle} accepted your suggested change to “${st.title}”. You now earn ${pr.shareBps / 100}% of its revenue.`);
      await this.ownerView(st.id);
      this.markTried('merge');
      this.toast(`Accepted as version ${version.v}. ${author.handle} credited.`);
      return;
    }
    const old = this.vaults.get(me)!.get(st.id)!;
    const latest = st.versions.at(-1)!;
    const data: Record<string, unknown> = {};
    for (const [sec, sealed] of Object.entries(latest.sealed) as [Section, Sealed][]) data[sec] = await open(old.get(sec)!, sealed);
    data.positions = { holdings: diff.after };
    const fresh = new Map<Section, CryptoKey>();
    const sealedNew: Partial<Record<Section, Sealed>> = {};
    for (const [sec, val] of Object.entries(data) as [Section, unknown][]) { const k = await newDek(); fresh.set(sec, k); sealedNew[sec] = await seal(k, val); }
    this.enclave.set(st.id, fresh);
    this.vaults.get(me)!.set(st.id, fresh);
    const author = this.state.users[pr.author];
    const version = { v: latest.v + 1, ts: this.state.clock, note: `Accepted change from ${author.handle}: ${pr.title}`, contentHash: await sha256(stable(sealedNew)), sealed: sealedNew };
    const contributors = [...(st.contributors ?? []), { user: pr.author, prId, shareBps: pr.shareBps, title: pr.title }];
    this.set((s) => ({ strategies: { ...s.strategies, [st.id]: { ...st, versions: [...st.versions, version], contributors } }, prs: { ...s.prs, [prId]: { ...pr, status: 'merged' } } }));
    this.notify(pr.author, `${this.state.users[me].handle} accepted your suggested change to “${st.title}”. You now earn ${pr.shareBps / 100}% of its key revenue.`);
    await this.ownerView(st.id);
    this.markTried('merge');
    this.toast(`Accepted as version ${version.v}. Sections re-sealed with new keys, ${author.handle} credited.`);
  }

  closePR(prId: string) {
    const pr = this.state.prs[prId];
    if (pr.to !== this.me()) throw new Error('Only the original’s creator can decline it.');
    this.set((s) => ({ prs: { ...s.prs, [prId]: { ...pr, status: 'closed' } } }));
    this.notify(pr.author, `Your suggested change “${pr.title}” was declined.`);
  }

  /** Fork owner syncs to the parent's latest version, through a still-valid key. */
  async pullUpstream(forkId: string) {
    const me = this.me();
    const fork = this.state.strategies[forkId];
    if (!me || fork.owner !== me || !fork.parent) throw new Error('Only a fork’s owner can sync it.');
    const parent = this.state.strategies[fork.parent.id];
    const latestV = parent.versions.at(-1)!.v;
    if (fork.parent.v >= latestV) throw new Error('Already in sync with the original.');
    let holdings: Holding[];
    if (parent.visibility === 'public') holdings = parent.publicContent!.positions!.holdings;
    else {
      const grant = this.activeGrants(me, parent.id).find((g) => g.payload.sections.includes('positions'));
      if (!grant) throw new Error('Syncing needs an active key that opens the original’s positions. Yours expired or was revoked.');
      await this.release(grant.id);
      holdings = this.state.views[me]![parent.id].data.positions!.holdings;
    }
    if (fork.visibility === 'public') {
      const latestF = fork.versions.at(-1)!;
      const publicContent = { ...(fork.publicContent ?? {}), positions: { holdings, base: holdings } };
      const versionF = { v: latestF.v + 1, ts: this.state.clock, note: `Synced with original version ${latestV}`, contentHash: await sha256(stable(publicContent)), sealed: {} };
      this.set((s) => ({ strategies: { ...s.strategies, [forkId]: { ...fork, publicContent, parent: { id: parent.id, v: latestV }, versions: [...fork.versions, versionF] } } }));
      await this.ownerView(forkId);
      this.markTried('pull');
      this.toast(`Synced with the original’s version ${latestV}.`);
      return;
    }
    const deks = this.vaults.get(me)!.get(forkId)!;
    const latest = fork.versions.at(-1)!;
    const sealedNew = { ...latest.sealed, positions: await seal(deks.get('positions')!, { holdings, base: holdings }) };
    const version = { v: latest.v + 1, ts: this.state.clock, note: `Synced with original version ${latestV}`, contentHash: await sha256(stable(sealedNew)), sealed: sealedNew };
    this.set((s) => ({ strategies: { ...s.strategies, [forkId]: { ...fork, parent: { id: parent.id, v: latestV }, versions: [...fork.versions, version] } } }));
    await this.ownerView(forkId);
    this.markTried('pull');
    this.toast(`Synced with the original’s version ${latestV}.`);
  }

  // ---------------------------------------------------------------- co-signs and duels
  /** Co-signers: forks backed by executed capital. Paper forks never count. */
  cosign(sid: string) {
    const st = this.state.strategies[sid];
    const live = this.children(sid).filter((k) => !k.paper && this.receiptCount(k.id) > 0);
    const usd = live.reduce((a, k) => a + (this.books.get(k.id)?.capital ?? 0), 0);
    return { count: (st.seedCosign?.count ?? 0) + live.length, usd: (st.seedCosign?.usd ?? 0) + usd };
  }

  duels() {
    const s = this.state;
    return Object.values(s.strategies).filter((x) => x.parent).map((fork) => {
      const parent = s.strategies[fork.parent!.id];
      const lead = +((s.attestations[fork.id]?.returnPct ?? 0) - (s.attestations[parent.id]?.returnPct ?? 0)).toFixed(2);
      return { fork, parent, lead };
    }).sort((a, b) => b.lead - a.lead);
  }

  // ---------------------------------------------------------------- rooms
  canRoom(sid: string, uid: UserId | null) {
    if (!uid) return false;
    const st = this.state.strategies[sid];
    return st?.visibility === 'public' || st?.owner === uid || this.activeGrants(uid, sid).length > 0;
  }
  roomRead(sid: string): RoomMsg[] | null {
    const me = this.me();
    return this.canRoom(sid, me) ? [...(this.rooms.get(sid) ?? [])] : null;
  }
  roomPost(sid: string, text: string) {
    const me = this.me();
    if (!this.canRoom(sid, me)) throw new Error('Rooms are for the creator and current key holders.');
    if (!text.trim()) return;
    const list = [...(this.rooms.get(sid) ?? []), { id: id('m'), who: me!, ts: this.state.clock, text: text.trim() }];
    this.rooms.set(sid, list);
    this.set((s) => ({ roomCounts: { ...s.roomCounts, [sid]: list.length } }));
    this.markTried('room');
  }

  // ---------------------------------------------------------------- NFT royalty shares
  issueShares(sid: string, total: number, price: number, royaltyBps: number) {
    const me = this.me();
    const st = this.state.strategies[sid];
    if (st.owner !== me) throw new Error('Only the creator can issue royalty shares.');
    if (st.shares) throw new Error('Royalty shares are already issued for this strategy.');
    if (total < 1 || price <= 0 || royaltyBps <= 0 || royaltyBps > 10000) throw new Error('Check the share count, price and royalty percentage.');
    this.set((s) => ({ strategies: { ...s.strategies, [sid]: { ...st, shares: { total, price, royaltyBps, sold: 0 } } } }));
    this.toast(`Issued ${total} royalty shares. Holders will receive ${royaltyBps / 100}% of this strategy’s fork royalties.`);
  }

  buyShares(sid: string, n: number) {
    const me = this.me();
    const st = this.state.strategies[sid];
    if (!me) throw new Error('Choose a wallet to buy royalty shares.');
    if (!st.shares) throw new Error('This strategy has no royalty shares.');
    if (st.owner === me) throw new Error('You already earn this strategy’s royalties.');
    const left = st.shares.total - st.shares.sold;
    if (n < 1 || n > left) throw new Error(`Choose between 1 and ${left} shares.`);
    this.payUser(me, st.owner, +(n * st.shares.price).toFixed(2), `${n} royalty shares of “${st.title}”`, 'share-sale');
    const nft: Nft = { id: id('nft'), kind: 'royalty-share', owner: me, mintedAt: this.state.clock, sid, amount: n };
    this.set((s) => ({ nfts: { ...s.nfts, [nft.id]: nft }, strategies: { ...s.strategies, [sid]: { ...s.strategies[sid], shares: { ...st.shares!, sold: st.shares!.sold + n } } } }));
    this.markTried('shares');
    this.toast(`Minted a royalty-share NFT for ${n} shares.`);
  }

  // ---------------------------------------------------------------- portfolio tracking
  portfolioValue(p: Portfolio) { return p.holdings.reduce((a, h) => a + h.units * this.state.prices[h.asset], 0); }

  connectWallet() {
    const me = this.me();
    if (!me) throw new Error('Choose a wallet first.');
    const holdings = (SEED_PORTFOLIOS[me] ?? []).map((h) => ({ ...h }));
    const p: Portfolio = { connected: true, holdings, navs: [] };
    p.navs = [this.portfolioValue(p)];
    this.set((s) => ({ portfolios: { ...s.portfolios, [me]: p } }));
    this.markTried('portfolio');
    this.toast('Wallet connected read-only. Holdings here are simulated.');
  }

  /** Turn real holdings into a strategy draft; weights by current value. */
  portfolioDraft(template: Draft): Draft | null {
    const me = this.me();
    const p = me ? this.state.portfolios[me] : undefined;
    if (!p) return null;
    const total = this.portfolioValue(p);
    const holdings = p.holdings.map((h) => ({ asset: h.asset, chain: ASSETS[h.asset].chain, weight: Math.round((h.units * this.state.prices[h.asset] / total) * 100) })).filter((h) => h.weight > 0);
    const diff = 100 - holdings.reduce((a, h) => a + h.weight, 0);
    holdings.sort((a, b) => b.weight - a.weight)[0].weight += diff;
    return { ...template, title: `${this.state.users[me!].name.split(' ')[0]}’s live portfolio`, summary: 'My actual holdings, published as a strategy. Positions stay sealed.', tags: ['Portfolio'], content: { ...template.content, positions: { holdings } } };
  }

  /** Paper fork: fill the book at current prices with no execution and no receipts. */
  async paperFill(sid: string, orders: { asset: string; usd: number }[]) {
    const b = this.books.get(sid)!;
    for (const o of orders) { b.units[o.asset] = (b.units[o.asset] ?? 0) + o.usd / this.state.prices[o.asset]; b.cash -= o.usd; }
    b.navs = [this.nav(sid)];
    await this.closeEpoch([sid]);
  }

  /** Graduate a paper fork: reset its book and return the orders to execute for real. */
  async goLive(sid: string) {
    const me = this.me();
    const st = this.state.strategies[sid];
    if (st.owner !== me || !st.paper) throw new Error('Only the owner of a paper fork can take it live.');
    const b = this.books.get(sid)!;
    b.cash = b.capital; b.units = {}; b.navs = [b.capital];
    this.set((s) => ({ strategies: { ...s.strategies, [sid]: { ...st, paper: false } } }));
    await this.closeEpoch([sid]);
    const holdings = this.state.views[me!]?.[sid]?.data.positions?.holdings ?? [];
    return holdings.filter((h) => h.asset !== 'USDC').map((h) => ({ asset: h.asset, chain: h.chain, weight: h.weight, usd: +(b.capital * h.weight / 100).toFixed(2) }));
  }

  // ================================================================== thesis watch
  private async putWatch(body: Omit<WatchStatus, 'sig'>) {
    const w: WatchStatus = { ...body, sig: await sign(this.gateway.privateKey, body) };
    this.set((s) => ({ watches: { ...s.watches, [body.sid]: w } }));
  }

  /** Pure check of conditions against public data: the feed, prices and the signed record. */
  checkConditions(sid: string, conds: WatchCond[]): WatchResult[] {
    const s = this.state;
    return conds.map((c) => {
      if (c.kind === 'feed-falls') {
        const rows = s.feed.slice(-(c.weeks + 1));
        let falls = 0;
        for (let i = rows.length - 1; i > 0 && rows[i].volumeM < rows[i - 1].volumeM; i--) falls++;
        return { label: c.label, tripped: falls >= c.weeks, value: `${falls} of ${c.weeks} weeks falling, latest ${rows.at(-1)!.volumeM}m` };
      }
      if (c.kind === 'price-drop') {
        const ref = c.ref ?? s.prices[c.asset];
        const ch = ((s.prices[c.asset] - ref) / ref) * 100;
        return { label: c.label, tripped: ch <= -c.pct, value: `${c.asset} ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}% from entry` };
      }
      const dd = s.attestations[sid]?.maxDrawdownPct ?? 0;
      return { label: c.label, tripped: dd > c.pct, value: `Drawdown ${dd.toFixed(1)}%` };
    });
  }

  /** Each epoch the gateway opens sealed rules, checks invalidation, and publishes only holding or invalidated. */
  private async evaluateWatches() {
    for (const st of Object.values(this.state.strategies)) {
      const w = this.state.watches[st.id];
      if (!w || w.seeded || w.state === 'invalidated') continue;
      let rules: Rules | undefined = st.publicContent?.rules;
      if (!rules) {
        const deks = this.enclave.get(st.id);
        const sealed = st.versions.at(-1)!.sealed.rules;
        if (!deks || !sealed) continue;
        rules = await open<Rules>(deks.get('rules')!, sealed);
      }
      const results = this.checkConditions(st.id, rules.watch ?? []);
      const hit = results.find((r) => r.tripped);
      if (!hit) { await this.putWatch({ sid: st.id, state: 'holding', checks: w.checks + 1, lastCheck: this.state.clock }); continue; }
      await this.putWatch({ sid: st.id, state: 'invalidated', at: this.state.clock, checks: w.checks + 1, lastCheck: this.state.clock });
      this.notify(st.owner, `Thesis watch: “${st.title}” is invalidated. ${hit.label} (${hit.value}).`);
      for (const g of Object.values(this.state.grants)) {
        if (g.payload.strategyId !== st.id || g.revoked || this.state.clock > g.payload.expiresAt) continue;
        const detail = g.payload.sections.includes('rules') || g.payload.sections.includes('thesis');
        this.notify(g.payload.holder, detail
          ? `Thesis watch: “${st.title}” is invalidated. ${hit.label} (${hit.value}).`
          : `Thesis watch: “${st.title}” is invalidated. Your key does not open the rules, so the reason stays sealed.`);
      }
      this.toast(`Thesis invalidated: “${st.title}”. Key holders were alerted.`, 'warn');
    }
  }

  async verifyWatch(w: WatchStatus) {
    const { sig, ...body } = w;
    return verify(this.gateway.publicKey, body, sig);
  }

  // ================================================================== verified cards
  /** Compact, signed card code: the attestation body plus the gateway signature. */
  cardCode(sid: string) {
    const a = this.state.attestations[sid];
    if (!a) return null;
    const { sig, ...body } = a;
    return `SCN1.${b64(new TextEncoder().encode(stable(body)))}.${sig}`;
  }

  /** Anyone can paste a card code and check it against the gateway key. */
  async verifyCard(code: string): Promise<{ ok: boolean; reason: string; body?: Omit<Attestation, 'sig'>; current?: boolean }> {
    const parts = code.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'SCN1') return { ok: false, reason: 'This is not a Scion card code. Codes start with SCN1.' };
    let body: Omit<Attestation, 'sig'>;
    try { body = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0)))); } catch { return { ok: false, reason: 'The code is damaged. Copy it again from the card.' }; }
    let ok = false;
    try { ok = await verify(this.gateway.publicKey, body, parts[2]); } catch { ok = false; }
    if (!ok) return { ok: false, reason: 'Signature does not match. The numbers on this card were changed or it was not issued by Scion.', body };
    const now = this.state.attestations[body.strategyId];
    return { ok: true, reason: 'Signed by the Scion gateway.', body, current: !!now && now.epoch === body.epoch };
  }

  // ================================================================== wallet trading
  /** Stablecoins in the connected wallet, across chains. */
  cashIn(uid: UserId) {
    const p = this.state.portfolios[uid];
    return p ? p.holdings.filter((h) => ASSETS[h.asset]?.cls === 'cash').reduce((a, h) => a + h.units, 0) : 0;
  }

  /** Apply balance changes to a wallet. Spending USDC draws from Base USDC first, then USDC on NEAR. */
  private walletMove(uid: UserId, moves: [string, number][], price?: number) {
    const p = this.state.portfolios[uid];
    if (!p) return;
    const holdings = p.holdings.map((h) => ({ ...h }));
    for (const [asset, delta] of moves) {
      if (asset === 'USDC' && delta < 0) {
        let need = -delta;
        for (const a of ['USDC', 'USDC.n']) {
          const h = holdings.find((x) => x.asset === a);
          if (!h || need <= 0) continue;
          const take = Math.min(h.units, need); h.units -= take; need -= take;
        }
        continue;
      }
      const h = holdings.find((x) => x.asset === asset);
      if (h) {
        if (delta > 0) h.cost = (h.cost * h.units + delta * (price ?? this.state.prices[asset])) / (h.units + delta);
        h.units += delta;
      } else if (delta > 0) holdings.push({ asset, units: delta, cost: price ?? this.state.prices[asset] });
    }
    this.set((s) => ({ portfolios: { ...s.portfolios, [uid]: { ...p, holdings: holdings.filter((h) => h.units > 1e-9) } } }));
  }

  /** Route label for a swap: same chain on NEAR, or cross-chain through NEAR Intents. */
  route(from: string, to: string) {
    const a = ASSETS[from].chain, b = ASSETS[to].chain;
    return a === 'near' && b === 'near' ? 'Swap on NEAR' : `${a} to ${b} via NEAR Intents`;
  }

  async swapQuote(from: string, to: string, units: number, slippageBps: number) {
    const me = this.me();
    if (!me) throw new Error('Choose a wallet to trade.');
    const p = this.state.portfolios[me];
    if (!p) throw new Error('Connect your wallet to trade.');
    if (from === to) throw new Error('Pick two different tokens.');
    const have = p.holdings.find((h) => h.asset === from)?.units ?? 0;
    if (!(units > 0)) throw new Error('Enter an amount to sell.');
    if (units > have + 1e-9) throw new Error(`You have ${have.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${from}.`);
    const usd = units * this.state.prices[from];
    const q = await this.intents.quote({ fromAsset: from, fromChain: ASSETS[from].chain, toAsset: to, toChain: ASSETS[to].chain, amountUsd: usd, slippageBps, wallet: this.state.users[me].handle }, this.state.prices, this.state.clock);
    return { ...q, route: this.route(from, to), units };
  }

  async swap(q: Awaited<ReturnType<Engine['swapQuote']>>) {
    const me = this.me()!;
    const from = q.req.fromAsset, to = q.req.toAsset;
    const have = this.state.portfolios[me]?.holdings.find((h) => h.asset === from)?.units ?? 0;
    if (q.units > have + 1e-9) throw new Error(`You no longer have enough ${from}.`);
    const r = await this.intents.settle(q, '0'.repeat(64), this.state.clock);
    const p = this.state.portfolios[me]!;
    const holdings = p.holdings.map((h) => (h.asset === from ? { ...h, units: h.units - q.units } : { ...h }));
    const t = holdings.find((h) => h.asset === to);
    if (t) { t.cost = (t.cost * t.units + r.amountIn) / (t.units + r.amountOut); t.units += r.amountOut; }
    else holdings.push({ asset: to, units: r.amountOut, cost: r.amountIn / r.amountOut });
    const trade: WalletTrade = { id: id('w'), ts: this.state.clock, from, to, amountIn: q.units, amountOut: r.amountOut, route: q.route, hash: r.hash, simulated: true };
    this.set((s) => ({ portfolios: { ...s.portfolios, [me]: { ...p, holdings: holdings.filter((h) => h.units > 1e-9), trades: [trade, ...(p.trades ?? [])] } } }));
    this.markTried('swap');
    this.toast(`Bought ${r.amountOut.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}. ${q.route}.`);
    return trade;
  }

  async verifyHoldingProof(sid: string) {
    const hp = this.state.strategies[sid]?.holdingProof;
    if (!hp) return false;
    return verify(this.gateway.publicKey, { sid, count: hp.count, ts: hp.ts, wallet: hp.wallet, digest: hp.digest }, hp.sig);
  }

  // ================================================================== back or fade
  static THESIS_WINDOW_DAYS = 7;

  private seedSentiment() {
    const plays = Object.values(this.state.plays);
    const sentiment: Record<string, Sentiment> = {
      s_near: { stances: [], seed: { back: 412, fade: 96 } },
      s_basis: { stances: [], seed: { back: 88, fade: 23 } },
    };
    const seeds: Record<string, [number, number]> = { tunde: [64, 22], kestrel: [18, 31], maren: [27, 9] };
    for (const p of plays) { const [b, f] = seeds[p.author] ?? [10, 10]; sentiment[p.id] = { stances: [], seed: { back: b, fade: f } }; }
    const tundeHit = plays.find((p) => p.author === 'tunde' && p.outcome === 'hit');
    if (tundeHit) sentiment[tundeHit.id].settled = { winner: 'back', at: tundeHit.revealedAt ?? START, reason: 'Hit its target' };
    this.set({
      sentiment,
      records: { tunde: { right: 0, wrong: 0, seeded: { right: 11, wrong: 3 } }, maren: { right: 0, wrong: 0, seeded: { right: 9, wrong: 4 } }, kestrel: { right: 0, wrong: 0, seeded: { right: 15, wrong: 9 } }, alice: { right: 0, wrong: 0 }, bob: { right: 0, wrong: 0 } },
    });
  }

  /** What a target is and who made it. Theses are public strategies; calls are plays. */
  private target(id: string) {
    const play = this.state.plays[id];
    if (play) return { author: play.author, open: !play.outcome || play.outcome === 'open' };
    const st = this.state.strategies[id];
    if (st && st.visibility === 'public' && st.publicContent?.thesis) return { author: st.owner, open: this.state.watches[id]?.state !== 'invalidated' };
    return null;
  }

  stance(id: string, side: Side) {
    const me = this.me();
    if (!me) throw new Error('Choose a wallet to back or fade.');
    const t = this.target(id);
    if (!t) throw new Error('You can back or fade public theses and calls.');
    if (t.author === me) throw new Error('You can’t back or fade your own call.');
    const sen = this.state.sentiment[id] ?? { stances: [] };
    if (sen.settled || !t.open) throw new Error('This one is already settled.');
    const stances = [...sen.stances.filter((x) => x.uid !== me), { uid: me, side, ts: this.state.clock }];
    this.set((s) => ({ sentiment: { ...s.sentiment, [id]: { ...sen, stances } } }));
    this.markTried('stance');
  }

  /** Settle every stance on a target and score each person's record. */
  private settleStances(id: string, winner: Side, reason: string) {
    const sen = this.state.sentiment[id];
    if (!sen || sen.settled) return;
    const records = { ...this.state.records };
    const stances = sen.stances.map((x) => {
      const result = x.side === winner ? 'right' as const : 'wrong' as const;
      const r = { ...(records[x.uid] ?? { right: 0, wrong: 0 }) };
      r[result] += 1; records[x.uid] = r;
      return { ...x, result };
    });
    this.set((s) => ({ records, sentiment: { ...s.sentiment, [id]: { ...sen, stances, settled: { winner, at: s.clock, reason } } } }));
    for (const x of stances) this.notify(x.uid, `You ${x.side === 'back' ? 'backed' : 'faded'} ${this.state.plays[id] ? 'a call' : `“${this.state.strategies[id].title}”`} and were ${x.result}. ${reason}.`);
  }

  /** Called when a play closes. Hit: backers right. Stop: faders right. Exit: the sign of the move decides. */
  private settlePlayStances(pid: string, outcome: string, change: number) {
    if (outcome === 'hit') this.settleStances(pid, 'back', 'Hit its target');
    else if (outcome === 'stopped') this.settleStances(pid, 'fade', 'Hit its stop');
    else if (outcome === 'exited') this.settleStances(pid, change > 0 ? 'back' : 'fade', `Exited at ${change > 0 ? '+' : ''}${change}%`);
  }

  /** Thesis stances: fades win when thesis watch invalidates it; backs win after a full window of holding. */
  private settleThesisStances() {
    for (const [id, sen] of Object.entries(this.state.sentiment)) {
      const st = this.state.strategies[id];
      if (!st || sen.settled || sen.stances.length === 0) continue;
      if (this.state.watches[id]?.state === 'invalidated') { this.settleStances(id, 'fade', 'Thesis watch invalidated it'); continue; }
      const first = Math.min(...sen.stances.map((x) => x.ts));
      if (this.state.clock - first >= Engine.THESIS_WINDOW_DAYS * DAY) this.settleStances(id, 'back', `Held for ${Engine.THESIS_WINDOW_DAYS} market days`);
    }
  }

  record(uid: UserId) {
    const r = this.state.records[uid] ?? { right: 0, wrong: 0 };
    const right = r.right + (r.seeded?.right ?? 0), wrong = r.wrong + (r.seeded?.wrong ?? 0);
    return { right, wrong, total: right + wrong, seeded: !!r.seeded };
  }

  tally(id: string) {
    const sen = this.state.sentiment[id];
    const back = (sen?.seed?.back ?? 0) + (sen?.stances.filter((x) => x.side === 'back').length ?? 0);
    const fade = (sen?.seed?.fade ?? 0) + (sen?.stances.filter((x) => x.side === 'fade').length ?? 0);
    return { back, fade, total: back + fade };
  }
}

export const engine = new Engine();
