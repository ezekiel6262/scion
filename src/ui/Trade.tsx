import { useEffect, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { ASSETS, CLASS_LABEL } from '../core/policy';
import { act, date, Icon, usd, useStore, useUi } from './bits';

type Q = Awaited<ReturnType<typeof engine.swapQuote>>;
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : n < 100 ? 4 : 2 });
const price = (n: number) => (n < 0.1 ? `$${n.toFixed(5)}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

export function Trade() {
  const s = useStore();
  const { go } = useUi();
  const me = personaUser(s.persona);
  const wallet = me ? s.portfolios[me] : undefined;
  const [mode, setMode] = useState<'near' | 'intents'>('near');
  const tokens = Object.keys(ASSETS).filter((k) => mode === 'intents' || ASSETS[k].chain === 'near');
  const [from, setFrom] = useState('USDC.n');
  const [to, setTo] = useState('NEAR');
  const [amount, setAmount] = useState(100);
  const [slip, setSlip] = useState(50);
  const [quote, setQuote] = useState<Q | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mode === 'near') { setFrom('USDC.n'); setTo('NEAR'); setAmount(100); } else { setFrom('USDC'); setTo('SOL'); setAmount(200); }
    setQuote(null);
  }, [mode]);
  useEffect(() => setQuote(null), [from, to, amount, slip, s.clock]);

  if (!me) return <div className="view narrow empty"><p className="h2">Choose a wallet to trade</p><p>Switch to Alice or Bob in the sidebar.</p></div>;
  if (!wallet) {
    return (
      <div className="view narrow">
        <div className="pagehead"><div><h1 className="title">Trade</h1><p className="muted">Buy tokens on NEAR, or any supported chain through NEAR Intents, from your own wallet.</p></div></div>
        <div className="box empty"><p className="h2">Connect your wallet to trade</p><p style={{ margin: '6px auto 16px', maxWidth: '44ch' }}>You sign every trade. Scion never holds your funds.</p>
          <button className="btn primary lg" onClick={() => act(() => engine.connectWallet())}><Icon n="wallet" s={16} /> Connect {s.users[me].handle}</button></div>
      </div>
    );
  }
  const bal = (a: string) => wallet.holdings.find((h) => h.asset === a)?.units ?? 0;
  const estOut = (amount * s.prices[from]) * (1 - 0.0008) / s.prices[to];
  const route = engine.route(from, to);
  const getQuote = async () => { setBusy(true); const q = await act(() => engine.swapQuote(from, to, amount, slip)); setBusy(false); if (q) setQuote(q); };
  const doSwap = async () => { if (!quote) return; setBusy(true); await act(() => engine.swap(quote)); setBusy(false); setQuote(null); };
  const opt = (k: string) => <option key={k} value={k}>{k}, {ASSETS[k].chain}</option>;

  return (
    <div className="view">
      <div className="pagehead">
        <div><h1 className="title">Trade</h1><p className="muted">Buy tokens on NEAR, or across chains through NEAR Intents. Then publish what you hold as a strategy.</p></div>
        <span className="pill dash">Simulated solver. Live 1Click quotes in M2</span>
      </div>
      <div className="repo">
        <div style={{ maxWidth: 560 }}>
          <div className="seg2" role="group" aria-label="Where to trade" style={{ marginBottom: 14 }}>
            <button aria-pressed={mode === 'near'} onClick={() => setMode('near')}>On NEAR</button>
            <button aria-pressed={mode === 'intents'} onClick={() => setMode('intents')}>Cross-chain via NEAR Intents</button>
          </div>
          <div className="box">
            <div className="swap-leg">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">You pay</span><span className="small faint">Balance {fmt(bal(from))} <button className="linkish strong" onClick={() => setAmount(+bal(from).toFixed(6))}>Max</button></span></div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input swap-amt" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(+e.target.value)} aria-label="Amount to pay" />
                <select className="input" style={{ width: 170 }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Token to pay">{tokens.filter((k) => k !== to).map(opt)}</select>
              </div>
              <div className="small faint">{usd(amount * s.prices[from])}</div>
            </div>
            <div style={{ display: 'grid', placeItems: 'center', margin: '-14px 0', position: 'relative', zIndex: 1 }}>
              <button className="btn sm" style={{ borderRadius: 99, background: 'var(--bg)' }} aria-label="Swap direction" onClick={() => { setFrom(to); setTo(from); }}><Icon n="up" s={14} /></button>
            </div>
            <div className="swap-leg" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">You get</span><span className="small faint">Balance {fmt(bal(to))}</span></div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="input swap-amt" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)' }} aria-live="polite">{quote ? fmt(quote.amountOut) : amount > 0 ? `≈ ${fmt(estOut)}` : '0'}</div>
                <select className="input" style={{ width: 170 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Token to get">{tokens.filter((k) => k !== from).map(opt)}</select>
              </div>
              <div className="small faint">{CLASS_LABEL[ASSETS[to].cls]}, {price(s.prices[to])} each{ASSETS[to].cls === 'stock' ? ', simulated' : ''}{ASSETS[to].cls === 'meme' ? ', demo memecoin' : ''}</div>
            </div>
            <div className="box-body" style={{ borderTop: '1px solid var(--line)', display: 'grid', gap: 8 }}>
              <dl className="kv">
                <dt>Route</dt><dd>{route}</dd>
                <dt>Rate</dt><dd>1 {to} = {fmt(s.prices[to] / s.prices[from])} {from}</dd>
                <dt>Solver fee</dt><dd>{quote ? usd(quote.feeUsd) : '0.08%'}</dd>
                <dt>Minimum received</dt><dd>{quote ? `${fmt(quote.minOut)} ${to}` : 'Quote to see'}</dd>
              </dl>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small muted">Slippage limit</span>
                <div className="seg2" role="group" aria-label="Slippage">{[30, 50, 100].map((b) => <button key={b} aria-pressed={slip === b} onClick={() => setSlip(b)}>{b / 100}%</button>)}</div>
              </div>
            </div>
            <div className="sheet-foot" style={{ position: 'static' }}>
              {!quote ? <button className="btn primary lg full" disabled={busy || !(amount > 0)} onClick={getQuote}>{busy ? 'Getting quote' : 'Get quote'}</button>
                : <button className="btn primary lg full" disabled={busy} onClick={doSwap}>{busy ? 'Settling' : `Sign and buy ${fmt(quote.amountOut)} ${to}`}</button>}
            </div>
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>You sign every trade from your own wallet. Cross-chain trades settle through NEAR Intents solvers, so you never bridge by hand.</p>
        </div>

        <aside className="about">
          <div className="box">
            <div className="box-head"><h2 className="h3">Wallet</h2><span className="small faint">{usd(engine.portfolioValue(wallet), 0)}</span></div>
            <div>{wallet.holdings.map((h) => (
              <button key={h.asset} className="gnode" style={{ height: 'auto', padding: '10px 16px' }} onClick={() => { if (mode === 'near' && ASSETS[h.asset].chain !== 'near') setMode('intents'); setFrom(h.asset); }}>
                <span className="t"><span>{h.asset}</span><span className="faint small" style={{ fontWeight: 400 }}>{ASSETS[h.asset].chain}</span></span>
                <span className="r">{usd(h.units * s.prices[h.asset], 0)}<small>{fmt(h.units)}</small></span>
              </button>
            ))}</div>
          </div>
          <div className="box">
            <div className="box-head"><h2 className="h3">Recent trades</h2></div>
            <div className="box-body" style={{ display: 'grid', gap: 10 }}>
              {(wallet.trades ?? []).length === 0 ? <p className="small muted">No trades yet.</p> : wallet.trades!.slice(0, 5).map((t) => (
                <div key={t.id} className="small"><b>{fmt(t.amountIn)} {t.from} for {fmt(t.amountOut)} {t.to}</b><div className="faint">{t.route}, {date(t.ts)}, receipt <span className="mono">{t.hash.slice(0, 8)}</span></div></div>
              ))}
            </div>
          </div>
          <button className="btn full" onClick={() => go({ name: 'studio-portfolio' })}><Icon n="up" s={14} /> Publish what I hold</button>
        </aside>
      </div>
    </div>
  );
}
