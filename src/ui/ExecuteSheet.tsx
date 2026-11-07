import { useEffect, useState } from 'react';
import { engine } from '../core/engine';
import type { Quote, SolverReceipt } from '../core/intents';
import type { PlannedOrder } from '../core/policy';
import { Icon, usd, useStore } from './bits';

type Phase = 'review' | 'quoting' | 'quoted' | 'settling' | 'done' | 'error';

export function ExecuteSheet({ sid, orders, slippage, manual = true, onClose }: { sid: string; orders: PlannedOrder[]; slippage: number; manual?: boolean; onClose: () => void }) {
  const s = useStore();
  const st = s.strategies[sid];
  const wallet = s.users[st.owner];
  const [phase, setPhase] = useState<Phase>('review');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [receipts, setReceipts] = useState<SolverReceipt[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [onClose]);

  const sign = async (q: Quote[]) => {
    setPhase('settling');
    try { setReceipts(await engine.settle(sid, q)); setPhase('done'); engine.toast(`Settled ${q.length} intent${q.length === 1 ? '' : 's'}. Receipts recorded, positions stay sealed.`); }
    catch (e) { setError((e as Error).message); setPhase('error'); }
  };
  const quote = async () => {
    setPhase('quoting');
    try { const q = await engine.quoteOrders(sid, orders, slippage); setQuotes(q); setPhase('quoted'); if (!manual) await sign(q); }
    catch (e) { setError((e as Error).message); setPhase('error'); }
  };
  const idx = { review: 0, quoting: 1, quoted: 2, settling: 3, done: 4, error: 0 }[phase];
  const steps = ['Review orders', 'Get solver quotes', `Sign as ${wallet.handle}`, 'Settle and record receipts'];
  const total = orders.reduce((a, o) => a + o.usd, 0);

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="ex-h" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <div><h2 id="ex-h" className="h2">Execute through NEAR Intents</h2><p className="small muted">{st.title}</p></div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" /></button>
        </div>
        <div className="sheet-body">
          <div className="tl">
            {steps.map((t, i) => (
              <div key={t} className={`tl-item ${i < idx ? 'done' : i === idx ? 'on' : ''}`}>
                <span className="n">{i < idx ? <Icon n="check" s={11} w={2.6} /> : i + 1}</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div className="box" style={{ padding: '2px 16px' }}>
            {orders.map((o, i) => {
              const q = quotes[i], r = receipts[i];
              return (
                <div key={o.asset} className="order">
                  <span className="strong">{usd(o.usd)} USDC on base to {o.asset} on {o.chain}</span>
                  <span className="small faint">{o.weight}%</span>
                  <span className="small muted">{r ? <>Receipt <span className="mono">{r.hash.slice(0, 14)}</span>, signed by solver</> : q ? <>{q.route}. Minimum {q.minOut.toFixed(5)} {o.asset}. Fee {usd(q.feeUsd)}</> : `Slippage limit ${slippage / 100}%`}</span>
                  <span className="small">{q ? `${q.amountOut.toFixed(5)} ${o.asset}` : ''}</span>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Total {usd(total)} from {wallet.name}’s wallet. Scion never takes custody.</p>
          <div className="row" style={{ marginTop: 10, gap: 6 }}><span className="pill dash">Simulated solver and wallet</span><span className="pill gain">Real signatures and receipt chain</span></div>
          {error && <p className="loss small" style={{ marginTop: 10 }}>{error}</p>}
        </div>
        <div className="sheet-foot">
          {phase === 'review' && <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={quote} disabled={!orders.length}>Get quotes</button></>}
          {phase === 'quoting' && <button className="btn" disabled>Requesting quotes</button>}
          {phase === 'quoted' && <button className="btn primary" onClick={() => sign(quotes)}>Sign {quotes.length} intents</button>}
          {phase === 'settling' && <button className="btn" disabled>Settling</button>}
          {phase === 'done' && <button className="btn primary" onClick={onClose}>Done</button>}
          {phase === 'error' && <button className="btn" onClick={() => { setError(''); setPhase('review'); }}>Start over</button>}
        </div>
      </div>
    </div>
  );
}
