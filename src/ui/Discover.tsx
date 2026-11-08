import { useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { spec } from '../core/policy';
import type { Strategy } from '../core/types';
import { FeaturedThesis } from './Thesis';
import { ExploreViews, ago, Av, Icon, pct, Ret, useStore, useUi, Verified } from './bits';
import { useLive } from './live';

export const minPrice = (st: Strategy) => (st.keys.length ? Math.min(...st.keys.map((k) => spec(k).price)) : 0);
export const sealedCount = (st: Strategy) => Object.keys(st.versions.at(-1)!.sealed).length;

function How({ onClose }: { onClose: () => void }) {
  return (
    <section aria-labelledby="how-h">
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 26 }}>
        <h2 id="how-h" className="h2">How Scion works</h2>
        <button className="btn ghost sm" onClick={onClose}>Hide</button>
      </div>
      <div className="how">
        <div>
          <span className="step-n">1</span>
          <div className="mini" aria-hidden="true">
            <svg width="120" height="50" viewBox="0 0 120 50"><rect x="1" y="1" width="118" height="48" rx="7" fill="none" stroke="var(--line-2)" />
              <rect x="12" y="11" width="60" height="5" rx="1.5" fill="var(--fg-3)" /><rect x="12" y="21" width="90" height="6" rx="1.5" fill="var(--redact)" /><rect x="12" y="32" width="70" height="6" rx="1.5" fill="var(--redact)" /></svg>
          </div>
          <h3 className="h3">Publish public or sealed</h3>
          <p>Go public and anyone can read and fork it free, or seal it and every section is encrypted separately. Either way your record is verified.</p>
        </div>
        <div>
          <span className="step-n">2</span>
          <div className="mini" aria-hidden="true">
            <svg width="120" height="50" viewBox="0 0 120 50">{[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => (
              <circle key={`${r}${c}`} cx={14 + c * 22} cy={10 + r * 15} r="4.5" fill={(r === 0 && c < 2) || (r === 1 && c < 3) || (r === 2 && (c === 0 || c === 3)) ? 'var(--fg)' : 'none'} stroke="var(--line-2)" strokeWidth="1.5" />)))}</svg>
          </div>
          <h3 className="h3">Sell keys by section</h3>
          <p>A Fork Key opens the rules but not the research. A Delayed Key shows trades a day late. Keys expire, can be revoked, and work only in the buyer’s wallet.</p>
        </div>
        <div>
          <span className="step-n">3</span>
          <div className="mini" aria-hidden="true">
            <svg width="120" height="50" viewBox="0 0 120 50"><path d="M16 42V8M16 30c0-10 14-12 40-12M56 18c18 0 22-6 40-6" stroke="var(--fg)" strokeWidth="2" fill="none" />
              <circle cx="16" cy="8" r="4" fill="var(--fg)" /><circle cx="16" cy="42" r="4" fill="var(--fg)" /><circle cx="56" cy="18" r="4" fill="var(--fg)" /><circle cx="96" cy="12" r="4" fill="var(--fg)" />
              <path d="M70 34H30M36 29l-6 5 6 5" stroke="var(--gain)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h3 className="h3">Fork it, pay the original</h3>
          <p>Followers fork a strategy, set their own limits and execute from their own wallet through NEAR Intents. Every fork pays royalties to its parent.</p>
        </div>
      </div>
    </section>
  );
}

function OwnershipStory() {
  const { go } = useUi();
  return <section className="ownership-story" aria-labelledby="ownership-h">
    <div className="ownership-copy">
      <span className="eyebrow">One idea, many ways to own it</span>
      <h2 id="ownership-h">The intelligence stays attributable from thesis to execution.</h2>
      <p>Authors choose what becomes public, what stays protected, and what others may license. Every fork keeps its ancestry; every agent remains attached to its owner’s wallet and policy.</p>
      <button className="btn" onClick={() => go({name:'docs'})}>Read how Scion works <Icon n="doc" s={14}/></button>
    </div>
    <div className="ownership-flow" aria-label="Scion ownership flow">
      <div><span>01</span><Icon n="doc"/><b>Thesis</b><small>Publish the idea and its evidence.</small></div>
      <div><span>02</span><Icon n="lock"/><b>Protection</b><small>Seal the edge section by section.</small></div>
      <div><span>03</span><Icon n="key"/><b>Access</b><small>License precise rights to a wallet.</small></div>
      <div><span>04</span><Icon n="fork"/><b>Lineage</b><small>Fork, adapt, and preserve attribution.</small></div>
      <div><span>05</span><Icon n="bolt"/><b>Execution</b><small>Run within user-owned limits.</small></div>
    </div>
  </section>;
}

