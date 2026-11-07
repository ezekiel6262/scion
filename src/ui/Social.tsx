import { useEffect, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import type { Diff, Holding, Strategy } from '../core/types';
import { ExploreViews, act, Av, date, Icon, Redacted, Ret, useStore, useUi } from './bits';

// ------------------------------------------------------------------ duels
export function Duels() {
  const s = useStore();
  const { go } = useUi();
  useEffect(() => engine.markTried('duels'), []);
  const rows = engine.duels();
  const maxLead = Math.max(1, ...rows.map((r) => Math.abs(r.lead)));
  const beat = rows.filter((r) => r.lead > 0).length;
  return (
    <div className="view">
      <ExploreViews current="duels" />
      <div className="pagehead">
        <div><h1 className="title">Fork duels</h1><p className="muted" style={{ maxWidth: '60ch' }}>Every fork is ranked against the strategy it came from. Beat your parent and you climb. Paper forks are listed but marked.</p></div>
        <span className="pill solid">{beat} of {rows.length} forks beat their parent</span>
      </div>
      <div className="box table-wrap">
        <table>
          <thead><tr><th>#</th><th>Fork</th><th>Parent</th><th className="num">Fork</th><th className="num">Parent</th><th>Lead</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.fork.id} className="click" onClick={() => go({ name: 'strategy', id: r.fork.id })}>
              <td className="strong">{i + 1}</td>
              <td><div className="strong">{r.fork.title} {r.fork.paper && <span className="pill dash">Paper</span>}</div><div className="small faint">{s.users[r.fork.owner].handle}</div></td>
              <td><div>{r.parent.title}</div><div className="small faint">{s.users[r.parent.owner].handle}</div></td>
              <td className="num strong">{s.attestations[r.fork.id] ? <Ret v={s.attestations[r.fork.id].returnPct} /> : 'New'}</td>
              <td className="num">{s.attestations[r.parent.id] ? <Ret v={s.attestations[r.parent.id].returnPct} /> : 'New'}</td>
              <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                <span className="lead-bar" aria-hidden="true"><i style={{ width: `${(Math.abs(r.lead) / maxLead) * 100}%`, background: r.lead >= 0 ? 'var(--gain)' : 'var(--loss)' }} /></span>
                <span className={`strong ${r.lead >= 0 ? 'gain' : 'loss'}`}>{r.lead >= 0 ? '+' : ''}{r.lead.toFixed(1)} pts</span>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ room
export function RoomTab({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const msgs = engine.roomRead(st.id);
  const [draft, setDraft] = useState('');
  void s.roomCounts[st.id];
  if (!msgs) {
    return (
      <div className="sec"><div className="sec-head"><h2 className="h3"><Icon n="room" s={15} /> Room</h2><span className="pill">{s.roomCounts[st.id] ?? 0} messages</span></div>
        <div className="sec-body"><Redacted widths={[60, 82, 45, 70]}><span>The room is for {s.users[st.owner].handle} and current key holders. Any key gets you in.</span></Redacted></div>
      </div>
    );
  }
  return (
    <div className="sec">
      <div className="sec-head"><h2 className="h3"><Icon n="room" s={15} /> Room</h2><span className="pill gain">You’re in</span></div>
      <div className="sec-body room">
        {msgs.length === 0 && <p className="muted">No messages yet. Say what you’re watching.</p>}
        {msgs.map((m) => (
          <div key={m.id} className="msg"><Av u={s.users[m.who]} size="sm" /><div><div className="row" style={{ gap: 8 }}><b className="small">{s.users[m.who].name}</b>{m.who === st.owner && <span className="pill">Creator</span>}{s.users[m.who].kind === 'agent' && <span className="pill solid">Agent</span>}<span className="meta">{date(m.ts)}</span></div><div>{m.text}</div></div></div>
        ))}
        <div className="row">
          <input className="input" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message key holders" aria-label="Message" onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { act(() => engine.roomPost(st.id, draft)); setDraft(''); } }} />
          <button className="btn primary" disabled={!draft.trim() || !me} onClick={() => { act(() => engine.roomPost(st.id, draft)); setDraft(''); }}>Send</button>
        </div>
        <p className="small faint">Lose your key and you lose the room. Messages never leave the gateway for anyone without access.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ suggested changes
function DiffTable({ diff }: { diff: Diff }) {
  const assets = [...new Set([...diff.before.map((h) => h.asset), ...diff.after.map((h) => h.asset)])];
  const w = (list: Holding[], a: string) => list.find((h) => h.asset === a)?.weight ?? 0;
  return (
    <table className="diff">
      <thead><tr><th>Asset</th><th className="num">Before</th><th className="num">After</th><th className="num">Change</th></tr></thead>
      <tbody>{assets.map((a) => {
        const d = w(diff.after, a) - w(diff.before, a);
        return <tr key={a}><td className="strong">{a}</td><td className="num">{w(diff.before, a)}%</td><td className="num">{w(diff.after, a)}%</td><td className={`num strong ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}`}>{d > 0 ? '+' : ''}{d} pts</td></tr>;
      })}</tbody>
    </table>
  );
}

export function PRTab({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const { go } = useUi();
  const prs = Object.values(s.prs).filter((p) => p.parentId === st.id || p.forkId === st.id).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {(st.contributors ?? []).length > 0 && (
        <div className="well"><div className="h3" style={{ marginBottom: 6 }}>Credited improvers</div>
          {st.contributors!.map((c) => <div key={c.prId} className="small"><b>{s.users[c.user].handle}</b> earns {c.shareBps / 100}% of key revenue for “{c.title}”</div>)}
        </div>
      )}
      {prs.length === 0 ? (
        <div className="box empty"><p className="h2">No suggested changes</p><p>Fork owners can suggest improvements back to the original. If the creator accepts, the improver earns a share of future key sales.</p></div>
      ) : prs.map((pr) => {
        const diff = me ? s.prViews[me]?.[pr.id] : undefined;
        const reviewer = me === pr.to;
        return (
          <div key={pr.id} className="box">
            <div className="box-head">
              <div><div className="row" style={{ gap: 8 }}><Icon n="pr" s={15} /><b>{pr.title}</b></div>
                <div className="small faint">{s.users[pr.author].handle} suggests changes from <button className="linkish" onClick={() => go({ name: 'strategy', id: pr.forkId })}>{s.strategies[pr.forkId].title}</button> to {s.strategies[pr.parentId].title}, {date(pr.createdAt)}</div></div>
              <span className={`pill ${pr.status === 'merged' ? 'solid' : ''}`}>{pr.status === 'open' ? 'Waiting' : pr.status === 'merged' ? 'Accepted' : 'Declined'}</span>
            </div>
            <div className="box-body">
              {diff ? <DiffTable diff={diff} /> : reviewer
                ? <button className="btn" onClick={() => act(() => engine.readPR(pr.id))}><Icon n="unlock" s={14} /> Open and review the change</button>
                : <Redacted widths={[70, 52, 64]}><span>Change sealed to {s.users[pr.to].handle}</span></Redacted>}
              {reviewer && pr.status === 'open' && diff && (
                <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
                  <span className="small muted">Accepting creates a new version, re-seals every section with new keys, and gives {s.users[pr.author].handle} {pr.shareBps / 100}% of future key revenue.</span>
                  <div className="row"><button className="btn" onClick={() => act(() => engine.closePR(pr.id))}>Decline</button><button className="btn primary" onClick={() => act(() => engine.mergePR(pr.id))}>Accept</button></div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Banners for the owner of a fork: behind upstream, propose upstream, paper to live. */
export function ForkBanners({ st }: { st: Strategy }) {
  const s = useStore();
  const { execute } = useUi();
  const me = personaUser(s.persona);
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);
  if (!st.parent || me !== st.owner) return null;
  const parent = s.strategies[st.parent.id];
  const behind = parent.versions.at(-1)!.v - st.parent.v;
  const hasOpen = Object.values(s.prs).some((p) => p.forkId === st.id && p.status === 'open');
  return (
    <>
      {st.paper && (
        <div className="banner strong">
          <span><b>Paper fork.</b> Results are tracked at market prices but nothing was executed, so it doesn’t count as a co-sign.</span>
          <button className="btn primary sm" onClick={async () => { const orders = await act(() => engine.goLive(st.id)); if (orders) execute(st.id, orders, 50); }}><Icon n="bolt" s={13} /> Go live</button>
        </div>
      )}
      {behind > 0 && (
        <div className="banner">
          <span><b>The original has {behind} new version{behind > 1 ? 's' : ''}.</b> {parent.versions.at(-1)!.note}.</span>
          <button className="btn sm" onClick={() => act(() => engine.pullUpstream(st.id))}><Icon n="up" s={13} /> Sync with original</button>
        </div>
      )}
      {!hasOpen && !st.paper && (
        <div className="banner">
          {open ? (
            <div className="row" style={{ flex: 1 }}>
              <input className="input" style={{ flex: 1, minWidth: 200 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What your change does, e.g. Cut NEAR to 35%" aria-label="Suggested change" />
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={!title.trim()} onClick={async () => { const id = await act(() => engine.openPR(st.id, title)); if (id) { setOpen(false); setTitle(''); } }}>Send suggestion</button>
            </div>
          ) : (
            <>
              <span><b>Improved on {s.users[parent.owner].handle}’s version?</b> Suggest your change to the original. If accepted, you earn a share of their key sales.</span>
              <button className="btn sm" onClick={() => setOpen(true)}><Icon n="pr" s={13} /> Suggest a change</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ royalty shares
export function SharesBox({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const [n, setN] = useState(10);
  const [total, setTotal] = useState(100);
  const [price, setPrice] = useState(1);
  const [cut, setCut] = useState(40);
  const sh = st.shares;
  const owned = me ? Object.values(s.nfts).filter((x) => x.kind === 'royalty-share' && x.sid === st.id && x.owner === me).reduce((a, x) => a + (x.amount ?? 0), 0) : 0;
  if (!sh && me !== st.owner) return null;
  return (
    <div className="box">
      <div className="box-head"><h2 className="h3"><Icon n="gem" s={14} /> Royalty shares</h2>{sh && <span className="small faint">{sh.sold}/{sh.total} sold</span>}</div>
      <div className="box-body" style={{ display: 'grid', gap: 10 }}>
        {sh ? (
          <>
            <p className="small muted">NFT shares of this strategy’s royalties. Holders split {sh.royaltyBps / 100}% of every royalty its forks pay back.</p>
            <div className="bar"><i style={{ width: `${(sh.sold / sh.total) * 100}%` }} /></div>
            {owned > 0 && <p className="small strong">You hold {owned} share{owned > 1 ? 's' : ''}.</p>}
            {me && me !== st.owner && sh.sold < sh.total && (
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" type="number" min={1} max={sh.total - sh.sold} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Shares" style={{ width: 80 }} />
                <button className="btn primary" style={{ flex: 1 }} onClick={() => act(() => engine.buyShares(st.id, n))}>Buy for {(n * sh.price).toFixed(2)} USDC</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="small muted">Let supporters invest in this strategy’s lineage. Each purchase mints an NFT that earns a cut of fork royalties.</p>
            <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label className="field"><span>Shares</span><input className="input" type="number" value={total} onChange={(e) => setTotal(+e.target.value)} /></label>
              <label className="field"><span>USDC each</span><input className="input" type="number" value={price} onChange={(e) => setPrice(+e.target.value)} /></label>
              <label className="field"><span>Cut %</span><input className="input" type="number" value={cut} onChange={(e) => setCut(+e.target.value)} /></label>
            </div>
            <button className="btn" onClick={() => act(() => engine.issueShares(st.id, total, price, cut * 100))}>Issue royalty shares</button>
          </>
        )}
      </div>
    </div>
  );
}

export function CosignPill({ st }: { st: Strategy }) {
  useStore();
  const c = engine.cosign(st.id);
  if (!c.count) return null;
  return <span className="pill" title="Forks backed by executed capital"><Icon n="check" s={12} /> {c.count} co-signer{c.count > 1 ? 's' : ''}, ${c.usd >= 1000 ? `${(c.usd / 1000).toFixed(1)}k` : c.usd.toFixed(0)} behind it</span>;
}

