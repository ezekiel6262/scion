import { useMemo, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { ASSETS, CLASS_LABEL, KEY_SPECS } from '../core/policy';
import { aliceDraft, type Draft } from '../core/seed';
import { act, Icon, SECTION_LABEL, SECTION_ORDER, usd, useStore, useUi } from './bits';
import { useLive } from './live';

type Source = 'buy' | 'held';
interface Row { asset: string; source: Source; usd: number; units: number }
const fmtUnits = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : 2 });

export function Studio({ fromPortfolio }: { fromPortfolio?: boolean }) {
  const s = useStore();
  const { go, execute } = useUi();
  const live = useLive();
  const me = personaUser(s.persona) ?? (live.session ? 'alice' : null);
  const wallet = me ? s.portfolios[me] : undefined;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => (fromPortfolio ? engine.portfolioDraft(aliceDraft()) : null) ?? aliceDraft());
  const [rows, setRows] = useState<Row[]>(() => {
    const p = me ? engine.state.portfolios[me] : undefined;
    if (fromPortfolio && p) return p.holdings.filter((h) => ASSETS[h.asset].cls !== 'cash').map((h) => ({ asset: h.asset, source: 'held' as Source, usd: 0, units: h.units }));
    return [{ asset: 'NEAR', source: 'buy', usd: 4500, units: 0 }, { asset: 'BTC', source: 'buy', usd: 2000, units: 0 }, { asset: 'ETH', source: 'buy', usd: 1000, units: 0 }];
  });
  const [reserve, setReserve] = useState(fromPortfolio ? 0 : 2500);
  const [fund, setFund] = useState<'wallet' | 'demo'>(fromPortfolio && wallet ? 'wallet' : 'demo');
  const [busy, setBusy] = useState(false);

  const held = (a: string) => wallet?.holdings.find((h) => h.asset === a)?.units ?? 0;
  const value = (r: Row) => (r.source === 'buy' ? r.usd : r.units * s.prices[r.asset]);
  const calc = useMemo(() => {
    const heldValue = rows.filter((r) => r.source === 'held').reduce((a, r) => a + value(r), 0);
    const buys = rows.filter((r) => r.source === 'buy').reduce((a, r) => a + r.usd, 0);
    const total = heldValue + buys + reserve;
    const byAsset = new Map<string, number>();
    rows.forEach((r) => byAsset.set(r.asset, (byAsset.get(r.asset) ?? 0) + value(r)));
    if (reserve > 0) byAsset.set('USDC', (byAsset.get('USDC') ?? 0) + reserve);
    const holdings = [...byAsset].filter(([, v]) => v > 0).map(([asset, v]) => ({ asset, chain: ASSETS[asset].chain, weight: total ? Math.round((v / total) * 100) : 0 }));
    if (holdings.length) { const diff = 100 - holdings.reduce((a, h) => a + h.weight, 0); holdings.sort((a, b) => b.weight - a.weight)[0].weight += diff; }
    const problems: string[] = [];
    rows.forEach((r) => {
      if (r.source === 'held' && r.units > held(r.asset) + 1e-9) problems.push(`You hold ${fmtUnits(held(r.asset))} ${r.asset}, not ${fmtUnits(r.units)}.`);
      if (r.source === 'held' && !(r.units > 0)) problems.push(`Set how much ${r.asset} you’re putting in.`);
      if (r.source === 'buy' && !(r.usd > 0)) problems.push(`Set how much ${r.asset} to buy.`);
    });
    if (new Set(rows.map((r) => r.asset + r.source)).size !== rows.length) problems.push('Each token can appear once per source.');
    if (fund === 'wallet' && me && engine.cashIn(me) + 1e-6 < buys + reserve) problems.push(`Your wallet has ${usd(engine.cashIn(me))} in USDC. Buys and reserve need ${usd(buys + reserve)}.`);
    if (total <= 0) problems.push('Add at least one position.');
    return { heldValue, buys, total, holdings, problems };
  }, [rows, reserve, fund, s.prices, wallet]);

  if (!live.session) return <div className="view narrow empty"><p className="h2">Connect a real NEAR wallet to publish</p><p>Your strategy will be owned by the verified NEAR account that signs in.</p><button className="btn primary lg" onClick={()=>act(()=>live.connect())}><Icon n="wallet" s={16}/> Connect NEAR wallet</button></div>;
  if (!live.profile) return <div className="view narrow empty"><p className="h2">Create your Scion profile first</p><p>Your NEAR wallet is verified. Add a public name and handle before publishing.</p><button className="btn primary lg" onClick={()=>go({name:'account'})}>Create profile</button></div>;
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const steps = ['Story', 'Positions', 'Keys', 'Review'];
  const okStep = [d.title.trim().length > 0, calc.problems.length === 0, d.visibility === 'public' || d.keys.length > 0, true];

  const publish = async () => {
    setBusy(true);
    const draft: Draft = { ...d, content: { ...d.content, positions: { holdings: calc.holdings } } };
    const buys = rows.filter((r) => r.source === 'buy').map((r) => ({ asset: r.asset, chain: ASSETS[r.asset].chain, usd: r.usd, weight: Math.round((r.usd / calc.total) * 100) }));
    const liveStrategy = await act(() => live.publish({
      name: draft.title.trim(),
      slug: draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || `strategy-${Date.now()}`,
      thesis: { summary: draft.content.thesis?.claim ?? draft.summary, evidence: draft.content.thesis?.catalysts ?? [] },
      positions: calc.holdings.map((holding) => ({ asset: holding.asset, chain: holding.chain, targetWeightBps: holding.weight * 100 })),
      rules: {
        maxSlippageBps: 50,
        entry: draft.content.rules?.entry.join('; ') ?? 'Creator-defined entry',
        exit: draft.content.rules?.exit.join('; ') ?? 'Creator-defined exit',
      },
      risk: { maxDrawdownBps: Math.round((draft.content.rules?.maxDrawdownPct ?? draft.riskScore * 2) * 100), leverageBps: Math.round((draft.content.rules?.leverage ?? 1) * 10_000) },
      horizonDays: Math.max(1, Number.parseInt(draft.horizon, 10) || 90),
      royaltyBps: draft.royaltyBps,
    }));
    if (!liveStrategy) { setBusy(false); return; }
    const sid = await act(() => engine.publish(draft, undefined, calc.total, false, {
      held: rows.filter((r) => r.source === 'held').map((r) => ({ asset: r.asset, units: r.units })), buys, walletFunded: fund === 'wallet',
    }));
    setBusy(false);
    if (!sid) return;
    engine.toast(`Published live as ${liveStrategy.owner}.`, 'ok');
    go({ name: 'strategy', id: sid });
    if (buys.length) execute(sid, buys, 50);
  };

  return (
    <div className="view">
      <div className="pagehead"><div><h1 className="title">{fromPortfolio ? 'Publish your portfolio' : 'New strategy'}</h1><p className="muted">Publish what you already hold, buy into it now, or both. Make it public and free to fork, or seal it and sell keys.</p></div></div>
      <nav className="stepper" aria-label="Publish steps">
        {steps.map((l, i) => (
          <button key={l} aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)}>
            <span className="n">{i < step ? <Icon n="check" s={12} w={2.4} /> : i + 1}</span><span className="lbl">{l}</span>
          </button>
        ))}
      </nav>

      <div className="repo">
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {step === 0 && <>
            <div className="field"><span>Who can see it</span>
              <div className="choices" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
                <button className="choice" aria-checked={d.visibility === 'public'} role="radio" onClick={() => setD({ ...d, visibility: 'public' })}><span className="radio" /><span className="strong"><Icon n="eye" s={13} /> Public</span><span /><p>Anyone reads every section and forks it free. Forks pay you royalties.</p></button>
                <button className="choice" aria-checked={d.visibility !== 'public'} role="radio" onClick={() => setD({ ...d, visibility: 'sealed' })}><span className="radio" /><span className="strong"><Icon n="lock" s={13} /> Sealed</span><span /><p>Sections are encrypted. You sell keys to the parts you choose.</p></button>
              </div>
            </div>
            <label className="field"><span>Name</span><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
            <label className="field"><span>Summary, public</span><textarea className="input" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} /></label>
            <div className="grid2">
              <label className="field"><span>Horizon</span><input className="input" value={d.horizon} onChange={(e) => setD({ ...d, horizon: e.target.value })} /></label>
              <label className="field"><span>Risk, 1 to 10</span><input className="input" type="number" min={1} max={10} value={d.riskScore} onChange={(e) => setD({ ...d, riskScore: +e.target.value })} /></label>
            </div>
            <label className="field"><span><Icon n="lock" s={12} /> Thesis, sealed</span><textarea className="input" value={d.content.thesis!.claim} onChange={(e) => setD({ ...d, content: { ...d.content, thesis: { ...d.content.thesis!, claim: e.target.value } } })} /></label>
            <p className="small faint">Rules, the thesis watch conditions, the evidence dataset and the model come from the template and are sealed too.</p>
          </>}

          {step === 1 && <>
            <div className="banner" style={{ marginBottom: 0 }}>
              {wallet ? (
                <span><b>{s.users[me!].handle}</b> connected, read-only. {usd(engine.portfolioValue(wallet), 0)} in tokens, {usd(engine.cashIn(me!))} in USDC.</span>
              ) : (
                <span><b>Already hold tokens?</b> Connect your wallet to put them in this strategy without selling.</span>
              )}
              {wallet ? <button className="btn sm" onClick={() => go({ name: 'trade' })}><Icon n="swap" s={13} /> Trade</button>
                : <button className="btn sm primary" onClick={() => act(() => engine.connectWallet())}><Icon n="wallet" s={13} /> Connect wallet</button>}
            </div>
            <div className="box table-wrap">
              <table>
                <thead><tr><th>Token</th><th>Source</th><th>Amount</th><th className="num">Value</th><th /></tr></thead>
                <tbody>{rows.map((r, i) => {
                  const h = held(r.asset);
                  return (
                    <tr key={i}>
                      <td style={{ minWidth: 150 }}>
                        <select className="input" value={r.asset} onChange={(e) => set(i, { asset: e.target.value, units: r.source === 'held' ? held(e.target.value) : 0 })} aria-label="Token">
                          {Object.entries(ASSETS).filter(([, a]) => a.cls !== 'cash').map(([k, a]) => <option key={k} value={k}>{k}, {CLASS_LABEL[a.cls].toLowerCase()} on {a.chain}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="seg2" role="group" aria-label={`${r.asset} source`}>
                          <button aria-pressed={r.source === 'buy'} onClick={() => set(i, { source: 'buy', usd: r.usd || 500 })}>Buy now</button>
                          <button aria-pressed={r.source === 'held'} disabled={!wallet || h <= 0} title={!wallet ? 'Connect your wallet first' : h <= 0 ? `Your wallet has no ${r.asset}` : undefined} onClick={() => set(i, { source: 'held', units: h })}>Already hold</button>
                        </div>
                      </td>
                      <td style={{ minWidth: 190 }}>
                        {r.source === 'buy' ? (
                          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}><span className="faint">$</span><input className="input" type="number" min={0} value={r.usd} onChange={(e) => set(i, { usd: +e.target.value })} aria-label={`${r.asset} to buy in USD`} /></div>
                        ) : (
                          <div>
                            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}><input className="input" type="number" min={0} step="any" value={r.units} onChange={(e) => set(i, { units: +e.target.value })} aria-label={`${r.asset} units`} /><button className="btn sm" onClick={() => set(i, { units: h })}>Max</button></div>
                            <div className="small faint" style={{ marginTop: 4 }}>of {fmtUnits(h)} held</div>
                          </div>
                        )}
                      </td>
                      <td className="num strong">{usd(value(r), 0)}</td>
                      <td className="num"><button className="btn ghost sm" aria-label={`Remove ${r.asset}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon n="x" s={14} /></button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setRows([...rows, { asset: 'SOL', source: 'buy', usd: 500, units: 0 }])}><Icon n="plus" s={14} /> Add token</button>
              <label className="row" style={{ gap: 8 }}><span className="small muted">Cash reserve, USDC</span><input className="input" style={{ width: 120 }} type="number" min={0} value={reserve} onChange={(e) => setReserve(Math.max(0, +e.target.value))} /></label>
            </div>
            {calc.buys + reserve > 0 && (
              <div className="field"><span>Pay for buys and reserve with</span>
                <div className="seg2" role="group" aria-label="Funding">
                  <button aria-pressed={fund === 'wallet'} disabled={!wallet} onClick={() => setFund('wallet')}>Wallet USDC</button>
                  <button aria-pressed={fund === 'demo'} onClick={() => setFund('demo')}>Demo capital</button>
                </div>
              </div>
            )}
            {rows.some((r) => r.source === 'held') && <p className="small muted"><b>About tokens you already hold:</b> they join the strategy at today’s price. Its verified record starts now, so old gains never count, and nothing is sold or moved.</p>}
            {calc.problems.map((p) => <p key={p} className="small loss">{p}</p>)}
          </>}

          {step === 2 && <>
            {d.visibility === 'public' ? <div className="well">This strategy is public, so there are no keys to sell. Anyone can fork it free, and forks pay you the royalties below.</div> :
            <div className="choices">{KEY_SPECS.filter((k) => k.live).map((k) => (
              <label key={k.cls} className="choice" style={{ cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: 'var(--fg)' }} checked={d.keys.includes(k.cls)} onChange={(e) => setD({ ...d, keys: e.target.checked ? [...d.keys, k.cls] : d.keys.filter((x) => x !== k.cls) })} />
                <span className="strong">{k.label}</span><span className="strong">{k.price} USDC</span>
                <span className="secs">{SECTION_ORDER.map((x) => <span key={x} className={`pill ${k.sections.includes(x) ? 'solid' : ''}`} style={k.sections.includes(x) ? undefined : { opacity: .5 }}>{SECTION_LABEL[x]}</span>)}</span>
              </label>
            ))}</div>}
            <div className="grid2">
              <label className="field"><span>Royalty from forks’ key revenue %</span><input className="input" type="number" min={0} max={30} value={d.royaltyBps / 100} onChange={(e) => setD({ ...d, royaltyBps: +e.target.value * 100 })} /></label>
              <label className="field"><span>Royalty on forks’ executed volume (bps)</span><input className="input" type="number" min={0} max={50} value={d.execRoyaltyBps} onChange={(e) => setD({ ...d, execRoyaltyBps: +e.target.value })} /></label>
            </div>
          </>}

          {step === 3 && (
            <div className="box">
              <div className="box-head"><h2 className="h3">What happens when you publish</h2></div>
              <div className="box-body tl" style={{ margin: 0 }}>
                <div className="tl-item on"><span className="n">1</span><span>Authenticate this creator device with a fresh cryptographic signature</span></div>
                <div className="tl-item on"><span className="n">2</span><span>Persist the strategy and immutable version in Scion’s live AWS database</span></div>
                <div className="tl-item on"><span className="n">3</span><span>{d.visibility === 'public' ? 'Publish every section openly, versioned and signed' : 'Seal 5 sections with new keys in your browser'}</span></div>
                {rows.some((r) => r.source === 'held') && <div className="tl-item on"><span className="n">4</span><span>Record a signed holding proof for {rows.filter((r) => r.source === 'held').length} token{rows.filter((r) => r.source === 'held').length > 1 ? 's' : ''} you already hold. The public sees only the count.</span></div>}
                {rows.filter((r) => r.source === 'buy').map((r, i) => (
                  <div key={r.asset} className="tl-item on"><span className="n">{(rows.some((x) => x.source === 'held') ? 5 : 4) + i}</span><span>Buy {usd(r.usd, 0)} of {r.asset}, {engine.route('USDC', r.asset)}, from {fund === 'wallet' ? 'your wallet’s USDC' : 'demo capital'}. You sign it next.</span></div>
                ))}
                <div className="tl-item on"><span className="n">{4 + rows.filter((r) => r.source === 'buy').length + (rows.some((r) => r.source === 'held') ? 1 : 0)}</span><span>Start the verified record at today’s prices</span></div>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < 3
              ? <button className="btn primary" disabled={!okStep[step]} onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="btn primary lg" disabled={busy || live.status !== 'live' || calc.problems.length > 0 || !d.title.trim() || (d.visibility !== 'public' && !d.keys.length)} onClick={publish}>{busy ? 'Publishing live…' : live.status !== 'live' ? 'Live API unavailable' : rows.some((r) => r.source === 'buy') ? 'Publish live and buy' : 'Publish live'}</button>}
          </div>
        </div>

        <aside className="about">
          <div className="box">
            <div className="box-head"><h2 className="h3">Allocation</h2><span className="small faint">{usd(calc.total, 0)}</span></div>
            <div className="box-body alloc">
              {calc.holdings.length === 0 ? <p className="small muted">Add a token to see the allocation.</p> : calc.holdings.map((h) => (
                <div key={h.asset} className="alloc-row"><span><b>{h.asset}</b><small>{h.asset === 'USDC' ? 'reserve' : [rows.some((r) => r.asset === h.asset && r.source === 'held') && 'held', rows.some((r) => r.asset === h.asset && r.source === 'buy') && 'buying'].filter(Boolean).join(' and ')}</small></span><span className="bar"><i style={{ width: `${h.weight}%` }} /></span><span style={{ textAlign: 'right', fontWeight: 600 }}>{h.weight}%</span></div>
              ))}
            </div>
          </div>
          <div className="box">
            <div className="box-head"><h2 className="h3">The public sees</h2></div>
            <div className="box-body" style={{ display: 'grid', gap: 8 }}>
              <div className="strong">{d.title || 'Untitled'}</div>
              <p className="small muted">{d.summary}</p>
              {d.visibility === 'public' ? <span className="pill gain"><Icon n="eye" s={12} /> Every section, free to fork</span> : <div className="sealedline"><span className="bars" aria-hidden="true"><i style={{ width: '40%' }} /><i style={{ width: '28%' }} /><i style={{ width: '30%' }} /></span>Positions sealed</div>}
              {rows.some((r) => r.source === 'held') && <span className="pill"><Icon n="shield" s={12} /> Holdings verified at publish</span>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
