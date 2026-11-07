import { useEffect, useMemo, useRef, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { KEY_SPECS, spec } from '../core/policy';
import type { Evidence, KeyClass, Section, SectionPayloads, Strategy } from '../core/types';
import { act, Av, date, Icon, left, pct, Redacted, Ret, SECTION_LABEL, SECTION_ORDER, useStore, useUi, Verified } from './bits';
import { Graph } from './Lineage';
import { CosignPill, ForkBanners, PRTab, RoomTab, SharesBox } from './Social';
import { ShareSheet, ThesisWatch, WatchPill } from './Trust';
import { NearThesis } from './Thesis';
import { BackFade } from './Sentiment';

type Tab = 'strategy' | 'access' | 'forks' | 'prs' | 'room' | 'activity';

export function StrategyPage({ id, tab: initial }: { id: string; tab?: string }) {
  const s = useStore();
  const { go } = useUi();
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'strategy');
  const [unlock, setUnlock] = useState<KeyClass | null>(null);
  const [share, setShare] = useState(false);
  useEffect(() => setTab((initial as Tab) ?? 'strategy'), [id, initial]);
  const st = s.strategies[id];
  if (!st) return <div className="view empty"><p className="h2">Strategy not found</p><button className="btn" onClick={() => go({ name: 'explore' })}>Back to Explore</button></div>;

  const owner = s.users[st.owner];
  const me = personaUser(s.persona);
  const isOwner = me === st.owner;
  const isPublic = st.visibility === 'public';
  const data = (isPublic ? st.publicContent : me ? s.views[me]?.[id]?.data : undefined) ?? {};
  const held = engine.activeGrants(me, id);
  const canFork = isPublic || held.some((g) => g.payload.permissions.includes('fork'));
  const parent = st.parent ? s.strategies[st.parent.id] : undefined;
  const forks = engine.children(id).length;
  const following = me ? (s.following[me] ?? []).includes(st.owner) : false;
  const latest = st.versions.at(-1)!;
  const openPrs = Object.values(s.prs).filter((p) => (p.parentId === id || p.forkId === id) && p.status === 'open').length;
  const openUnlock = (k?: KeyClass) => {
    if (!me) { engine.toast('Choose a wallet in the sidebar to unlock strategies.', 'warn'); return; }
    setUnlock(k ?? (st.keys.includes('fork') ? 'fork' : st.keys[0]));
  };

  return (
    <div className="view">
      <div className="repo-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="title">{st.title}</h1>
          <div className="byline">
            <Av u={owner} size="xs" />
            <span>by <button className="linkish strong" onClick={() => go({ name: 'profile', id: owner.id })}>{owner.handle}</button></span>
          </div>
          {parent && (
            <div className="forkof"><Icon n="fork" s={14} /> Forked from <button className="linkish strong" onClick={() => go({ name: 'strategy', id: parent.id })}>{parent.title}</button> by {s.users[parent.owner].handle}, version {st.parent!.v}</div>
          )}
          <div className="row" style={{ marginTop: 12, gap: 6 }}>
            <span className="pill solid">{parent ? 'Fork' : 'Original'}</span>
            <span className={`pill ${isPublic ? 'gain' : ''}`}><Icon n={isPublic ? 'eye' : 'lock'} s={12} /> {isPublic ? 'Public' : 'Sealed'}</span>
            <span className="pill">Version {latest.v}</span>
            {!isPublic && <span className="pill"><Icon n="lock" s={12} /> {Object.keys(latest.sealed).length} sealed sections</span>}
            {owner.kind === 'agent' && <span className="pill">AI agent</span>}
            {st.seeded && <span className="pill dash">Seed data</span>}
            {st.paper && <span className="pill dash">Paper fork</span>}
            {st.holdingProof && <span className="pill" title={`Signed holding proof, ${date(st.holdingProof.ts)} UTC`}><Icon n="shield" s={12} /> Holdings verified at publish, {st.holdingProof.count} token{st.holdingProof.count > 1 ? 's' : ''}</span>}
            <WatchPill st={st} />
            <CosignPill st={st} />
          </div>
        </div>
        <div className="repo-actions">
          <button className="btn" onClick={() => setShare(true)} disabled={!s.attestations[id]}><Icon n="up" s={14} /> Share</button>
          {!isOwner && (
            <div className={`split ${following ? 'on' : ''}`}>
              <button onClick={() => engine.follow(st.owner)}><Icon n="user" s={14} /> {following ? 'Following' : 'Follow'}</button>
              <button className="n" tabIndex={-1} aria-label={`${owner.followers} followers`}>{owner.followers.toLocaleString()}</button>
            </div>
          )}
          <div className="split">
            <button disabled={isOwner} onClick={() => (canFork ? go({ name: 'fork', id }) : openUnlock('fork'))} title={isPublic ? 'Public: fork it free' : canFork ? 'Fork this strategy' : 'Forking needs a Fork Key'}>
              <Icon n="fork" s={14} /> Fork
            </button>
            <button className="n" onClick={() => setTab('forks')} aria-label={`${forks} forks`}>{forks}</button>
          </div>
          {isOwner ? <OwnerAction st={st} /> : isPublic
            ? <button className="btn primary" disabled={!me} title={!me ? 'Choose a wallet to fork' : undefined} onClick={() => go({ name: 'fork', id })}><Icon n="fork" s={14} /> Fork free</button>
            : held.length > 0
            ? <button className="btn" onClick={() => setTab('access')}><Icon n="key" s={14} /> {held.length} key{held.length > 1 ? 's' : ''} held</button>
            : <button className="btn primary" onClick={() => openUnlock()}><Icon n="unlock" s={14} /> Unlock</button>}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {([['strategy', 'Strategy', 'doc'], ['access', 'Access', 'key'], ['forks', 'Forks', 'fork'], ['prs', 'Suggested changes', 'pr'], ['room', 'Room', 'room'], ['activity', 'Activity', 'clock']] as const).map(([k, l, ic]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            <Icon n={ic} s={15} /> {l}{k === 'forks' && <span className="count">{forks}</span>}{k === 'access' && held.length > 0 && <span className="count">{held.length}</span>}
            {k === 'prs' && openPrs > 0 && <span className="count">{openPrs}</span>}{k === 'room' && (s.roomCounts[id] ?? 0) > 0 && <span className="count">{s.roomCounts[id]}</span>}
          </button>
        ))}
      </div>

      <div className="repo">
        <div style={{ minWidth: 0 }}>
          {tab === 'strategy' && <><ForkBanners st={st} /><ThesisWatch st={st} />{SECTION_ORDER.map((sec) => <SectionBox key={sec} sec={sec} st={st} data={data} isOwner={isOwner} onUnlock={openUnlock} />)}</>}
          {tab === 'prs' && <PRTab st={st} />}
          {tab === 'room' && <RoomTab st={st} />}
          {tab === 'access' && <AccessTab st={st} onUnlock={openUnlock} />}
          {tab === 'forks' && <ForksTab st={st} />}
          {tab === 'activity' && <ActivityTab st={st} />}
        </div>
        <About st={st} />
      </div>

      {share && <ShareSheet sid={id} onClose={() => setShare(false)} />}
      {unlock && <UnlockSheet st={st} initial={unlock} onClose={() => setUnlock(null)} onDone={() => { setUnlock(null); setTab('strategy'); }} />}
    </div>
  );
}

