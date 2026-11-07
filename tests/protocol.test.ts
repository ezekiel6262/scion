// Runs the full demo flow headlessly and checks the security boundaries.
// npm test
import { Engine } from '../src/core/engine';
import { aliceDraft } from '../src/core/seed';
import { applyPolicy, defaultPolicy } from '../src/core/policy';


let passed = 0;
function ok(cond: unknown, msg: string) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
  passed++; console.log('ok  ', msg);
}
async function rejects(p: Promise<unknown>, msg: string) {
  try { await p; ok(false, msg); } catch { ok(true, msg); }
}

const e = new Engine();
await e.init();
ok(Object.keys(e.state.strategies).length === 7, 'seed network loads 7 strategies, including the public NEAR thesis');

// 1. Alice publishes
e.setPersona('alice');
const sid = await e.publish(aliceDraft());
const st = e.state.strategies[sid];
ok(JSON.stringify(st).indexOf('Private, cross-chain order flow') === -1, '1. public strategy object contains no plaintext thesis');
ok(e.state.views.alice[sid].data.thesis?.claim.startsWith('Private'), '1. owner reads own sections with own keys');

// 2. Alice executes through intents (simulated solver, real signatures)
const holdings = e.state.views.alice[sid].data.positions!.holdings;
const orders = holdings.filter((h) => h.asset !== 'USDC').map((h) => ({ asset: h.asset, chain: h.chain, usd: 10_000 * h.weight / 100 }));
const quotes = await e.quoteOrders(sid, orders, 50);
const receipts = await e.settle(sid, quotes);
ok(receipts.length === 3 && receipts[1].prevHash === receipts[0].hash, '2. receipts form a hash chain');
ok(e.state.commitments.filter((c) => c.strategyId === sid).length === 3, '2. public sees only receipt commitments');

// 3. Verified PnL updates
await e.advanceDay();
const att = e.state.attestations[sid];
ok(att.returnPct > 0 && att.receipts === 3, `3. attested return ${att.returnPct}% from 3 receipts`);
ok(await e.verifyAttestation(att), '3. attestation signature verifies');
ok(!JSON.stringify(att).includes('NEAR'), '3. attestation leaks no asset names');

// 4-5. Bob buys a Fork Key and sees only permitted sections
e.setPersona('public');
await rejects(e.buyKey(sid, 'fork'), '4. public viewer cannot buy without a wallet');
e.setPersona('bob');
const gid = await e.buyKey(sid, 'fork');
const bobView = e.state.views.bob[sid].data;
ok(bobView.thesis && bobView.positions && bobView.rules, '5. Fork Key releases thesis, positions, rules');
ok(!bobView.evidence && !bobView.trades, '5. Fork Key does not release evidence or trades');

// boundary checks
e.setPersona('alice');
const stolen = await e.gatewayRelease(gid, 'alice');
ok(!stolen.ok, '5. key cannot be used by another wallet');
e.setPersona('bob');
const g = e.state.grants[gid];
e.state.grants[gid] = { ...g, payload: { ...g.payload, sections: ['thesis', 'positions', 'rules', 'evidence', 'trades'] } };
const tampered = await e.gatewayRelease(gid, 'bob');
ok(!tampered.ok, '5. widening scopes in a key breaks its signature');
e.state.grants[gid] = g;

// 6. Bob forks with his own limits and executes
const policy = { ...defaultPolicy(), capital: 2000, maxPositionPct: 30 };
const forkHoldings = [{ asset: 'NEAR', chain: 'near', weight: 40 }, { asset: 'BTC', chain: 'bitcoin', weight: 20 }, { asset: 'USDC', chain: 'base', weight: 40 }];
const plan = applyPolicy(forkHoldings, policy);
ok(plan.orders.find((o) => o.asset === 'NEAR')!.weight === 30, '6. follower policy clips NEAR to 30%');
const before = e.state.balances.alice;
const fid = await e.fork(sid, { ...aliceDraft(), title: 'Half-size intents thesis', content: { ...bobView, positions: { holdings: forkHoldings }, trades: { trades: [] } } }, 2000);
ok(e.state.strategies[fid].parent?.id === sid, '6. fork records its parent and version');
await e.settle(fid, await e.quoteOrders(fid, plan.orders, policy.maxSlippageBps));

