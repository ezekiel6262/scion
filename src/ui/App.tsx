import { useCallback, useEffect, useMemo, useState } from 'react';
import { engine, personaUser, type State } from '../core/engine';
import type { PlannedOrder } from '../core/policy';
import type { Persona } from '../core/types';
import { act, Av, date, Icon, Logo, Toasts, UiCtx, useStore, type Route } from './bits';
import { ForkFlow } from './Create';
import { Studio } from './Publish';
import { Trade } from './Trade';
import { Explore, Home } from './Discover';
import { ExecuteSheet } from './ExecuteSheet';
import { Lineage } from './Lineage';
import { AccountPage, Earnings, Keys, Profile, Security } from './Pages';
import { StrategyPage } from './Strategy';
import { Plays } from './Plays';
import { Duels } from './Social';
import { Collection, PortfolioPage } from './Wealth';
import { useLive } from './live';
import { LiveStrategyPage } from './LiveProduct';
import { LivePublicProfilePage } from './LiveSocial';
import { LiveSecurity } from './LiveSecurity';

const aliceStrat = (s: State) => Object.values(s.strategies).find((x) => x.owner === 'alice' && !x.seeded && !x.parent);

function steps(s: State) {
  const aid = aliceStrat(s)?.id;
  const grants = Object.values(s.grants).filter((g) => g.payload.holder === 'bob' && g.payload.strategyId === aid);
  const fork = Object.values(s.strategies).find((x) => x.owner === 'bob' && x.parent?.id === aid);
  const at = (tab?: string): Route | undefined => (aid ? { name: 'strategy', id: aid, tab } : undefined);
  return [
    { t: 'Alice publishes a sealed strategy', p: 'Thesis, positions, rules, evidence and trades are encrypted separately.', done: !!aid, who: 'alice' as Persona, to: { name: 'studio' } as Route | undefined },
    { t: 'Alice executes through NEAR Intents', p: 'Three cross-chain intents from her own wallet, with signed receipts.', done: !!aid && engine.receiptCount(aid) > 0, who: 'alice' as Persona, to: at() },
    { t: 'Her record updates, positions stay hidden', p: 'Advance the market a day, then view the strategy as the public.', done: !!aid && (s.attestations[aid]?.epoch ?? 0) > 0 && (s.attestations[aid]?.receipts ?? 0) > 0, who: 'public' as Persona, to: at(), advance: true },
    { t: 'Bob buys a Fork Key', p: 'Choose Unlock. A Fork Key opens thesis, positions and rules for 7 days.', done: grants.length > 0, who: 'bob' as Persona, to: at() },
    { t: 'Bob sees only what he paid for', p: 'Evidence and trades stay redacted for him.', done: grants.length > 0 && !!s.views.bob?.[aid!], who: 'bob' as Persona, to: at() },
    { t: 'Bob forks with his own limits', p: 'His position cap trims NEAR before anything is signed.', done: !!fork && engine.receiptCount(fork.id) > 0, who: 'bob' as Persona, to: aid ? { name: 'fork', id: aid } as Route : undefined },
    { t: 'Alice earns from the fork', p: 'Key revenue plus an execution royalty, paid back to the original.', done: s.ledger.some((l) => l.to === 'alice' && l.kind === 'exec-royalty'), who: 'alice' as Persona, to: { name: 'earnings' } as Route },
    { t: 'Alice revokes the key', p: 'Or advance past expiry. The gateway refuses Bob from then on.', done: grants.some((g) => g.revoked || s.clock > g.payload.expiresAt), who: 'alice' as Persona, to: at('access') },
    { t: 'Anyone can see the lineage', p: 'The fork graph with verified results, and nothing sealed.', done: !!fork && s.lineageSeen, who: 'public' as Persona, to: { name: 'lineage' } as Route },
  ];
}

