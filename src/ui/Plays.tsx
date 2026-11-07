import { useEffect, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { ASSETS, CLASS_LABEL } from '../core/policy';
import type { Play } from '../core/types';
import { ThesesList } from './Thesis';
import { BackFade } from './Sentiment';
import { act, ago, Av, date, Icon, left, pct, Redacted, useStore, useUi } from './bits';

export function PlayCard({ play }: { play: Play }) {
  const s = useStore();
  const { go } = useUi();
  const me = personaUser(s.persona);
  const u = s.users[play.author];
  const view = play.revealed ?? play.publicPayload ?? (me ? s.playViews[me]?.[play.id] : undefined);
  const mine = me === play.author;
  const holder = !!me && play.holders.includes(me);
  const open = !play.outcome || play.outcome === 'open';
  const status = play.status === 'sealed'
    ? (play.visibility === 'public' ? <span className="pill gain"><Icon n="eye" s={12} /> Public, live</span> : <span className="pill"><Icon n="lock" s={12} /> Sealed</span>)
    : play.outcome === 'hit' ? <span className="pill solid"><Icon n="trophy" s={12} /> Hit {pct(play.changePct ?? 0)}</span>
      : play.outcome === 'stopped' ? <span className="pill" style={{ color: 'var(--loss)' }}>Stopped {pct(play.changePct ?? 0)}</span>
        : play.outcome === 'exited' ? <span className="pill">Exited {pct(play.changePct ?? 0)}</span>
          : <span className="pill">Revealed, open {pct(play.changePct ?? 0)}</span>;
  return (
    <article className={`play ${play.kind === 'trench' ? 'trench' : ''}`}>
      <div className="play-head">
        <Av u={u} size="sm" />
        <button className="linkish strong" onClick={() => go({ name: 'profile', id: u.id })}>{u.handle}</button>
        <span className={`pill ${play.kind === 'trench' ? 'solid' : ''}`}>{play.kind === 'trench' ? <><Icon n="flame" s={12} /> Trench</> : <><Icon n="target" s={12} /> Play</>}</span>
        <span className="faint small">{ago(s.clock, play.createdAt)}</span>
        <span style={{ marginLeft: 'auto' }}>{status}</span>
      </div>
      <div className="play-body">
        {view ? (
          <>
            <div className="play-call">
              <div><b>{view.asset}</b><span>{CLASS_LABEL[ASSETS[view.asset].cls]} on {view.chain}</span></div>
              <div><b>${view.entry < 0.1 ? view.entry.toFixed(5) : view.entry.toFixed(2)}</b><span>Entry</span></div>
              <div><b className="gain">+{view.targetPct}%</b><span>Target</span></div>
              <div><b className="loss">-{view.stopPct}%</b><span>Stop</span></div>
            </div>
            {view.note && <p className="muted">{view.note}</p>}
            {!play.revealed && play.visibility !== 'public' && <p className="small faint" style={{ marginTop: 6 }}>{mine ? 'Only you and early-access holders can see this.' : 'Early access. Released to your wallet only.'}</p>}
            {!play.revealed && play.visibility === 'public' && <p className="small faint" style={{ marginTop: 6 }}>Public call. The seal below proves exactly when it was made.</p>}
            {play.revealed && <p className="small" style={{ marginTop: 6 }}><Icon n="check" s={12} /> Proof checks out: this is exactly what was sealed {date(play.createdAt)} UTC.</p>}
          </>
        ) : (
          <Redacted widths={[88, 64, 76]}>
            <span>Sealed call. Reveals {date(play.revealAt)} UTC, or earlier on target, stop or exit.</span>
            {me && !mine && <button className="btn sm primary" onClick={() => act(() => engine.buyPlayAccess(play.id))}>Early access, {play.price} USDC</button>}
          </Redacted>
        )}
      </div>
      <div style={{ padding: '0 16px 12px' }}><BackFade id={play.id} compact /></div>
      <div className="play-foot">
        <span title={`Proof fingerprint ${play.commitHash}`}>Seal <span className="mono">{play.commitHash.slice(0, 16)}</span></span>
        {play.proof && <span>Proof of position: ${play.proof.amountUsd} bought first, receipt <span className="mono">{play.proof.receiptHash.slice(0, 8)}</span></span>}
        {play.kind === 'trench' && <span>Holders warned {play.exitDelayMin} min before the author can sell</span>}
        <span>{play.holders.length} early holder{play.holders.length === 1 ? '' : 's'}{holder ? ', including you' : ''}</span>
        {play.status === 'sealed' && <span>{left(play.revealAt - s.clock).replace(' left', '')} to reveal</span>}
        {mine && open && <button className="btn sm" onClick={() => act(() => engine.exitPlay(play.id))}>{play.kind === 'trench' ? 'Exit, notify holders first' : 'Exit now'}</button>}
        {play.trophyId && <button className="btn sm" onClick={() => go({ name: 'collection' })}><Icon n="trophy" s={13} /> Trophy NFT</button>}
      </div>
    </article>
  );
}

function Composer({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [kind, setKind] = useState<'play' | 'trench'>('play');
  const assets = Object.entries(ASSETS).filter(([, a]) => (kind === 'trench' ? a.cls === 'meme' : a.cls === 'crypto' || a.cls === 'stock'));
  const [asset, setAsset] = useState('NEAR');
  const [target, setTarget] = useState(8);
  const [stop, setStop] = useState(6);
  const [hours, setHours] = useState(48);
  const [price, setPrice] = useState(1);
  const [note, setNote] = useState('');
  const [proof, setProof] = useState(200);
  const [delay, setDelay] = useState(15);
  const [vis, setVis] = useState<'public' | 'sealed'>('sealed');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAsset(kind === 'trench' ? 'MOTH' : 'NEAR'); setTarget(kind === 'trench' ? 30 : 8); setStop(kind === 'trench' ? 25 : 6); }, [kind]);
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [onClose]);
  const post = async () => {
    setBusy(true);
    const id = await act(() => engine.postPlay({ kind, asset, targetPct: target, stopPct: stop, hours, note, price: vis === 'public' ? 0 : price, exitDelayMin: delay, proofUsd: proof, visibility: vis }));
    setBusy(false);
    if (id) onClose();
  };
  const price0 = s.prices[asset];
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="cmp-h" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head"><h2 id="cmp-h" className="h2">New play</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" /></button></div>
        <div className="sheet-body" style={{ display: 'grid', gap: 16 }}>
          <div className="row" style={{ gap: 8 }}>
          <div className="seg2" role="group" aria-label="Visibility"><button aria-pressed={vis === 'public'} onClick={() => setVis('public')}><Icon n="eye" s={13} /> Public call</button><button aria-pressed={vis === 'sealed'} onClick={() => setVis('sealed')}><Icon n="lock" s={13} /> Sealed call</button></div>
          <div className="seg2" role="group" aria-label="Kind">
            <button aria-pressed={kind === 'play'} onClick={() => setKind('play')}><Icon n="target" s={13} /> Play</button>
            <button aria-pressed={kind === 'trench'} onClick={() => setKind('trench')}><Icon n="flame" s={13} /> Trench</button>
          </div>
          </div>
          <p className="small muted">{kind === 'trench'
            ? 'Memecoin calls. You must buy before posting, and your exit is announced to early holders before it can settle.'
            : vis === 'public' ? 'One trade, visible to everyone right away. Its seal still proves exactly when you called it.' : 'One trade, sealed. Crypto or tokenized stocks. Its seal is public now, so you can prove later exactly what you called and when.'}</p>
          <div className="grid3">
            <label className="field"><span>Asset</span>
              <select className="input" value={asset} onChange={(e) => setAsset(e.target.value)}>{assets.map(([k, a]) => <option key={k} value={k}>{k}, {CLASS_LABEL[a.cls]}</option>)}</select>
            </label>
            <label className="field"><span>Target %</span><input className="input" type="number" value={target} onChange={(e) => setTarget(+e.target.value)} /></label>
            <label className="field"><span>Stop %</span><input className="input" type="number" value={stop} onChange={(e) => setStop(+e.target.value)} /></label>
            <label className="field"><span>Reveal after</span>
              <select className="input" value={hours} onChange={(e) => setHours(+e.target.value)}><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option><option value={168}>7 days</option></select>
            </label>
            <label className="field"><span>Early access, USDC</span><input className="input" type="number" min={0} value={vis === 'public' ? 0 : price} disabled={vis === 'public'} onChange={(e) => setPrice(+e.target.value)} /></label>
            <div className="field"><span>Entry now</span><div className="input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)' }}>${price0 < 0.1 ? price0.toFixed(5) : price0.toFixed(2)}</div></div>
          </div>
          {kind === 'trench' && (
            <div className="grid2">
              <label className="field"><span>Proof-of-position buy, USD</span><input className="input" type="number" min={50} value={proof} onChange={(e) => setProof(+e.target.value)} /></label>
              <label className="field"><span>Exit warning to holders, minutes</span><input className="input" type="number" min={5} value={delay} onChange={(e) => setDelay(Math.max(5, +e.target.value))} /></label>
            </div>
          )}
          <label className="field"><span>{vis === 'public' ? 'Why' : 'Why, sealed with the call'}</span><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you see that the market doesn’t" /></label>
          {ASSETS[asset]?.cls === 'stock' && <p className="small faint">Tokenized stock, simulated in this demo. Paid stock calls can be regulated advice in some countries.</p>}
        </div>
        <div className="sheet-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={post}>{busy ? (kind === 'trench' ? 'Buying, then sealing' : 'Sealing') : kind === 'trench' ? `Buy $${proof} and post` : vis === 'public' ? 'Post publicly' : 'Seal and post'}</button>
        </div>
      </div>
    </div>
  );
}