// 7. attribution and revenue
ok(e.state.balances.alice > before, `7. Alice earned ${(e.state.balances.alice - 20).toFixed(4)} USDC (key + exec royalty)`);
ok(e.state.ledger.some((l) => l.kind === 'exec-royalty' && l.to === 'alice'), '7. execution royalty routed upstream');

// 8. revocation
e.setPersona('alice');
await e.revoke(gid);
e.setPersona('bob');
await rejects(e.release(gid), '8. revoked key is refused by the gateway');
ok(!e.state.views.bob[sid], '8. client drops cached view after revocation');
const gid2 = await e.buyKey(sid, 'view');
for (let i = 0; i < 8; i++) await e.advanceDay();
await rejects(e.release(gid2), '8. expired key is refused');

// 9. lineage is public, content is not
ok(e.children(sid).length === 1, '9. lineage graph shows the fork');
ok(!JSON.stringify(e.state.strategies[fid]).includes('Private, cross-chain'), '9. fork object stays sealed');

// ================================================================ social layer
const x = new Engine();
await x.init();
const as = (p: string) => { (x.state as any).persona = p; };
as('alice');
const aid = await x.publish(aliceDraft());
await x.settle(aid, await x.quoteOrders(aid, [{ asset: 'NEAR', chain: 'near', usd: 4500 }], 50));

// plays: sealed, timestamped, released only to early-access holders
await rejects(x.postPlay({ kind: 'play', asset: 'MOTH', targetPct: 30, stopPct: 20, hours: 24, note: '', price: 1, exitDelayMin: 0 }), 'P1. memecoins cannot be posted as a normal play');
const trench = await x.postPlay({ kind: 'trench', asset: 'MOTH', targetPct: 30, stopPct: 25, hours: 48, note: 'Thin float', price: 2, exitDelayMin: 15, proofUsd: 200 });
const grub = await x.postPlay({ kind: 'trench', asset: 'GRUB', targetPct: 50, stopPct: 30, hours: 72, note: 'Fade test', price: 1, exitDelayMin: 15, proofUsd: 100 });
ok(!!x.state.plays[trench].proof?.receiptHash, 'P2. trench play carries a proof-of-position receipt');
ok(!JSON.stringify(x.state.plays[trench]).includes('MOTH'), 'P3. a sealed play leaks no asset publicly');
as('bob');
await x.buyPlayAccess(trench);
await x.buyPlayAccess(grub);
ok(x.state.playViews.bob[trench].asset === 'MOTH', 'P4. early-access holder decrypts the play');
await x.advanceDay();
const hit = x.state.plays[trench];
ok(hit.outcome === 'hit' && hit.revealed?.verified, `P5. play hit +${hit.changePct}% and its commitment verifies on reveal`);
ok(hit.trophyId && x.state.nfts[hit.trophyId].owner === 'alice', 'P6. trophy NFT minted to the author');
as('alice');
await x.exitPlay(grub);
const ex = x.state.plays[grub];
const notice = x.state.notices.find((n) => n.to === 'bob' && n.text.startsWith('Exit notice'));
ok(notice && notice.ts < ex.exit!.exitAt, 'P7. no-dump rule: holder notified before the creator’s exit can settle');