function extras(s: State) {
  const aid = aliceStrat(s)?.id;
  const fork = Object.values(s.strategies).find((x) => x.owner === 'bob' && x.parent?.id === aid && !x.paper);
  const anyPlay = Object.keys(s.plays).length;
  return [
    { t: 'Post a sealed trench play', who: 'alice' as Persona, to: { name: 'plays' } as Route, done: !!s.tried.play },
    { t: 'Buy early access to a play', who: 'bob' as Persona, to: { name: 'plays' } as Route, done: !!s.tried['play-access'] && anyPlay > 0 },
    { t: 'Exit a trench play, holders warned first', who: 'alice' as Persona, to: { name: 'plays' } as Route, done: !!s.tried.exit },
    { t: 'Suggest a change to the original', who: 'bob' as Persona, to: fork ? { name: 'strategy', id: fork.id } as Route : undefined, done: Object.keys(s.prs).length > 0, need: 'Finish step 6 first' },
    { t: 'Accept the suggested change', who: 'alice' as Persona, to: aid ? { name: 'strategy', id: aid, tab: 'prs' } as Route : undefined, done: !!s.tried.merge },
    { t: 'Sync your fork with the original', who: 'bob' as Persona, to: fork ? { name: 'strategy', id: fork.id } as Route : undefined, done: !!s.tried.pull, need: 'Needs an active Fork Key' },
    { t: 'Talk in a key holders’ room', who: 'bob' as Persona, to: aid ? { name: 'strategy', id: aid, tab: 'room' } as Route : undefined, done: !!s.tried.room },
    { t: 'Buy royalty-share NFTs', who: 'bob' as Persona, to: { name: 'strategy', id: 's_barbell' } as Route, done: !!s.tried.shares },
    { t: 'Back or fade a call or thesis', who: 'bob' as Persona, to: { name: 'plays' } as Route, done: !!s.tried.stance },
    { t: 'Track and publish a portfolio', who: 'bob' as Persona, to: { name: 'portfolio' } as Route, done: !!s.tried.portfolio },
    { t: 'Buy a token on NEAR or cross-chain', who: 'bob' as Persona, to: { name: 'trade' } as Route, done: !!s.tried.swap },
    { t: 'Publish with tokens you already hold', who: 'bob' as Persona, to: { name: 'studio-portfolio' } as Route, done: Object.values(s.strategies).some((x) => x.owner === 'bob' && !!x.holdingProof) },
    { t: 'See who beat their parent', who: 'public' as Persona, to: { name: 'duels' } as Route, done: !!s.tried.duels },
    { t: 'Watch a thesis break: advance until it trips', who: 'bob' as Persona, to: aid ? { name: 'strategy', id: aid } as Route : undefined, done: !!aid && s.watches[aid]?.state === 'invalidated', need: 'Finish step 1 first' },
    { t: 'Share a verified card', who: 'alice' as Persona, to: aid ? { name: 'strategy', id: aid } as Route : undefined, done: !!s.tried.card, need: 'Finish step 2 first' },
    { t: 'Verify a card code', who: 'public' as Persona, to: { name: 'security' } as Route, done: !!s.tried.verify },
  ];
}

function Demo({ go, open, setOpen }: { go: (r: Route) => void; open: boolean; setOpen: (b: boolean) => void }) {
  const s = useStore();
  const list = steps(s);
  const done = list.filter((x) => x.done).length;
  const cur = list.findIndex((x) => !x.done);
  const r = 9, c = 2 * Math.PI * r;
  return (
    <>
      {open && (
        <div className="demo" role="dialog" aria-label="Guided demo">
          <div className="demo-head"><div><div className="h3">Guided demo</div><div className="small faint">{cur === -1 ? 'All nine steps done' : `Step ${cur + 1} of 9`}</div></div><button className="btn ghost sm" onClick={() => setOpen(false)} aria-label="Close guide"><Icon n="x" /></button></div>
          <ol>{list.map((x, i) => (
            <li key={x.t} className={x.done ? 'done' : i === cur ? 'current' : ''}>
              <span className="n">{x.done ? <Icon n="check" s={11} w={2.6} /> : i + 1}</span>
              <div>
                <div className="t">{x.t}</div>
                <p>{x.p}</p>
                {i === cur && (
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    {x.to && <button className="btn sm primary" onClick={() => { engine.setPersona(x.who); go(x.to!); }}>Go as {x.who === 'public' ? 'the public' : x.who === 'alice' ? 'Alice' : 'Bob'}</button>}
                    {x.advance && <button className="btn sm" onClick={() => act(() => engine.advanceDay())}>Advance 24h</button>}
                  </div>
                )}
              </div>
            </li>
          ))}</ol>
          <h4>More to try</h4>
          <ol>{extras(s).map((x) => (
            <li key={x.t} className={x.done ? 'done' : ''}>
              <span className="n">{x.done ? <Icon n="check" s={11} w={2.6} /> : '+'}</span>
              <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                <div className="t">{x.t}</div>
                {!x.done && (x.to
                  ? <button className="btn sm" onClick={() => { engine.setPersona(x.who); go(x.to!); }}>{x.who === 'public' ? 'Public' : x.who === 'alice' ? 'Alice' : 'Bob'}</button>
                  : <span className="small faint">{x.need}</span>)}
              </div>
            </li>
          ))}</ol>
          <div className="demo-foot">
            <div><b>Real:</b> encryption, signed keys, wallet binding, receipts, attestations, risk limits, royalty routing.</div>
            <div><b>Simulated:</b> NEAR Intents solver, wallets, USDC, prices, gateway enclave, seed strategies.</div>
            <button className="btn sm" onClick={() => location.reload()}>Reset demo</button>
          </div>
        </div>
      )}
      <button className="demo-fab" onClick={() => setOpen(!open)} aria-expanded={open}>
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="13" cy="13" r={r} fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <circle cx="13" cy="13" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - done / 9)} strokeLinecap="round" />
        </svg>
        Demo {done}/9
      </button>
    </>
  );
}