export function Plays() {
  const s = useStore();
  const me = personaUser(s.persona);
  const [tab, setTab] = useState<'all' | 'theses' | 'trench' | 'revealed'>('all');
  const [compose, setCompose] = useState(false);
  const list = Object.values(s.plays)
    .filter((p) => (tab === 'trench' ? p.kind === 'trench' : tab === 'revealed' ? p.status === 'revealed' : true))
    .sort((a, b) => b.createdAt - a.createdAt);
  const trophies = Object.values(s.nfts).filter((n) => n.kind === 'trophy');
  return (
    <div className="view">
      <div className="pagehead">
        <div><h1 className="title">Plays</h1><p className="muted" style={{ maxWidth: '60ch' }}>Single calls, sealed and timestamped. Pay for early access, or wait for the reveal and check the receipts.</p></div>
        <button className="btn primary lg" onClick={() => (me ? setCompose(true) : engine.toast('Choose a wallet in the sidebar to post a play.', 'warn'))}><Icon n="plus" s={15} /> New play</button>
      </div>
      <div className="repo">
        <div>
          <div className="feedtabs" role="toolbar" aria-label="Filter plays" style={{ marginBottom: 14 }}>
            {([['all', 'All calls'], ['theses', 'Public theses'], ['trench', 'Trenches'], ['revealed', 'Revealed']] as const).map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === 'theses' ? <ThesesList /> : <div className="plays">{list.length ? list.map((p) => <PlayCard key={p.id} play={p} />) : <div className="box empty">No plays here yet.</div>}</div>}
        </div>
        <aside className="about">
          <div className="box">
            <div className="box-head"><h2 className="h3">How plays stay honest</h2></div>
            <div className="box-body small" style={{ display: 'grid', gap: 10 }}>
              <p><b>Sealed, then proven.</b> The call is encrypted, and its seal is public the moment you post. When it reveals, anyone can check the receipts match.</p>
              <p><b>Proof of position.</b> Trench calls settle a real buy before posting, so nobody calls what they don’t hold.</p>
              <p><b>No dumping on holders.</b> When a trench author exits, early holders are warned first, and the author’s sell cannot settle until the warning window passes.</p>
              <p><b>Trophies.</b> A call that hits its target mints a trophy NFT anyone can verify.</p>
            </div>
          </div>
          <div className="box">
            <div className="box-head"><h2 className="h3">Recent trophies</h2><span className="small faint">{trophies.length}</span></div>
            <div className="box-body" style={{ display: 'grid', gap: 8 }}>
              {trophies.length === 0 ? <p className="small muted">None yet.</p> : trophies.slice(0, 4).map((t) => (
                <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 8 }}><Icon n="trophy" s={15} /> <b>{t.meta!.asset}</b> <span className="faint small">{s.users[t.owner].handle}</span></span><span className="gain strong">{pct(t.meta!.gainPct)}</span></div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {compose && <Composer onClose={() => setCompose(false)} />}
    </div>
  );
}