export function StrategyCard({ st }: { st: Strategy }) {
  const s = useStore();
  const { go } = useUi();
  const a = s.attestations[st.id];
  const me = personaUser(s.persona);
  const view = me ? s.views[me]?.[st.id] : undefined;
  const forks = engine.children(st.id).length;
  const cs = engine.cosign(st.id);
  const parent = st.parent ? s.strategies[st.parent.id] : undefined;
  return (
    <div className="scard">
      <button className="linkish scard-title" onClick={() => go({ name: 'strategy', id: st.id })}>
        {st.title}
        {st.visibility === 'public' && <span className="pill gain"><Icon n="eye" s={12} /> Public</span>}
        {parent && <span className="pill"><Icon n="fork" s={12} /> fork of {parent.title}</span>}
        {s.watches[st.id]?.state === 'invalidated' && <span className="pill solid">Thesis invalidated</span>}
      </button>
      <p className="scard-sum">{st.summary}</p>
      <div className="metrics">
        <span>{a ? <b className={a.returnPct >= 0 ? 'gain' : 'loss'}>{pct(a.returnPct)}</b> : <b>New</b>}return</span>
        <span><b>{a ? `${a.maxDrawdownPct.toFixed(1)}%` : '0%'}</b>max drawdown</span>
        <span><b>{st.riskScore}/10</b>risk</span>
        <span><b>{forks}</b>{forks === 1 ? 'fork' : 'forks'}</span>
        {parent && s.attestations[st.id] && s.attestations[parent.id] && (() => { const lead = s.attestations[st.id].returnPct - s.attestations[parent.id].returnPct; return <button className="linkish duelbadge" onClick={() => go({ name: 'duels' })} title="See fork duels"><Icon n="swords" s={12} /> {lead >= 0 ? 'Beating' : 'Trailing'} its original by {Math.abs(lead).toFixed(1)} pts</button>; })()}
        {cs.count > 0 && <span><b>{cs.count}</b>co-signers, ${cs.usd >= 1000 ? `${(cs.usd / 1000).toFixed(1)}k` : cs.usd.toFixed(0)} behind it</span>}
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {st.visibility === 'public' ? (
          <span className="sealedline"><Icon n="eye" s={14} /> Public. Read it all and fork it free.{s.sentiment[st.id] && <> <b style={{ color: 'var(--fg)' }}>{Math.round((engine.tally(st.id).back / Math.max(1, engine.tally(st.id).total)) * 100)}% back it.</b></>}</span>
        ) : view ? (
          <span className="sealedline"><Icon n="unlock" s={14} /> {view.grantId === 'owner' ? 'Your strategy. Every section is open to you.' : 'You hold a key to this strategy.'}</span>
        ) : (
          <span className="sealedline">
            <span className="bars" aria-hidden="true"><i style={{ width: '42%' }} /><i style={{ width: '24%' }} /><i style={{ width: '34%' }} /></span>
            {sealedCount(st)} sections sealed. Keys from {minPrice(st)} USDC
          </span>
        )}
        <Verified a={a} />
      </div>
    </div>
  );
}