function OwnerAction({ st }: { st: Strategy }) {
  const { execute } = useUi();
  const book = engine.bookSummary(st.id);
  if (!book) return null;
  if (st.pendingBuys?.length && engine.receiptCount(st.id) === 0)
    return <button className="btn primary" onClick={() => execute(st.id, st.pendingBuys!, 50)}><Icon n="bolt" s={14} /> Sign {st.pendingBuys.length} buy{st.pendingBuys.length > 1 ? 's' : ''}</button>;
  if (engine.receiptCount(st.id) > 0) return <span className="pill gain"><Icon n="check" s={12} /> Executed</span>;
  return null;
}

function SectionBox({ sec, st, data, isOwner, onUnlock }: { sec: Section; st: Strategy; data: Partial<SectionPayloads>; isOwner: boolean; onUnlock: (k?: KeyClass) => void }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const has = !!data[sec];
  const exists = !!st.versions.at(-1)!.sealed[sec] || !!st.publicContent?.[sec];
  const keys = st.keys.map(spec).filter((k) => k.live && k.sections.includes(sec));
  const prev = useRef(has);
  const [fresh, setFresh] = useState(false);
  useEffect(() => { if (has && !prev.current) setFresh(true); prev.current = has; }, [has]);
  if (!exists && !has) return null;
  return (
    <section className="sec" aria-labelledby={`sec-${sec}`}>
      <div className="sec-head">
        <h2 id={`sec-${sec}`} className="h3"><Icon n={st.visibility === 'public' ? 'eye' : has ? 'unlock' : 'lock'} s={15} /> {SECTION_LABEL[sec]}</h2>
        {has ? <span className="pill gain">{isOwner ? 'Yours' : st.visibility === 'public' ? 'Public' : 'Unlocked'}</span> : <span className="pill">Sealed</span>}
      </div>
      <div className={`sec-body ${fresh ? 'reveal' : ''}`}>
        {has ? <SectionContent sec={sec} data={data} /> : (
          <Redacted widths={sec === 'positions' ? [70, 46, 58, 34] : sec === 'trades' ? [94, 94, 94, 94] : [96, 88, 92, 74, 52]}>
            <span>{keys.length ? <>Unlocks with {keys.map((k) => k.label).join(', ')}</> : 'Not sold by the creator'}</span>
            {keys.length > 0 && me && !isOwner && <button className="btn sm primary" onClick={() => onUnlock(keys[0].cls)}>Unlock</button>}
          </Redacted>
        )}
      </div>
    </section>
  );
}