// pull requests, contributor credit, key rotation, pull from upstream
as('bob');
await x.buyKey(aid, 'fork');
const base = x.state.views.bob[aid].data.positions!.holdings;
const changed = base.map((h) => (h.asset === 'NEAR' ? { ...h, weight: 35 } : h.asset === 'USDC' ? { ...h, weight: 35 } : h));
const xf = await x.fork(aid, { ...aliceDraft(), title: 'Hedged intent flow', content: { ...x.state.views.bob[aid].data, positions: { holdings: changed, base }, trades: { trades: [] } } }, 2000);
await x.settle(xf, await x.quoteOrders(xf, [{ asset: 'NEAR', chain: 'near', usd: 700 }], 50));
const pr = await x.openPR(xf, 'Cut NEAR to 35%, raise cash buffer');
await rejects(x.readPR(pr), 'R1. only the upstream owner can read a pull request diff');
as('alice');
const ctBefore = x.state.strategies[aid].versions.at(-1)!.sealed.positions!.ct;
await x.mergePR(pr);
const st2 = x.state.strategies[aid];
ok(st2.versions.length === 2 && st2.contributors?.[0].user === 'bob', 'R2. merge creates version 2 and credits the contributor');
ok(st2.versions[1].sealed.positions!.ct !== ctBefore, 'R3. merge re-seals sections under rotated keys');
as('kestrel');
await x.buyKey(aid, 'view');
ok(x.state.ledger.some((l) => l.kind === 'contributor' && l.to === 'bob'), 'R4. contributor earns a share of later key sales');
as('bob');
await x.pullUpstream(xf);
ok(x.state.strategies[xf].parent!.v === 2, 'R5. fork pulls upstream version 2 through a valid key');

// co-signs and paper forks
ok(x.cosign(aid).count === 1, 'C1. an executed fork counts as a co-sign');
const paper = await x.fork(aid, { ...aliceDraft(), title: 'Paper copy', content: { ...x.state.views.bob[aid].data, trades: { trades: [] } } }, 1000, true);
await x.paperFill(paper, [{ asset: 'NEAR', usd: 500 }]);
ok(x.cosign(aid).count === 1 && x.state.attestations[paper].paper, 'C2. paper forks are tracked but never count as co-signs');
ok(x.duels().length >= 4, 'C3. every fork is ranked against its parent');

// rooms are gated by keys
as('public');
ok(x.roomRead(aid) === null, 'M1. the public cannot read a strategy room');
as('bob');
x.roomPost(aid, 'Following the merge.');
ok(x.roomRead(aid)!.length === 1, 'M2. key holder posts and reads the room');
as('alice');
for (const g of x.activeGrants('bob', aid)) await x.revoke(g.id);
as('bob');
ok(x.roomRead(aid) === null, 'M3. revoked holder loses the room');

// NFT royalty shares
as('alice');
x.issueShares(aid, 100, 1, 5000);
as('bob');
x.buyShares(aid, 10);
as('kestrel');
await x.buyKey(xf, 'view');
ok(x.state.ledger.some((l) => l.kind === 'share-payout' && l.to === 'bob'), 'N1. royalty-share NFT holder is paid from fork royalties');

// portfolio tracking
as('bob');
x.connectWallet();
const draft = x.portfolioDraft(aliceDraft())!;
ok(draft.content.positions!.holdings.reduce((a, h) => a + h.weight, 0) === 100, 'T1. connected portfolio becomes a 100% strategy draft');

// ================================================================ thesis watch and verified cards
const w = new Engine();
await w.init();
const asW = (p: string) => { (w.state as any).persona = p; };
asW('alice');
const wid = await w.publish(aliceDraft());
await w.settle(wid, await w.quoteOrders(wid, [{ asset: 'NEAR', chain: 'near', usd: 4000 }], 50));
ok(w.state.watches[wid].state === 'holding', 'W1. a published thesis starts under watch');
asW('bob'); await w.buyKey(wid, 'fork');
asW('kestrel'); await w.buyKey(wid, 'delayed');
await w.advanceDay(); await w.advanceDay();
ok(w.state.watches[wid].state === 'holding', 'W2. two falling weeks do not trip a three-week condition');
await w.advanceDay();
const ws = w.state.watches[wid];
ok(ws.state === 'invalidated' && ws.checks === 3, 'W3. third falling week invalidates the thesis');
ok(!JSON.stringify(ws).toLowerCase().includes('volume'), 'W4. public status never names the condition');
ok(await w.verifyWatch(ws), 'W5. watch status is gateway-signed');
ok(w.state.notices.some((n) => n.to === 'bob' && n.text.includes('Weekly intents volume')), 'W6. holder whose key opens the rules gets the reason');
ok(w.state.notices.some((n) => n.to === 'kestrel' && n.text.includes('stays sealed')), 'W7. holder without rules access is alerted, reason withheld');
const code = w.cardCode(wid)!;
const v1 = await w.verifyCard(code);
ok(v1.ok && v1.current, 'V1. a card code verifies against the gateway key');
const [h, b, sg] = code.split('.');
const fake = JSON.parse(atob(b)); fake.returnPct = 99;
const v2 = await w.verifyCard(`${h}.${btoa(JSON.stringify(fake))}.${sg}`);
ok(!v2.ok, 'V2. editing the return on a card breaks verification');