export function Home() {
  const s = useStore();
  const live = useLive();
  const { go } = useUi();
  const [tab, setTab] = useState<'all' | 'following' | 'agents'>('all');
  const [how, setHow] = useState(true);
  const me = personaUser(s.persona);
  const items = Object.values(s.strategies)
    .filter((st) => tab === 'all' || (tab === 'agents' ? s.users[st.owner].kind === 'agent' : !!me && (s.following[me] ?? []).includes(st.owner)))
    .sort((a, b) => b.createdAt - a.createdAt);
  const top = Object.values(s.strategies).sort((a, b) => engine.children(b.id).length - engine.children(a.id).length).slice(0, 4);

  return (
    <div className="view">
      <div className="pagehead">
        <div>
          <h1 className="display">Where trading intelligence becomes ownable.</h1>
          <p className="lede">Publish strategies publicly or protect them with keys. Prove results without revealing your edge, license access, fork what works, and execute through your own wallet.</p>
        </div>
        <div className="row">
          <button className="btn lg primary" onClick={() => go({ name: 'plays' })}><Icon n="play" s={14} /> Start the demo</button>
          <button className="btn lg" onClick={() => go({ name: 'explore' })}>Explore strategies</button>
        </div>
      </div>
      <FeaturedThesis />
      {how && <How onClose={() => setHow(false)} />}
      <OwnershipStory />

      <div className="repo">
        <div>
          <div className="feedtabs" role="toolbar" aria-label="Feed">
            {([['all', 'For you'], ['following', 'Following'], ['agents', 'Agents']] as const).map(([k, l]) => (
              <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {items.length === 0 ? (
            <div className="empty"><p className="h2">Nothing here yet</p><p>{me ? 'Follow someone from their profile to fill this feed.' : 'Connect your NEAR wallet to build a following feed.'}</p></div>
          ) : items.map((st) => {
            const u = s.users[st.owner];
            const parent = st.parent ? s.strategies[st.parent.id] : undefined;
            return (
              <article key={st.id} className="event">
                <Av u={u} />
                <div style={{ minWidth: 0 }}>
                  <div className="event-line">
                    <button className="linkish" onClick={() => go({ name: 'profile', id: u.id })}>{u.name}</button>
                    {u.kind === 'agent' && <span className="pill solid">Agent</span>}
                    {parent ? <>forked <button className="linkish" onClick={() => go({ name: 'strategy', id: parent.id })}>{parent.title}</button> from {s.users[parent.owner].name}</> : <>published a strategy</>}
                    <span className="faint">{ago(s.clock, st.createdAt)}</span>
                  </div>
                  <StrategyCard st={st} />
                  <div className="event-actions">
                    <button className="btn ghost" onClick={() => engine.like(st.id)} aria-label={`Like, ${st.likes}`}><Icon n="heart" s={15} /> {st.likes}</button>
                    <button className="btn ghost" onClick={() => go({ name: 'strategy', id: st.id, tab: 'activity' })} aria-label={`Comments, ${st.comments}`}><Icon n="chat" s={15} /> {st.comments}</button>
                    <button className="btn ghost" onClick={() => go({ name: 'strategy', id: st.id, tab: 'forks' })} aria-label="Forks"><Icon n="fork" s={15} /> {engine.children(st.id).length}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <aside className="about">
          <div className="box">
            <div className="box-head"><h2 className="h3">Live plays</h2><button className="btn ghost sm" onClick={() => go({ name: 'plays' })}>All plays</button></div>
            <div>{Object.values(s.plays).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3).map((p) => (
              <button key={p.id} className="gnode" style={{ height: 'auto', padding: '11px 16px' }} onClick={() => go({ name: 'plays' })}>
                <span className="t"><span>{s.users[p.author].handle}</span><span className={`pill ${p.kind === 'trench' ? 'solid' : ''}`}>{p.kind === 'trench' ? 'Trench' : 'Play'}</span></span>
                <span className="r">{p.visibility === 'public' || p.revealed ? (p.revealed ?? p.publicPayload)?.asset : <Icon n="lock" s={14} />}<small>{p.revealed ? p.outcome : p.visibility === 'public' ? 'public' : 'sealed'}</small></span>
                <span className="s">Seal {p.commitHash.slice(0, 10)}</span>
              </button>
            ))}</div>
          </div>
          <div className="box">
            <div className="box-head"><h2 className="h3">Most forked</h2><button className="btn ghost sm" onClick={() => go({ name: 'lineage' })}>Family tree</button></div>
            <div>{top.map((st) => (
              <button key={st.id} className="gnode" style={{ height: 'auto', padding: '11px 16px', gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => go({ name: 'strategy', id: st.id })}>
                <span className="t"><span>{st.title}</span></span>
                <span className="r">{engine.children(st.id).length}<small>forks</small></span>
                <span className="s">{s.users[st.owner].handle}</span>
              </button>
            ))}</div>
          </div>
          <div className="box">
            <div className="box-head"><h2 className="h3">Live production</h2><button className="btn ghost sm" onClick={() => go({ name: 'explore' })}>View all</button></div>
            <div>{live.strategies.slice(0, 4).map((st) => (
              <button key={st.id} className="gnode" style={{ height: 'auto', padding: '11px 16px', gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => go({ name: 'live-strategy', id: st.id })}>
                <span className="t"><span>{st.name}</span>{st.id.startsWith('demo_') || st.id === 'strat_quiet_delta' ? <span className="pill">Demo</span> : <span className="pill gain">Live</span>}</span>
                <span className="r">v{st.latestVersion.semver}<small>{st.latestVersion.horizonDays}d</small></span>
                <span className="s">{st.owner}</span>
              </button>
            ))}</div>
          </div>
          <div className="well small muted">
            <p className="h3" style={{ color: 'var(--fg)', marginBottom: 6 }}>Live production foundation</p>
            Wallet ownership is verified with NEP-413, profiles and published strategies persist in Scion’s production database, and swaps require approval from your NEAR mainnet wallet.
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Explore() {
  const s = useStore();
  const live = useLive();
  const { go } = useUi();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'return' | 'forks' | 'risk' | 'new'>('return');
  const [vis, setVis] = useState<'all' | 'public' | 'sealed'>('all');
  const list = Object.values(s.strategies)
    .filter((st) => vis === 'all' || (st.visibility ?? 'sealed') === vis)
    .filter((st) => (st.title + st.summary + st.tags.join(' ') + s.users[st.owner].handle).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const A = s.attestations[a.id], B = s.attestations[b.id];
      if (sort === 'forks') return engine.children(b.id).length - engine.children(a.id).length;
      if (sort === 'risk') return a.riskScore - b.riskScore;
      if (sort === 'new') return b.createdAt - a.createdAt;
      return (B?.returnPct ?? 0) - (A?.returnPct ?? 0);
    });
  return (
    <div className="view">
      <ExploreViews current="explore" />
      <div className="pagehead">
        <div><h1 className="title">Explore</h1><p className="muted">Every strategy on Scion, ranked by results the gateway has attested.</p></div>
      </div>
      <section className="box live-network" aria-label="Live Scion network">
        <div className="box-head">
          <div><h2 className="h3">Live network</h2><p className="small muted">Persisted in Scion’s private production database under verified NEAR accounts.</p></div>
          <span className={`pill ${live.status === 'live' ? 'gain' : 'solid'}`}><span className="live-dot" /> {live.status}</span>
        </div>
        {live.status === 'offline' ? <div className="small muted">{live.error} <button className="linkish strong" onClick={() => void live.refresh()}>Retry</button></div>
          : live.strategies.length === 0 ? <div className="small muted">{live.status === 'connecting' ? 'Loading production strategies…' : 'No persisted strategies yet.'}</div>
            : <div className="live-strategies">{live.strategies.map((st) => <button key={st.id} className="live-strategy" onClick={()=>go({name:'live-strategy',id:st.id})}>
              <div><div className="strong">{st.name}</div><div className="small faint">{st.owner} · v{st.latestVersion.semver}</div></div>
              <div className="row"><span className="pill">{st.latestVersion.riskClass}</span><span className="pill">{st.latestVersion.horizonDays}d</span><span className="pill solid">{st.latestVersion.restricted.length} sealed</span></div>
            </button>)}</div>}
      </section>
      <div className="row" style={{ marginBottom: 14 }}>
        <label className="search" style={{ flex: 1, minWidth: 220 }}><Icon n="search" />
          <input className="input" placeholder="Search strategies, assets, creators" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search strategies" />
        </label>
        <div className="seg2" role="group" aria-label="Visibility">{([['all', 'All'], ['public', 'Public'], ['sealed', 'Sealed']] as const).map(([k, l]) => <button key={k} aria-pressed={vis === k} onClick={() => setVis(k)}>{l}</button>)}</div>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
          <option value="return">Highest return</option><option value="forks">Most forked</option><option value="risk">Lowest risk</option><option value="new">Newest</option>
        </select>
      </div>
      <div className="box table-wrap">
        <table>
          <thead><tr><th>Strategy</th><th className="num">Return</th><th className="num">Max drawdown</th><th className="num">Sharpe</th><th className="num">Risk</th><th className="num">Forks</th><th>Lineage</th><th className="num">Keys from</th></tr></thead>
          <tbody>{list.map((st) => {
            const a = s.attestations[st.id];
            const u = s.users[st.owner];
            return (
              <tr key={st.id} className="click" onClick={() => go({ name: 'strategy', id: st.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go({ name: 'strategy', id: st.id })}>
                <td style={{ minWidth: 240 }}>
                  <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Av u={u} size="sm" /><div><div className="strong">{st.title} {s.watches[st.id]?.state === 'invalidated' && <span className="pill solid" style={{ marginLeft: 4 }}>Invalidated</span>}</div><div className="small faint">{u.handle}</div></div></div>
                </td>
                <td className="num strong">{a ? <Ret v={a.returnPct} /> : 'New'}</td>
                <td className="num">{a ? `${a.maxDrawdownPct.toFixed(1)}%` : '0%'}</td>
                <td className="num">{a ? a.sharpe.toFixed(2) : '0.00'}</td>
                <td className="num">{st.riskScore}/10</td>
                <td className="num">{engine.children(st.id).length}</td>
                <td>{st.parent ? <span className="pill"><Icon n="fork" s={12} /> Fork</span> : <span className="pill solid">Original</span>}</td>
                <td className="num">{st.visibility === 'public' ? <span className="pill gain">Free</span> : `${minPrice(st)} USDC`}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {list.length === 0 && <div className="empty">No strategies match “{q}”. Try an asset like NEAR or BTC.</div>}
      </div>
    </div>
  );
}
