import { useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { applyPolicy, ASSETS, CLASS_LABEL, defaultPolicy, KEY_SPECS } from '../core/policy';
import { aliceDraft, type Draft } from '../core/seed';
import type { Holding, RiskPolicy, Strategy } from '../core/types';
import { act, Av, Icon, SECTION_LABEL, SECTION_ORDER, usd, useStore, useUi } from './bits';

function Holdings({ value, onChange }: { value: Holding[]; onChange: (h: Holding[]) => void }) {
  const total = value.reduce((a, h) => a + h.weight, 0);
  const unused = Object.keys(ASSETS).filter((a) => !value.some((h) => h.asset === a));
  return (
    <div>
      <div className="box table-wrap">
        <table>
          <thead><tr><th>Asset</th><th>Chain</th><th style={{ width: 210 }}>Weight</th><th /></tr></thead>
          <tbody>{value.map((h, i) => (
            <tr key={h.asset}>
              <td className="strong">{h.asset} {ASSETS[h.asset].cls === 'stock' || ASSETS[h.asset].cls === 'meme' ? <span className="pill" style={{ marginLeft: 4 }}>{CLASS_LABEL[ASSETS[h.asset].cls]}</span> : null}</td><td className="muted">{h.chain}</td>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="range" min={0} max={100} value={h.weight} aria-label={`${h.asset} weight slider`} style={{ flex: 1, accentColor: 'var(--fg)' }} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, weight: +e.target.value } : x)))} />
                <input className="input" style={{ width: 64, height: 30 }} type="number" min={0} max={100} value={h.weight} aria-label={`${h.asset} weight`} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, weight: Math.max(0, +e.target.value) } : x)))} />
              </div></td>
              <td className="num"><button className="btn ghost sm" aria-label={`Remove ${h.asset}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon n="x" s={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <div className="row" style={{ gap: 6 }}>{unused.map((a) => <button key={a} className="btn sm" onClick={() => onChange([...value, { asset: a, chain: ASSETS[a].chain, weight: 0 }])}><Icon n="plus" s={13} /> {a}</button>)}</div>
        <span className={`strong ${Math.abs(total - 100) < 0.5 ? 'gain' : 'loss'}`}>Total {total}%</span>
      </div>
    </div>
  );
}

function RoyaltyFlow({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona)!;
  const chain: Strategy[] = [];
  let p: Strategy | undefined = st;
  while (p) { chain.push(p); p = p.parent ? s.strategies[p.parent.id] : undefined; }
  return (
    <div>
      <div className="flow-node"><Av u={s.users[me]} size="sm" /><div><div className="strong small">Your fork</div><div className="small faint">{s.users[me].handle}</div></div></div>
      {chain.map((c) => (
        <div key={c.id}>
          <div className="flow-arrow"><Icon n="up" s={13} /> {c.royaltyBps / 100}% of key revenue, {c.execRoyaltyBps} bps of executed volume</div>
          <div className="flow-node"><Av u={s.users[c.owner]} size="sm" /><div style={{ minWidth: 0 }}><div className="strong small">{c.title}</div><div className="small faint">{s.users[c.owner].handle}</div></div></div>
        </div>
      ))}
    </div>
  );
}

export function ForkFlow({ parentId }: { parentId: string }) {
  const s = useStore();
  const { go, execute } = useUi();
  const me = personaUser(s.persona);
  const parent = s.strategies[parentId];
  const view = parent?.visibility === 'public' ? parent.publicContent : me ? s.views[me]?.[parentId]?.data : undefined;
  const [vis, setVis] = useState<'public' | 'sealed'>('sealed');
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('Half-size intent flow');
  const [note, setNote] = useState('Same thesis with a smaller NEAR position and a larger cash buffer.');
  const [holdings, setHoldings] = useState<Holding[]>(view?.positions?.holdings ?? []);
  const [policy, setPolicy] = useState<RiskPolicy>({ ...defaultPolicy(), capital: 2500, maxPositionPct: 35 });
  const [busy, setBusy] = useState(false);
  if (!parent) return <div className="view empty">Strategy not found.</div>;
  const canFork = parent.visibility === 'public' || engine.activeGrants(me, parentId).some((g) => g.payload.permissions.includes('fork'));
  if (!me || !view?.positions || !canFork) {
    return (
      <div className="view narrow empty">
        <p className="h2">{me ? 'You need a Fork Key' : 'Choose a wallet to fork'}</p>
        <p style={{ margin: '6px 0 16px' }}>Forking “{parent.title}” needs a valid Fork Key from your wallet.</p>
        <button className="btn primary" onClick={() => go({ name: 'strategy', id: parentId, tab: 'access' })}>See keys</button>
      </div>
    );
  }
  const plan = applyPolicy(holdings, policy, view.rules?.leverage ?? 1);
  const num = (k: keyof RiskPolicy) => (e: React.ChangeEvent<HTMLInputElement>) => setPolicy({ ...policy, [k]: +e.target.value });
  const steps = ['Allocation', 'Your limits', 'Review'];

  const publish = async (paper = false) => {
    setBusy(true);
    const draft: Draft = {
      visibility: vis, title, summary: note, tags: [...parent.tags.filter((t) => t !== 'Fork'), 'Fork'], horizon: parent.horizon, riskScore: Math.max(1, parent.riskScore - 1),
      royaltyBps: 1000, execRoyaltyBps: parent.execRoyaltyBps, keys: ['view', 'fork'],
      content: { thesis: view.thesis ? { ...view.thesis, targets: [...view.thesis.targets, `Fork note: ${note}`] } : undefined, positions: { holdings, base: view.positions!.holdings }, rules: view.rules, trades: { trades: [] } },
    };
    const fid = await act(() => engine.fork(parentId, draft, policy.capital, paper));
    if (fid && paper) await engine.paperFill(fid, plan.orders);
    setBusy(false);
    if (!fid) return;
    go({ name: 'strategy', id: fid });
    if (!paper) execute(fid, plan.orders, policy.maxSlippageBps, policy.manualConfirm);
  };

  return (
    <div className="view">
      <div className="pagehead">
        <div>
          <div className="forkof" style={{ marginTop: 0, marginBottom: 6 }}><Icon n="fork" s={14} /> Forking <button className="linkish strong" onClick={() => go({ name: 'strategy', id: parentId })}>{s.users[parent.owner].handle} / {parent.title}</button> at v{parent.versions.at(-1)!.v}</div>
          <h1 className="title">Make it yours</h1>
          <p className="muted">Your fork is a new strategy, sealed with your own keys. Your limits are applied before anything is signed.</p>
        </div>
      </div>
      <nav className="stepper" aria-label="Fork steps">
        {steps.map((l, i) => (
          <button key={l} aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)}>
            <span className="n">{i < step ? <Icon n="check" s={12} w={2.4} /> : i + 1}</span><span className="lbl">{l}</span>
          </button>
        ))}
      </nav>
      <div className="repo">
        <div style={{ display: 'grid', gap: 18 }}>
          {step === 0 && <>
            <label className="field"><span>Fork name</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <div className="field"><span>Your fork is</span>
              <div className="seg2" role="group" aria-label="Fork visibility"><button aria-pressed={vis === 'sealed'} onClick={() => setVis('sealed')}><Icon n="lock" s={13} /> Sealed, sell keys</button><button aria-pressed={vis === 'public'} onClick={() => setVis('public')}><Icon n="eye" s={13} /> Public, free to fork</button></div>
            </div>
            <label className="field"><span>What you changed, shown publicly</span><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="field"><span>Allocation, starting from {s.users[parent.owner].name}’s</span><Holdings value={holdings} onChange={setHoldings} /></div>
          </>}
          {step === 1 && <>
            <div className="grid3">
              <label className="field"><span>Capital (USD)</span><input className="input" type="number" value={policy.capital} onChange={num('capital')} /></label>
              <label className="field"><span>Max position %</span><input className="input" type="number" value={policy.maxPositionPct} onChange={num('maxPositionPct')} /></label>
              <label className="field"><span>Max slippage (bps)</span><input className="input" type="number" value={policy.maxSlippageBps} onChange={num('maxSlippageBps')} /></label>
              <label className="field"><span>Daily loss limit %</span><input className="input" type="number" value={policy.dailyLossPct} onChange={num('dailyLossPct')} /></label>
              <label className="field"><span>Max leverage</span><input className="input" type="number" value={policy.maxLeverage} onChange={num('maxLeverage')} /></label>
              <label className="field"><span>Copy delay (min)</span><input className="input" type="number" value={policy.copyDelayMin} onChange={num('copyDelayMin')} /></label>
            </div>
            <div className="field"><span>Allowed assets</span>
              <div className="row">{Object.keys(ASSETS).map((a) => (
                <label key={a} className="check"><input type="checkbox" checked={policy.allowedAssets.includes(a)} onChange={(e) => setPolicy({ ...policy, allowedAssets: e.target.checked ? [...policy.allowedAssets, a] : policy.allowedAssets.filter((x) => x !== a) })} /> {a}</label>
              ))}</div>
            </div>
            <label className="check"><input type="checkbox" checked={policy.manualConfirm} onChange={(e) => setPolicy({ ...policy, manualConfirm: e.target.checked })} /> Ask me to confirm before signing</label>
          </>}
          {step === 2 && <>
            <div className="box">
              <div className="box-head"><h2 className="h3">{title}</h2><span className="pill">Fork of {parent.title}</span></div>
              <div className="box-body"><p className="muted">{note}</p>
                <dl className="kv" style={{ marginTop: 14 }}><dt>Capital</dt><dd>{usd(policy.capital, 0)}</dd><dt>Position cap</dt><dd>{policy.maxPositionPct}%</dd><dt>Slippage limit</dt><dd>{policy.maxSlippageBps} bps</dd><dt>Sealed with</dt><dd>Your own keys</dd><dt>Keys you’ll sell</dt><dd>View, Fork</dd></dl>
              </div>
            </div>
            <div><div className="label" style={{ marginBottom: 8 }}>Where your fork’s revenue goes</div><RoyaltyFlow st={parent} /></div>
          </>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < 2
              ? <button className="btn primary" onClick={() => setStep(step + 1)}>Continue</button>
              : <div className="row">
                  <button className="btn lg" disabled={busy || plan.blocked.length > 0 || plan.orders.length === 0} onClick={() => publish(true)} title="Track it at market prices without executing">Paper fork</button>
                  <button className="btn primary lg" disabled={busy || plan.blocked.length > 0 || plan.orders.length === 0} onClick={() => publish(false)}>{busy ? 'Sealing your fork' : 'Publish fork and execute'}</button>
                </div>}
          </div>
        </div>

        <aside className="about">
          <div className="box">
            <div className="box-head"><h2 className="h3">What will execute</h2><span className="small faint">from your wallet</span></div>
            <div className="box-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {plan.orders.map((o) => <div key={o.asset} className="order"><span className="strong">{o.asset} <span className="faint small">on {o.chain}</span></span><span>{usd(o.usd)}</span><span className="small faint">{o.weight}% of capital</span></div>)}
              <div className="order"><span className="strong">USDC reserve</span><span>{usd(policy.capital * plan.cashWeight / 100)}</span></div>
            </div>
            {(plan.notes.length > 0 || plan.blocked.length > 0) && (
              <div className="box-body" style={{ borderTop: '1px solid var(--line)', display: 'grid', gap: 6 }}>
                {plan.notes.map((n) => <p key={n} className="small"><b>Limit applied.</b> {n}</p>)}
                {plan.blocked.map((n) => <p key={n} className="small loss">{n}</p>)}
              </div>
            )}
          </div>
          <p className="small faint">Scion never holds your funds. {s.users[parent.owner].name} cannot move them. You sign every intent.</p>
        </aside>
      </div>
    </div>
  );
}