// ================================================================ publish with held tokens, trading
const t = new Engine();
await t.init();
const asT = (p: string) => { (t.state as any).persona = p; };
asT('bob');
await rejects(t.publish(aliceDraft(), undefined, 5000, false, { held: [{ asset: 'NVDAx', units: 2 }] }), 'H1. using held tokens needs a connected wallet');
t.connectWallet();
await rejects(t.publish(aliceDraft(), undefined, 5000, false, { held: [{ asset: 'NVDAx', units: 60 }] }), 'H2. cannot claim more than the wallet holds');
const nv = 6 * t.state.prices.NVDAx;
const hid = await t.publish(aliceDraft(), undefined, nv + 500, false, { held: [{ asset: 'NVDAx', units: 6 }], buys: [{ asset: 'NEAR', chain: 'near', usd: 400, weight: 0 }], walletFunded: true });
ok(await t.verifyHoldingProof(hid), 'H3. holding proof is gateway-signed');
ok(!JSON.stringify(t.state.strategies[hid].holdingProof).includes('NVDA'), 'H4. public holding proof names no asset');
ok(t.bookSummary(hid)!.cash === 500, 'H5. held tokens fill the book, only buys and reserve stay in cash');
const usdcBefore = t.cashIn('bob');
await t.settle(hid, await t.quoteOrders(hid, [{ asset: 'NEAR', chain: 'near', usd: 400 }], 50));
ok(Math.abs(t.cashIn('bob') - (usdcBefore - 400)) < 0.01, 'H6. wallet-funded buys spend the wallet’s USDC');
ok(!t.state.strategies[hid].pendingBuys, 'H7. pending buys clear once settled');
ok(t.state.attestations[hid].returnPct > -1 && t.state.attestations[hid].returnPct < 1, 'H8. track record starts at publish price, not old cost basis');
const q1 = await t.swapQuote('USDC.n', 'NEAR', 100, 50);
ok(q1.route === 'Swap on NEAR', 'S1. NEAR-to-NEAR swap routes on NEAR');
await t.swap(q1);
const q2 = await t.swapQuote('USDC', 'SOL', 200, 50);
ok(q2.route.includes('via NEAR Intents'), 'S2. cross-chain swap routes through NEAR Intents');
await t.swap(q2);
ok((t.state.portfolios.bob.trades ?? []).length === 2, 'S3. wallet records both trades');
await rejects(t.swapQuote('BTC', 'ETH', 5, 50), 'S4. cannot sell more than the wallet holds');

