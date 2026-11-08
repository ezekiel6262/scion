import { engine, personaUser } from '../core/engine';
import { ASSETS, CLASS_LABEL } from '../core/policy';
import type { AssetClass } from '../core/types';
import { act, date, Icon, pct, Ret, usd, useStore, useUi } from './bits';
import { useLive } from './live';
import { RealPortfolio } from './LiveProduct';

export function PortfolioPage() {
  const live = useLive();
  if (live.session) return <RealPortfolio />;
  return <div className="view narrow empty"><p className="h2">Connect your NEAR wallet</p><p>Sign in with your live account to view balances, holdings, strategies, and portfolio performance.</p><button className="btn primary lg" onClick={() => act(() => live.connect())}><Icon n="wallet" s={16} /> Connect NEAR wallet</button></div>;
  /* The seeded portfolio engine remains available to the guided demo, but is not a live product fallback.
  const s = useStore();
  const { go, execute } = useUi();
  const me = personaUser(s.persona);
  if (!me) return null;
  const p = s.portfolios[me];
  const forks = Object.values(s.strategies).filter((x) => x.owner === me && x.parent);
  const ownStrats = Object.values(s.strategies).filter((x) => x.owner === me && !x.parent);

  const forkTable = (
    <div className="box" style={{ marginTop: 20 }}>
      <div className="box-head"><h2 className="h3">Your strategies and forks</h2><span className="small faint">{forks.length + ownStrats.length}</span></div>
      {forks.length + ownStrats.length === 0 ? <div className="empty small">Nothing yet. Publish your portfolio, or fork a strategy you hold a Fork Key for.</div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Strategy</th><th>Mode</th><th className="num">Return</th><th className="num">vs parent</th><th>Original</th><th className="num" /></tr></thead>
          <tbody>{[...ownStrats, ...forks].map((f) => {
            const a = s.attestations[f.id];
            const parent = f.parent ? s.strategies[f.parent.id] : undefined;
            const behind = parent ? parent.versions.at(-1)!.v - f.parent!.v : 0;
            const lead = parent ? (a?.returnPct ?? 0) - (s.attestations[parent.id]?.returnPct ?? 0) : null;
            return (
              <tr key={f.id}>
                <td><button className="linkish strong" onClick={() => go({ name: 'strategy', id: f.id })}>{f.title}</button>{parent && <div className="small faint">fork of {parent.title}</div>}</td>
                <td>{f.paper ? <span className="pill dash">Paper</span> : <span className="pill solid">Live</span>}</td>
                <td className="num strong">{a ? <Ret v={a.returnPct} /> : 'New'}</td>
                <td className="num">{lead === null ? <span className="faint">Original</span> : <span className={lead >= 0 ? 'gain' : 'loss'}>{lead >= 0 ? '+' : ''}{lead.toFixed(1)} pts</span>}</td>
                <td>{!parent ? <span className="faint">None</span> : behind > 0 ? <span className="strong">{behind} new version{behind > 1 ? 's' : ''}</span> : <span className="muted">Up to date</span>}</td>
                <td className="num">
                  {f.paper && <button className="btn sm" onClick={async () => { const o = await act(() => engine.goLive(f.id)); if (o) { go({ name: 'strategy', id: f.id }); execute(f.id, o, 50); } }}>Go live</button>}
                  {behind > 0 && <button className="btn sm" onClick={() => act(() => engine.pullUpstream(f.id))}>Sync</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );

  if (!p) {
    return (
      <div className="view">
        <div className="pagehead"><div><h1 className="title">Portfolio</h1><p className="muted">Track your real holdings across chains, then publish them as a strategy with positions sealed.</p></div></div>
        <div className="box empty">
          <p className="h2">Connect a wallet to start tracking</p>
          <p style={{ margin: '6px auto 16px', maxWidth: '48ch' }}>Read-only. Scion reads balances and never asks to move funds. In this demo the holdings are simulated.</p>
          <button className="btn primary lg" onClick={() => act(() => engine.connectWallet())}><Icon n="wallet" s={16} /> Connect {s.users[me].handle}</button>
        </div>
        {forkTable}
      </div>
    );
  }

  const value = engine.portfolioValue(p);
  const cost = p.holdings.reduce((a, h) => a + h.units * h.cost, 0);
  const byClass = p.holdings.reduce<Record<string, number>>((m, h) => { const c = ASSETS[h.asset].cls; m[c] = (m[c] ?? 0) + h.units * s.prices[h.asset]; return m; }, {});
  const navs = p.navs.length > 1 ? p.navs : [p.navs[0], value];
  const lo = Math.min(...navs), hi = Math.max(...navs), W = 600, H = 120;
  const pts = navs.map((v, i) => `${(i / (navs.length - 1)) * W},${H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16)}`).join(' ');

  return (
    <div className="view">
      <div className="pagehead">
        <div><h1 className="title">Portfolio</h1><p className="muted">{s.users[me].handle}, read-only. <span className="pill dash">Simulated holdings</span></p></div>
        <div className="row"><button className="btn lg" onClick={() => go({ name: 'trade' })}><Icon n="swap" s={15} /> Trade</button><button className="btn primary lg" onClick={() => go({ name: 'studio-portfolio' })}><Icon n="up" s={15} /> Publish as strategy</button></div>
      </div>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div><b>{usd(value, 0)}</b><span>Value</span></div>
        <div><b className={value >= cost ? 'gain' : 'loss'}>{value >= cost ? '+' : '-'}{usd(Math.abs(value - cost), 0)}</b><span>Unrealized</span></div>
        <div><b><Ret v={((value - cost) / cost) * 100} /></b><span>Return on cost</span></div>
        <div><b>{p.holdings.length}</b><span>Assets</span></div>
      </div>
      <div className="repo">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="box"><div className="box-head"><h2 className="h3">Value over time</h2><span className="small faint">Advance the market to add days</span></div>
            <div className="box-body">{p.navs.length < 2 ? <div className="empty small" style={{ padding: 40 }}>Tracking started today. Advance the market a day to draw the line.</div> : <svg className="spark2" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Portfolio value over time"><polyline points={pts} fill="none" stroke="var(--fg)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}</div>
          </div>
          <div className="box table-wrap">
            <table>
              <thead><tr><th>Asset</th><th>Type</th><th className="num">Units</th><th className="num">Price</th><th className="num">Value</th><th className="num">Return</th></tr></thead>
              <tbody>{p.holdings.map((h) => {
                const v = h.units * s.prices[h.asset], r = ((s.prices[h.asset] - h.cost) / h.cost) * 100;
                return (
                  <tr key={h.asset}><td className="strong">{h.asset}<div className="small faint">{ASSETS[h.asset].chain}</div></td>
                    <td><span className={`pill ${ASSETS[h.asset].cls === 'meme' ? 'solid' : ''}`}>{CLASS_LABEL[ASSETS[h.asset].cls]}</span></td>
                    <td className="num">{h.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="num">${s.prices[h.asset] < 0.1 ? s.prices[h.asset].toFixed(5) : s.prices[h.asset].toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="num strong">{usd(v, 0)}</td><td className="num">{h.asset === 'USDC' ? <span className="faint">0.0%</span> : <Ret v={r} />}</td></tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
        <aside className="about">
          <div><h2 className="h3">By type</h2>
            <div className="alloc">{(Object.entries(byClass) as [AssetClass, number][]).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <div key={c} className="alloc-row"><span><b>{CLASS_LABEL[c]}</b></span><span className="bar"><i style={{ width: `${(v / value) * 100}%` }} /></span><span style={{ textAlign: 'right', fontWeight: 600 }}>{Math.round((v / value) * 100)}%</span></div>
            ))}</div>
          </div>
          <div className="well small muted">Publishing turns these weights into a strategy. Positions stay sealed; the public sees only verified results, so people can fork your real portfolio without seeing your wallet.</div>
        </aside>
      </div>
      {forkTable}
    </div>
  );
  */
}