function SectionContent({ sec, data }: { sec: Section; data: Partial<SectionPayloads> }) {
  if (sec === 'thesis' && data.thesis) {
    const t = data.thesis;
    return (
      <div>
        <p className="prose">{t.claim}</p>
        <hr className="divider" />
        <div className="cols2">
          <div><div className="label">Catalysts</div><ul className="list">{t.catalysts.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><div className="label">Invalidated if</div><ul className="list">{t.invalidation.map((c) => <li key={c}>{c}</li>)}</ul></div>
        </div>
        <hr className="divider" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="label">Targets</div><ul className="list">{t.targets.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <span className="pill solid">Confidence {Math.round(t.confidence * 100)}%</span>
        </div>
      </div>
    );
  }
  if (sec === 'positions' && data.positions) {
    return (
      <div className="alloc">
        {data.positions.holdings.map((h) => (
          <div key={h.asset} className="alloc-row"><span><b>{h.asset}</b><small>{h.chain}</small></span><span className="bar"><i style={{ width: `${h.weight}%` }} /></span><span style={{ textAlign: 'right', fontWeight: 600 }}>{h.weight}%</span></div>
        ))}
      </div>
    );
  }
  if (sec === 'rules' && data.rules) {
    const r = data.rules;
    return (
      <div>
        <div className="cols2">
          <div><div className="label">Enter when</div><ul className="list">{r.entry.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><div className="label">Exit when</div><ul className="list">{r.exit.map((c) => <li key={c}>{c}</li>)}</ul></div>
        </div>
        <hr className="divider" />
        <dl className="kv" style={{ maxWidth: 360 }}><dt>Rebalance</dt><dd>{r.rebalance}</dd><dt>Drawdown limit</dt><dd>{r.maxDrawdownPct}%</dd><dt>Leverage</dt><dd>{r.leverage}x</dd></dl>
      </div>
    );
  }
  if (sec === 'evidence' && data.evidence) return data.evidence.kind === 'near-intents' ? <NearThesis /> : <EvidenceContent ev={data.evidence} />;
  if (sec === 'trades' && data.trades) {
    const t = data.trades as SectionPayloads['trades'] & { delayedUntil?: number };
    return (
      <div>
        {t.delayedUntil && <p className="small muted" style={{ marginBottom: 10 }}>Delayed Key: showing trades settled before {date(t.delayedUntil)} UTC.</p>}
        {t.trades.length === 0 ? <p className="muted">No trades {t.delayedUntil ? 'old enough to show yet' : 'yet'}.</p> : (
          <div className="table-wrap" style={{ margin: '0 -16px -16px' }}><table>
            <thead><tr><th>Settled</th><th>Route</th><th className="num">In</th><th className="num">Out</th><th>Receipt</th></tr></thead>
            <tbody>{t.trades.map((x) => (
              <tr key={x.id}><td>{date(x.ts)}</td><td>USDC on {x.fromChain} to {x.to} on {x.toChain}</td><td className="num">${x.amountIn.toLocaleString()}</td><td className="num">{x.amountOut.toFixed(4)} {x.to}</td><td className="mono faint">{x.receiptHash.slice(0, 10)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    );
  }
  return null;
}

function EvidenceContent({ ev }: { ev: Evidence }) {
  const [threshold, setThreshold] = useState(ev.model.threshold * 100);
  const rows = ev.dataset.rows;
  const r = useMemo(() => {
    const g = rows.slice(-5).map((x, i, a) => (i ? x.volumeM / a[i - 1].volumeM - 1 : 0)).slice(1);
    const mean = g.reduce((a, x) => a + x, 0) / g.length;
    return { g, mean, holds: mean * 100 > threshold };
  }, [rows, threshold]);
  const max = Math.max(...rows.map((x) => x.volumeM));
  const W = 540, H = 110, bw = W / rows.length;
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="h3">{ev.dataset.name}</div><div className="small faint">{ev.dataset.source}</div></div>
        <span className="pill dash">Demo dataset</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Weekly volume rising from ${rows[0].volumeM}m to ${rows.at(-1)!.volumeM}m`}>
        {rows.map((x, i) => {
          const h = (x.volumeM / max) * (H - 6);
          return (<g key={x.week}><rect x={i * bw + 5} y={H - h} width={bw - 10} height={h} rx="2" fill={i >= rows.length - 4 ? 'var(--fg)' : 'var(--line-2)'} /><text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize="11" fill="var(--fg-3)">{x.week}</text></g>);
        })}
      </svg>
      <hr className="divider" />
      <div className="h3">Re-run the model</div>
      <p className="mono faint" style={{ margin: '4px 0 12px' }}>{ev.model.formula}</p>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <label className="field" style={{ width: 150 }}><span>Threshold %</span><input className="input" type="number" step="0.5" value={threshold} onChange={(e) => setThreshold(+e.target.value)} /></label>
        <div className="well" style={{ flex: 1, minWidth: 220 }}>
          <div className="small muted">Last 4 weeks: {r.g.map((x) => pct(x * 100)).join(', ')}</div>
          <div className={`strong ${r.holds ? 'gain' : 'loss'}`} style={{ marginTop: 4 }}>Mean {pct(r.mean * 100)}. Entry condition {r.holds ? 'holds' : 'fails'} at {threshold}%.</div>
        </div>
      </div>
    </div>
  );
}

function About({ st }: { st: Strategy }) {
  const s = useStore();
  const a = s.attestations[st.id];
  const me = personaUser(s.persona);
  const book = me === st.owner ? engine.bookSummary(st.id) : null;
  const parent = st.parent ? s.strategies[st.parent.id] : undefined;
  return (
    <aside className="about" aria-label="About this strategy">
      {st.visibility === 'public' && st.publicContent?.thesis && <div><h2 className="h3">Do you buy this thesis?</h2><BackFade id={st.id} /></div>}
      <div>
        <h2 className="h3">About</h2>
        <p className="muted">{st.summary}</p>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>{st.tags.map((t) => <span key={t} className="pill">{t}</span>)}</div>
      </div>
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><h2 className="h3" style={{ margin: 0 }}>Verified record</h2></div>
        {a ? (
          <>
            <div className="statgrid">
              <div><b><Ret v={a.returnPct} /></b><span>Return</span></div>
              <div><b>{a.maxDrawdownPct.toFixed(1)}%</b><span>Max drawdown</span></div>
              <div><b>{a.sharpe.toFixed(2)}</b><span>Sharpe</span></div>
              <div><b>{Math.round(a.winRate * 100)}%</b><span>Win rate</span></div>
              <div><b>{a.receipts}</b><span>Receipts</span></div>
              <div><b>{a.historyDays}d</b><span>History</span></div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <Verified a={a} />
              <button className="btn sm" onClick={() => act(async () => engine.toast((await engine.verifyAttestation(a)) ? 'Signature valid. Stats match the gateway’s attestation.' : 'Signature invalid.'))}>Check</button>
            </div>
            <p className="small faint" style={{ marginTop: 8 }}>Computed inside the gateway from signed receipts. Assets, sizes and trade times are never published.</p>
          </>
        ) : <p className="muted">No record yet.</p>}
      </div>
      <div>
        <h2 className="h3">Details</h2>
        <dl className="kv"><dt>Horizon</dt><dd>{st.horizon}</dd><dt>Risk</dt><dd>{st.riskScore}/10</dd><dt>Chains</dt><dd>{st.chains}</dd><dt>Fork royalty</dt><dd>{st.royaltyBps / 100}% of revenue</dd><dt>Execution royalty</dt><dd>{st.execRoyaltyBps} bps</dd>
          {parent && <><dt>Pays royalties to</dt><dd>{s.users[parent.owner].handle}</dd></>}
        </dl>
      </div>
      <SharesBox st={st} />
      {book && (
        <div className="well">
          <h2 className="h3">Your book</h2>
          <dl className="kv"><dt>Capital</dt><dd>${book.capital.toLocaleString()}</dd><dt>Cash</dt><dd>${book.cash.toLocaleString()}</dd><dt>Value</dt><dd>${book.nav.toLocaleString()}</dd></dl>
        </div>
      )}
    </aside>
  );
}

function AccessTab({ st, onUnlock }: { st: Strategy; onUnlock: (k?: KeyClass) => void }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const isOwner = me === st.owner;
  const held = engine.activeGrants(me, st.id);
  const rows = KEY_SPECS.filter((k) => !k.live || st.keys.includes(k.cls));
  const issued = Object.values(s.grants).filter((g) => g.payload.strategyId === st.id);
  if (st.visibility === 'public') return (
    <div className="box empty">
      <p className="h2">This portfolio is public</p>
      <p style={{ maxWidth: '52ch', margin: '6px auto 0' }}>Anyone can read every section and fork it free. It is still versioned and signed, and every fork pays royalties back to {s.users[st.owner].handle}: {st.royaltyBps / 100}% of its key revenue and {st.execRoyaltyBps} bps of executed volume.</p>
    </div>
  );
  return (
    <div>
      <div className="box table-wrap">
        <table className="matrix">
          
          <thead><tr><th>Key</th>{SECTION_ORDER.map((x) => <th key={x}>{SECTION_LABEL[x]}</th>)}<th>Fork</th><th>Length</th><th>Price</th></tr></thead>
          <tbody>{rows.map((k) => {
            const h = held.find((g) => g.payload.cls === k.cls);
            return (
              <tr key={k.cls} className={h ? 'held' : !k.live ? 'later' : ''}>
                <td><div className="strong">{k.label}</div><div className="small faint">{h ? left(h.payload.expiresAt - s.clock) : !k.live ? 'Later milestone' : k.delayHours ? `${k.delayHours}h delay` : k.what}</div></td>
                {SECTION_ORDER.map((x) => <td key={x}><span className={`dot ${k.sections.includes(x) ? '' : 'off'}`} aria-label={k.sections.includes(x) ? 'Included' : 'Not included'} /></td>)}
                <td><span className={`dot ${k.permissions.includes('fork') ? '' : 'off'}`} aria-label={k.permissions.includes('fork') ? 'Can fork' : 'Cannot fork'} /></td>
                <td className="small">{k.days}d</td>
                <td>{k.live && !isOwner && !h ? <button className="btn sm" disabled={!me} onClick={() => onUnlock(k.cls)}>{k.price} USDC</button> : <span className="strong">{k.price} USDC</span>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '12px 2px 22px' }}>Each key is signed by the gateway and bound to the buyer’s wallet key. Released sections are re-encrypted for that one wallet, so a copied key opens nothing.</p>

      {isOwner && (
        <div className="box">
          <div className="box-head"><h2 className="h3">Keys you’ve sold</h2><span className="small faint">{issued.length}</span></div>
          {issued.length === 0 ? <div className="empty small">No one holds a key yet. Sold keys appear here, and you can revoke any of them.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Holder</th><th>Key</th><th>Status</th><th className="num" /></tr></thead>
              <tbody>{issued.map((g) => {
                const expired = s.clock > g.payload.expiresAt;
                return (
                  <tr key={g.id}><td>{s.users[g.payload.holder].handle}</td><td>{spec(g.payload.cls).label}</td>
                    <td className={g.revoked || expired ? 'loss' : 'gain'}>{g.revoked ? 'Revoked' : expired ? 'Expired' : left(g.payload.expiresAt - s.clock)}</td>
                    <td className="num">{!g.revoked && !expired && <button className="btn sm danger" onClick={() => act(() => engine.revoke(g.id))}>Revoke</button>}</td></tr>
                );
              })}</tbody>
            </table></div>
          )}
        </div>
      )}
    </div>
  );
}

function ForksTab({ st }: { st: Strategy }) {
  const s = useStore();
  const { go } = useUi();
  const chain: Strategy[] = [];
  let p = st.parent ? s.strategies[st.parent.id] : undefined;
  while (p) { chain.push(p); p = p.parent ? s.strategies[p.parent.id] : undefined; }
  return (
    <div>
      {chain.length > 0 && (
        <div className="well" style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>Original line</div>
          {chain.map((c) => <div key={c.id}><button className="linkish strong" onClick={() => go({ name: 'strategy', id: c.id })}>{s.users[c.owner].handle} / {c.title}</button> <span className="faint small">receives {c.royaltyBps / 100}% of key revenue from this family</span></div>)}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10, gap: 6 }}>
        <button className="btn sm ghost" onClick={() => go({ name: 'lineage' })}><Icon n="graph" s={13} /> Whole family tree</button>
        <button className="btn sm ghost" onClick={() => go({ name: 'duels' })}><Icon n="swords" s={13} /> Fork duels</button>
      </div>
      {engine.children(st.id).length === 0 ? (
        <div className="box empty"><p className="h2">No forks yet</p><p>Anyone with a Fork Key can fork this strategy, change it and publish their version. Its creator earns from every fork.</p></div>
      ) : <div className="box" style={{ padding: '0 0 0 4px' }}><Graph roots={[st]} /></div>}
    </div>
  );
}

function ActivityTab({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const commits = s.commitments.filter((c) => c.strategyId === st.id);
  const [items, setItems] = useState([
    { who: 'maren', text: 'Would like to see the invalidation tested against the August volume dip.' },
    { who: 'kestrel', text: 'Evaluated against 4 peers. Lower drawdown than the median, fewer receipts.' },
  ]);
  const [draft, setDraft] = useState('');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="box">
        <div className="box-head"><h2 className="h3">Versions</h2></div>
        {st.versions.map((v) => (
          <div key={v.v} className="order" style={{ padding: '11px 16px' }}><span><b>Version {v.v}</b> <span className="muted">{v.note}</span></span><span className="mono faint" title="Fingerprint of the sealed content">{v.contentHash.slice(0, 12)}</span><span className="small faint">{date(v.ts)} UTC</span></div>
        ))}
      </div>
      <div className="box">
        <div className="box-head"><h2 className="h3">Execution receipts</h2><span className="small faint">Fingerprints only, details sealed</span></div>
        {commits.length === 0 ? <div className="empty small">No receipts yet.</div> : commits.map((c) => (
          <div key={c.hash} className="order" style={{ padding: '10px 16px' }}><span className="mono">{c.hash.slice(0, 24)}</span><span className="small faint">epoch {c.epoch}</span></div>
        ))}
      </div>
      <div className="box">
        <div className="box-head"><h2 className="h3">Discussion</h2><span className="small faint">{items.length}</span></div>
        <div className="box-body" style={{ display: 'grid', gap: 14 }}>
          {items.map((c, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><Av u={s.users[c.who]} size="sm" /><div><div className="strong small">{s.users[c.who].name}</div><div>{c.text}</div></div></div>
          ))}
          <div className="row">
            <input className="input" style={{ flex: 1 }} placeholder={me ? 'Add a comment' : 'Choose a wallet to comment'} disabled={!me} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Comment" />
            <button className="btn" disabled={!me || !draft.trim()} onClick={() => { setItems([...items, { who: me!, text: draft.trim() }]); setDraft(''); }}>Comment</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnlockSheet({ st, initial, onClose, onDone }: { st: Strategy; initial: KeyClass; onClose: () => void; onDone: () => void }) {
  const s = useStore();
  const me = personaUser(s.persona)!;
  const options = KEY_SPECS.filter((k) => k.live && st.keys.includes(k.cls));
  const [pick, setPick] = useState<KeyClass>(options.some((o) => o.cls === initial) ? initial : options[0].cls);
  const [busy, setBusy] = useState(false);
  const k = spec(pick);
  const bal = s.balances[me] ?? 0;
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [onClose]);
  const buy = async () => { setBusy(true); const g = await act(() => engine.buyKey(st.id, pick)); setBusy(false); if (g) onDone(); };
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="unlock-h" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head"><h2 id="unlock-h" className="h2">Unlock “{st.title}”</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" /></button></div>
        <div className="sheet-body">
          <p className="muted" style={{ marginBottom: 14 }}>Choose what you need. You only pay for the sections a key opens.</p>
          <div className="choices" role="radiogroup" aria-label="Key">
            {options.map((o) => (
              <button key={o.cls} role="radio" aria-checked={pick === o.cls} className="choice" onClick={() => setPick(o.cls)}>
                <span className="radio" /><span className="strong">{o.label}</span><span className="strong">{o.price} USDC</span>
                <p>{o.what}. {o.days} days{o.permissions.includes('fork') ? '. Lets you fork.' : '.'}</p>
                <span className="secs">{SECTION_ORDER.map((x) => <span key={x} className={`pill ${o.sections.includes(x) ? 'solid' : ''}`} style={o.sections.includes(x) ? undefined : { opacity: .5 }}>{SECTION_LABEL[x]}</span>)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-foot">
          <span className="small muted" style={{ marginRight: 'auto' }}>Balance {bal.toFixed(2)} USDC, simulated</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || bal < k.price} onClick={buy}>{busy ? 'Issuing key' : `Pay ${k.price} USDC`}</button>
        </div>
      </div>
    </div>
  );
}