// ================================================================ public mode and the flagship thesis
import { defaults, FACTS, POINTS, runModel } from '../src/core/thesisModel';
const u = new Engine();
await u.init();
const asU = (p: string) => { (u.state as any).persona = p; };
const flag = u.state.strategies.s_near;
ok(flag.visibility === 'public' && flag.publicContent?.evidence?.kind === 'near-intents' && Object.keys(flag.versions[0].sealed).length === 0, 'U1. flagship thesis is public: readable content, nothing sealed');
asU('bob');
await rejects(u.buyKey('s_near', 'view'), 'U2. public portfolios sell no keys');
const pf = await u.fork('s_near', { ...aliceDraft(), title: 'My take on the Intents thesis', content: { ...flag.publicContent!, positions: { holdings: [{ asset: 'NEAR', chain: 'near', weight: 50 }, { asset: 'USDC', chain: 'base', weight: 50 }], base: flag.publicContent!.positions!.holdings }, trades: { trades: [] } } }, 1000);
ok(u.state.strategies[pf].parent?.id === 's_near' && u.state.strategies[pf].visibility === 'sealed', 'U3. anyone can fork a public portfolio without a key, and seal their fork');
await u.settle(pf, await u.quoteOrders(pf, [{ asset: 'NEAR', chain: 'near', usd: 500 }], 50));
ok(u.state.ledger.some((l) => l.kind === 'exec-royalty' && l.to === 'tunde'), 'U4. forks of public portfolios still pay royalties back');
const pubPlay = await u.postPlay({ kind: 'play', asset: 'NEAR', targetPct: 10, stopPct: 8, hours: 48, note: 'Public call', price: 0, exitDelayMin: 0, visibility: 'public' });
ok(u.state.plays[pubPlay].publicPayload?.asset === 'NEAR' && !!u.state.plays[pubPlay].commitHash, 'U5. public call is visible at once and still carries its seal');
asU('alice');
await rejects(u.buyPlayAccess(pubPlay), 'U6. nobody pays for a public call');
asU('public');
ok(u.roomRead('s_near') === null, 'U7. public rooms still need a wallet');
const r = runModel(POINTS, FACTS, defaults());
ok(Math.abs(r.impliedTakeBps - 7.36) < 0.01 && Math.abs(r.buybackYieldPct - 0.7) < 0.01, `M1. model re-runs from sourced data: ${r.impliedTakeBps.toFixed(2)} bps take, ${r.buybackYieldPct.toFixed(2)}% buyback yield`);
ok(POINTS.every((p) => p.url.startsWith('https://')), 'D2. every data point links to its source');

// ================================================================ back or fade
const bf = new Engine();
await bf.init();
const asB = (p: string) => { (bf.state as any).persona = p; };
asB('public');
await rejects(Promise.resolve().then(() => bf.stance('s_near', 'back')), 'B1. backing needs a wallet');
asB('alice');
const call = await bf.postPlay({ kind: 'trench', asset: 'MOTH', targetPct: 30, stopPct: 25, hours: 48, note: '', price: 1, exitDelayMin: 15, proofUsd: 100, visibility: 'public' });
await rejects(Promise.resolve().then(() => bf.stance(call, 'back')), 'B2. authors cannot back their own call');
asB('bob'); bf.stance(call, 'fade'); bf.stance(call, 'back');
ok(bf.state.sentiment[call].stances.length === 1 && bf.state.sentiment[call].stances[0].side === 'back', 'B3. one stance per person, changeable until settled');
asB('kestrel'); bf.stance(call, 'fade');
await bf.advanceDay(); // MOTH +38% hits the 30% target
ok(bf.state.sentiment[call].settled?.winner === 'back', 'B4. a call that hits target settles for its backers');
ok(bf.record('bob').right === 1 && bf.state.records.kestrel.wrong === 1, 'B5. each person’s record is scored by the outcome');
asB('bob');
await rejects(Promise.resolve().then(() => bf.stance(call, 'fade')), 'B6. settled calls are locked');
asB('alice');
const tid = await bf.publish({ ...aliceDraft(), visibility: 'public' });
asB('bob'); bf.stance(tid, 'back');
asB('kestrel'); bf.stance(tid, 'fade');
await bf.advanceDay(); await bf.advanceDay(); // feed falls 3 weeks in a row by now
ok(bf.state.watches[tid].state === 'invalidated' && bf.state.sentiment[tid].settled?.winner === 'fade', 'B7. thesis watch invalidation settles a thesis for its faders');
ok(bf.tally('s_near').total > 500, 'B8. tallies combine seeded and live stances');

console.log(`\n${passed} checks passed`);
process.exit(0);