export function Collection() {
  const s = useStore();
  const { go } = useUi();
  const me = personaUser(s.persona);
  const mine = Object.values(s.nfts).filter((n) => !me || n.owner === me);
  const market = Object.values(s.strategies).filter((x) => x.shares && x.shares.sold < x.shares.total);
  const earned = (sid: string) => s.ledger.filter((l) => l.kind === 'share-payout' && l.to === me && l.memo.includes(s.strategies[sid].title)).reduce((a, l) => a + l.amount, 0);
  return (
    <div className="view">
      <div className="pagehead">
        <div><h1 className="title">{me ? 'Collection' : 'All NFTs'}</h1><p className="muted" style={{ maxWidth: '62ch' }}>Royalty shares that earn from a strategy’s forks, and trophies minted when a sealed call hits its target.</p></div>
        <span className="pill dash">NEP-171 shaped, minted in demo state</span>
      </div>
      {mine.length === 0 ? <div className="box empty" style={{ marginBottom: 20 }}><p className="h2">No NFTs yet</p><p>Buy royalty shares below, or post a play that hits its target.</p></div> : (
        <div className="nfts" style={{ marginBottom: 28 }}>
          {mine.map((n) => n.kind === 'trophy' ? (
            <div key={n.id} className="nft trophy">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 6 }}><Icon n="trophy" s={16} /> <b>Trophy</b></span><span className="std">#{n.id.slice(-6)}</span></div>
              <div><div className="big">{pct(n.meta!.gainPct)}</div><div className="strong" style={{ fontSize: 18, marginTop: 4 }}>{n.meta!.asset} {n.meta!.kind === 'trench' ? 'trench call' : 'call'}</div></div>
              <div className="small"><div className="muted">Called {date(n.meta!.calledAt)}, hit {date(n.meta!.hitAt)}</div><div className="std faint" style={{ marginTop: 4 }}>seal {n.meta!.commitHash.slice(0, 22)}</div><div className="faint" style={{ marginTop: 4 }}>{s.users[n.owner].handle}</div></div>
            </div>
          ) : (
            <button key={n.id} className="nft share linkish" style={{ textAlign: 'left' }} onClick={() => go({ name: 'strategy', id: n.sid! })}>
              <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}><span className="row" style={{ gap: 6 }}><Icon n="gem" s={16} /> <b>Royalty share</b></span><span className="std">#{n.id.slice(-6)}</span></div>
              <div><div className="big">{n.amount}<span style={{ fontSize: 18, fontWeight: 500 }}> / {s.strategies[n.sid!].shares!.total}</span></div><div className="strong" style={{ fontSize: 16, marginTop: 6 }}>{s.strategies[n.sid!].title}</div></div>
              <div className="small"><div className="muted">{s.strategies[n.sid!].shares!.royaltyBps / 100}% of fork royalties, pro rata</div>{me && <div className="gain strong" style={{ marginTop: 4 }}>Earned {earned(n.sid!).toFixed(4)} USDC</div>}<div className="faint" style={{ marginTop: 4 }}>{s.users[n.owner].handle}</div></div>
            </button>
          ))}
        </div>
      )}
      <h2 className="h2" style={{ marginBottom: 12 }}>Royalty shares available</h2>
      <div className="box table-wrap">
        {market.length === 0 ? <div className="empty small">No shares on sale. Creators issue them from their strategy page.</div> : (
          <table>
            <thead><tr><th>Strategy</th><th className="num">Forks</th><th className="num">Holders’ cut</th><th className="num">Available</th><th className="num">Price</th></tr></thead>
            <tbody>{market.map((x) => (
              <tr key={x.id} className="click" onClick={() => go({ name: 'strategy', id: x.id })}>
                <td><div className="strong">{x.title}</div><div className="small faint">{s.users[x.owner].handle}</div></td>
                <td className="num">{engine.children(x.id).length}</td><td className="num">{x.shares!.royaltyBps / 100}%</td>
                <td className="num">{x.shares!.total - x.shares!.sold} of {x.shares!.total}</td><td className="num strong">{x.shares!.price} USDC</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
