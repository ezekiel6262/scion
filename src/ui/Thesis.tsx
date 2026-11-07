import { useMemo, useState } from 'react';
import { engine } from '../core/engine';
import { defaults, FACTS, POINTS, runModel, type ModelInputs } from '../core/thesisModel';
import { Av, Icon, useStore, useUi } from './bits';
import { WatchPill } from './Trust';
import { BackFade } from './Sentiment';

const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });

/** Cumulative volume over real dates, drawn on a time axis. */
function VolumeChart() {
  const W = 620, H = 200, P = 34;
  const t0 = Date.parse(POINTS[0].date), t1 = Date.parse(POINTS.at(-1)!.date);
  const max = 40;
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - 24 - (v / max) * (H - 44);
  const path = POINTS.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.cumB).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" style={{ height: 'auto' }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`NEAR Intents cumulative volume from $${POINTS[0].cumB}B on ${POINTS[0].date} to $${POINTS.at(-1)!.cumB}B on ${POINTS.at(-1)!.date}`}>
      {[0, 10, 20, 30, 40].map((v) => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={P - 6} y={y(v) + 4} fontSize="10.5" textAnchor="end" fill="var(--fg-3)">${v}B</text></g>)}
      <path d={path} fill="none" stroke="var(--fg)" strokeWidth="2.2" strokeLinejoin="round" />
      {POINTS.map((p, i) => {
        const crowded = i < POINTS.length - 1 && x(POINTS[i + 1].date) - x(p.date) < 46;
        return (
          <g key={p.date}>
            <circle cx={x(p.date)} cy={y(p.cumB)} r="4" fill="var(--bg)" stroke="var(--fg)" strokeWidth="2" />
            {!crowded && <text x={x(p.date)} y={y(p.cumB) - 9} fontSize="10.5" fontWeight="600" textAnchor="middle" fill="var(--fg)">{p.cumB}</text>}
            {!crowded && <text x={x(p.date)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--fg-3)">{fmtDate(p.date)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** The flagship thesis evidence: sourced data and a model anyone can re-run. */
export function NearThesis() {
  const base = useMemo(() => defaults(), []);
  const [inp, setInp] = useState<ModelInputs>(base);
  const r = runModel(POINTS, FACTS, inp);
  const field = (k: keyof ModelInputs, label: string, step: number, unit: string) => (
    <label className="field"><span>{label}</span>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
        <input className="input" type="number" step={step} value={inp[k]} onChange={(e) => setInp({ ...inp, [k]: +e.target.value })} />
        <span className="small faint" style={{ width: 28 }}>{unit}</span>
      </div>
    </label>
  );
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="h3">NEAR Intents cumulative volume, USD billions</div><div className="small faint">Sourced snapshot as of {fmtDate(FACTS.asOf)}. Every point links to its source below.</div></div>
        <span className="pill gain"><Icon n="check" s={12} /> Real data</span>
      </div>
      <VolumeChart />
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div><b>${FACTS.monthlyVolumeRecordUsdB.value}B</b><span>Record month, Sep 2026</span></div>
        <div><b>${FACTS.buybacksUsdM.value}M</b><span>NEAR bought back since Feb</span></div>
        <div><b>${FACTS.marketCapUsdB.value}B</b><span>NEAR market cap, 15 Oct</span></div>
        <div><b>{((FACTS.confidentialShare.confidentialUsdB / FACTS.confidentialShare.totalUsdB) * 100).toFixed(1)}%</b><span>Of volume via Confidential Intents</span></div>
      </div>

      <div className="box">
        <div className="box-head"><h3 className="h3">Re-run the model</h3><button className="btn sm ghost" onClick={() => setInp(base)}>Reset to sourced inputs</button></div>
        <div className="box-body" style={{ display: 'grid', gap: 14 }}>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {field('monthlyVolumeB', 'Monthly volume', 0.1, '$B')}
            {field('takeBps', 'Take rate', 0.1, 'bps')}
            {field('marketCapB', 'Market cap', 0.1, '$B')}
            {field('thresholdPct', 'Thesis needs', 0.1, '%')}
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Step</th><th>Formula</th><th className="num">Result</th></tr></thead>
            <tbody>{r.steps.map((s) => <tr key={s.label}><td>{s.label}</td><td className="mono faint">{s.formula}</td><td className="num strong">{s.value}</td></tr>)}</tbody>
          </table></div>
          <div className={`well strong ${r.holds ? 'gain' : 'loss'}`}>
            Buyback yield {r.buybackYieldPct.toFixed(2)}% of market cap. The thesis needs {inp.thresholdPct}%, so it {r.holds ? 'holds' : 'fails'} at these inputs.
          </div>
          <p className="small faint">Same code runs from the repository: <span className="mono">npm run model -- --monthlyVolumeB=8</span>. The take rate is implied: buybacks divided by volume since end of February, where the February level is derived from a Bankless report.</p>
        </div>
      </div>

      <div className="box">
        <div className="box-head"><h3 className="h3">Sources</h3><span className="small faint">{POINTS.length} data points</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th className="num">Cumulative</th><th>Source</th></tr></thead>
          <tbody>{POINTS.map((p) => <tr key={p.date}><td>{fmtDate(p.date)}</td><td className="num strong">${p.cumB}B</td><td><a href={p.url} target="_blank" rel="noopener noreferrer">{p.source}</a></td></tr>)}</tbody>
        </table></div>
      </div>

      <div className="well small">
        <b>Risks the data shows.</b> {FACTS.incident.text} (<a href={FACTS.incident.url} target="_blank" rel="noopener noreferrer">source</a>). The take rate rests on one buyback total and a derived February baseline, so treat it as an estimate, and volume can fall as fast as it rose.
      </div>
    </div>
  );
}

/** Public theses, for the Plays page and anywhere else theses are browsed. */
export function ThesesList() {
  const s = useStore();
  const { go } = useUi();
  const list = Object.values(s.strategies).filter((x) => x.visibility === 'public' && x.publicContent?.thesis)
    .sort((a, b) => (b.id === 's_near' ? 1 : 0) - (a.id === 's_near' ? 1 : 0) || b.createdAt - a.createdAt);
  if (!list.length) return <div className="box empty">No public theses yet. Publish a strategy as public to start one.</div>;
  return (
    <div className="plays">
      {list.map((st) => {
        const t = st.publicContent!.thesis!;
        const u = s.users[st.owner];
        const real = st.publicContent?.evidence?.kind === 'near-intents';
        return (
          <article key={st.id} className={`play ${real ? 'trench' : ''}`}>
            <div className="play-head">
              <Av u={u} size="sm" /><b>{u.handle}</b>
              <span className="pill gain"><Icon n="eye" s={12} /> Public thesis</span>
              {real && <span className="pill solid"><Icon n="check" s={12} /> Real data</span>}
              <span style={{ marginLeft: 'auto' }}><WatchPill st={st} /></span>
            </div>
            <div className="play-body">
              <button className="linkish h2" style={{ marginBottom: 6 }} onClick={() => go({ name: 'strategy', id: st.id })}>{st.title}</button>
              <p className="muted">{t.claim}</p>
              <div style={{ marginTop: 12 }}><BackFade id={st.id} compact /></div>
            </div>
            <div className="play-foot">
              <span>{engine.children(st.id).length} forks, {st.horizon}</span>
              <span>Confidence {Math.round(t.confidence * 100)}%</span>
              <div className="row" style={{ gap: 6 }}>
                {st.publicContent?.evidence && <button className="btn sm" onClick={() => go({ name: 'strategy', id: st.id })}>Re-run the evidence</button>}
                <button className="btn sm primary" onClick={() => go({ name: 'fork', id: st.id })}><Icon n="fork" s={13} /> Fork free</button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Home banner for the flagship thesis. */
export function FeaturedThesis() {
  const { go } = useUi();
  const r = runModel(POINTS, FACTS, defaults());
  return (
    <section className="featured" aria-labelledby="ft-h">
      <div>
        <div className="row" style={{ gap: 6, marginBottom: 8 }}><span className="pill solid">Featured public thesis</span><span className="pill gain"><Icon n="check" s={12} /> Real, sourced data</span></div>
        <h2 id="ft-h" className="title" style={{ fontSize: 24 }}>The NEAR Intents thesis</h2>
        <p className="muted" style={{ maxWidth: '58ch', marginTop: 6 }}>Cumulative volume went from ${POINTS[0].cumB}B to ${POINTS.at(-1)!.cumB}B in a year, and protocol revenue now buys NEAR. At the September record, that is a {r.buybackYieldPct.toFixed(2)}% yearly buyback on market cap. Change the inputs and check it yourself.</p>
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => go({ name: 'strategy', id: 's_near' })}>Re-run the model</button>
        <button className="btn" onClick={() => go({ name: 'fork', id: 's_near' })}><Icon n="fork" s={14} /> Fork free</button>
      </div>
    </section>
  );
}