const PERSONAS: { id: Persona; label: string }[] = [{ id: 'public', label: 'Public' }, { id: 'alice', label: 'Alice' }, { id: 'bob', label: 'Bob' }];

function PersonaSwitch() {
  const s = useStore();
  return (
    <div className="seg" role="group" aria-label="View as">
      {PERSONAS.map((p) => <button key={p.id} aria-pressed={s.persona === p.id} onClick={() => engine.setPersona(p.id)}>{p.label}</button>)}
    </div>
  );
}

export function App() {
  const s = useStore();
  const live = useLive();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [bellOpen, setBellOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [exec, setExec] = useState<{ sid: string; orders: PlannedOrder[]; slippage: number; manual: boolean } | null>(null);
  const go = useCallback((r: Route) => { setRoute(r); window.scrollTo({ top: 0 }); }, []);
  const execute = useCallback((sid: string, orders: PlannedOrder[], slippage: number, manual = true) => setExec({ sid, orders, slippage, manual }), []);
  const ui = useMemo(() => ({ go, execute }), [go, execute]);
  useEffect(() => { engine.init(); }, []);
  useEffect(() => { if (route.name === 'strategy') engine.ownerView(route.id); }, [route, s.persona]);

  if (!s.ready) return <div className="loading">Generating wallet keys and sealing strategies</div>;
  const me = personaUser(s.persona);
  const u = me ? s.users[me] : null;
  const myKeys = me ? engine.activeGrants(me).length : 0;
  const livePlays = Object.values(s.plays).filter((p) => p.status === 'sealed').length;
  const groups: [string, [Route['name'], string, string, number?][]][] = [
    ['Discover', [['home', 'Home', 'home'], ['explore', 'Explore', 'compass']]],
    ['You', [['portfolio', 'Portfolio', 'pie'], ['trade', 'Trade', 'swap']]],
    ['Account', [['account', 'Profile & wallet', 'user'], ['security', 'Security', 'shield']]],
  ];
  const nav = groups.flatMap(([, items]) => items);
  const mobileNav: [Route['name'], string, string][] = [['home', 'Home', 'home'], ['explore', 'Explore', 'compass'], ['trade', 'Trade', 'swap'], ['portfolio', 'Portfolio', 'pie'],['account','Account','user']];
  const notices = me ? s.notices.filter((n) => n.to === me) : [];
  const unread = live.session?live.notifications.filter((n) => !n.read).length:notices.filter((n) => !n.read).length;
  const bell = (
    <button className="btn ghost sm bell" aria-label={`Notifications, ${unread} unread`} onClick={() => { setBellOpen(!bellOpen); if(live.session)void live.markNotificationsRead();else engine.markNoticesRead(); }} disabled={!live.session&&!me}>
      <Icon n="bell" s={16} />{unread > 0 && <span className="dotn">{unread}</span>}
    </button>
  );
  const active = (n: string) => route.name === n || (n === 'explore' && ['strategy', 'fork', 'lineage', 'duels'].includes(route.name)) || (n === 'portfolio' && route.name === 'studio-portfolio');

  return (
    <UiCtx.Provider value={ui}>
      <div className="app">
        <aside className="side" aria-label="Sidebar">
          <button className="brand" onClick={() => go({ name: 'home' })} aria-label="Scion home"><Logo /><b>scion</b></button>
          <button className="btn primary new" onClick={() => go({ name: 'studio' })}><Icon n="plus" s={15} /> New strategy</button>
          <nav aria-label="Main">
            {groups.map(([g, items]) => (
              <div key={g}>
                <div className="side-label">{g}</div>
                {items.map(([n, l, ic, count]) => (
                  <button key={n} className="navitem" aria-current={active(n) ? 'page' : undefined} onClick={() => go({ name: n } as Route)}>
                    <Icon n={ic} s={17} /> {l}{count ? <span className="count">{count}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            <button className={`live-status ${live.status}`} onClick={() => void live.refresh()} title={live.error ?? 'Refresh production service status'}>
              <span className="live-dot" />
              <span>{live.status === 'live' ? `Live API · ${live.strategies.length} persisted` : live.status === 'offline' ? 'API offline · retry' : 'Connecting to API'}</span>
            </button>
            <div className="account">
              <div className="account-row">
                {u ? <Av u={u} size="sm" /> : <span className="av sm"><Icon n="user" s={13} /></span>}
                <button className="linkish" style={{ minWidth: 0, flex: 1 }} onClick={() => go({name:'account'})}>
                  <div className="strong small">{live.profile?.displayName ?? live.session?.accountId ?? 'Connect NEAR wallet'}</div>
                  <div className="small faint">{live.session ? 'Verified mainnet account' : 'Required to publish and execute'}</div>
                </button>
                {bell}
              </div>
            </div>
          </div>
        </aside>

        <div className="content">
          <header className="topbar">
            <button className="brand" style={{ padding: 0 }} onClick={() => go({ name: 'home' })} aria-label="Scion home"><Logo s={24} /></button>
            <button className="btn sm" onClick={() => go({ name: 'studio' })} aria-label="New strategy"><Icon n="plus" s={14} /></button>
            <button className="btn sm" onClick={() => setMore(true)} aria-label="All pages"><Icon n="rail" s={14} /> More</button>
            {bell}
          </header>
          <main id="main">
            {route.name === 'home' && <Home />}
            {route.name === 'explore' && <Explore />}
            {route.name === 'lineage' && <Lineage />}
            {route.name === 'studio' && <Studio key="new" />}
            {route.name === 'studio-portfolio' && <Studio key="portfolio" fromPortfolio />}
            {route.name === 'plays' && <Plays />}
            {route.name === 'trade' && <Trade />}
            {route.name === 'duels' && <Duels />}
            {route.name === 'portfolio' && <PortfolioPage />}
            {route.name === 'collection' && <Collection />}
            {route.name === 'keys' && <Keys />}
            {route.name === 'earnings' && <Earnings />}
            {route.name === 'security' && <LiveSecurity />}
            {route.name === 'account' && <AccountPage />}
            {route.name === 'strategy' && <StrategyPage id={route.id} tab={route.tab} />}
            {route.name === 'live-strategy' && <LiveStrategyPage id={route.id} />}
            {route.name === 'live-profile' && <LivePublicProfilePage account={route.id} />}
            {route.name === 'fork' && <ForkFlow parentId={route.id} />}
            {route.name === 'profile' && <Profile id={route.id} />}
          </main>
          <nav className="bottomnav" aria-label="Main">
            {mobileNav.map(([n, l, ic]) => (
              <button key={n} aria-current={active(n) ? 'page' : undefined} onClick={() => go({ name: n } as Route)}><Icon n={ic} s={20} /> {l}</button>
            ))}
          </nav>
        </div>
      </div>
      {bellOpen && (live.session||me) && (
        <div className="notices" role="dialog" aria-label="Notifications">
          <div className="demo-head"><div className="h3">Notifications</div><button className="btn ghost sm" onClick={() => setBellOpen(false)} aria-label="Close"><Icon n="x" /></button></div>
          {live.session?(live.notifications.length===0?<div className="empty small">Nothing yet. Follows, likes, comments and forks show up here.</div>:live.notifications.map(n=><div key={n.id} className={`item ${n.read?'':'unread'}`}><div>{n.text}</div><div className="small faint">{new Date(n.createdAt).toLocaleString()}</div></div>)):(notices.length === 0 ? <div className="empty small">Nothing yet.</div>
            : notices.map((n) => <div key={n.id} className={`item ${n.read ? '' : 'unread'}`}><div>{n.text}</div><div className="small faint">{date(n.ts)} UTC</div></div>))}
        </div>
      )}
      {more && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="sheet" role="dialog" aria-label="All pages">
            <div className="sheet-head"><h2 className="h2">Scion</h2><button className="btn ghost sm" onClick={() => setMore(false)} aria-label="Close"><Icon n="x" /></button></div>
            <div className="sheet-body">{nav.map(([n, l, ic]) => <button key={n} className="navitem" onClick={() => { setMore(false); go({ name: n } as Route); }}><Icon n={ic} s={17} /> {l}</button>)}
            </div>
          </div>
        </div>
      )}
      {exec && <ExecuteSheet sid={exec.sid} orders={exec.orders} slippage={exec.slippage} manual={exec.manual} onClose={() => setExec(null)} />}
      <Toasts />
    </UiCtx.Provider>
  );
}
