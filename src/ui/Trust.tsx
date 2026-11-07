import { useEffect, useMemo, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import type { Strategy } from '../core/types';
import { act, date, Icon, pct, useStore } from './bits';

// ------------------------------------------------------------------ thesis watch
export function WatchPill({ st }: { st: Strategy }) {
  const s = useStore();
  const w = s.watches[st.id];
  if (!w) return null;
  return w.state === 'invalidated'
    ? <span className="pill solid" title={`Invalidated ${date(w.at!)} UTC`}><Icon n="x" s={12} w={2.4} /> Thesis invalidated</span>
    : <span className="pill"><Icon n="eye" s={12} /> Thesis holding</span>;
}

export function ThesisWatch({ st }: { st: Strategy }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const w = s.watches[st.id];
  const rules = st.publicContent?.rules ?? (me ? s.views[me]?.[st.id]?.data.rules : undefined);
  const results = useMemo(() => (rules?.watch ? engine.checkConditions(st.id, rules.watch) : null), [rules, st.id, s.feed, s.prices, s.attestations]);
  if (!w) return null;
  const bad = w.state === 'invalidated';
  return (
    <section className={`watch ${bad ? 'bad' : ''}`} aria-labelledby="watch-h">
      <div className="watch-head">
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <span className="watch-dot" aria-hidden="true" style={{ marginTop: 5 }} />
          <div>
            <h2 id="watch-h" className="h3">{bad ? `Thesis invalidated on ${date(w.at!)} UTC` : 'Thesis watch: holding'}</h2>
            <p className="small muted">
              {bad ? `The gateway found one of the creator’s ${st.visibility === 'public' ? '' : 'sealed '}invalidation conditions true. ` : `The gateway checks the creator’s ${st.visibility === 'public' ? '' : 'sealed '}invalidation conditions every market day. `}
              {w.seeded ? 'Seeded history.' : `Checked ${w.checks} time${w.checks === 1 ? '' : 's'}, last ${date(w.lastCheck)} UTC.`}
            </p>
          </div>
        </div>
        <button className="btn sm" onClick={() => act(async () => engine.toast((await engine.verifyWatch(w)) ? 'Watch status signature valid.' : 'Signature invalid.', (await engine.verifyWatch(w)) ? 'ok' : 'bad'))}>Verify</button>
      </div>
      {results ? (
        <div className="watch-list">
          {results.map((r) => (
            <div key={r.label} className={`watch-row ${r.tripped ? 'tripped' : ''}`}>
              <span className="watch-ic">{r.tripped ? <Icon n="x" s={12} w={2.6} /> : <Icon n="check" s={12} w={2.6} />}</span>
              <span>{r.label}</span>
              <span className="small muted">{r.value}</span>
            </div>
          ))}
          <p className="small faint">You see the conditions because your key opens the rules. The public only sees holding or invalidated.</p>
        </div>
      ) : (
        <p className="small faint watch-note">{st.visibility === 'public' ? 'This thesis is public, so its invalidation conditions are listed in the Thesis section for anyone to check.' : 'Which condition was checked stays sealed. Keys that open the rules show each condition and its live value.'}</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ verified card
function wrap(text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/.{0,2}$/, '…'); }
  return lines;
}
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A self-contained SVG card. Plain fonts and colors so it renders anywhere it is pasted. */
export function cardSvg(sid: string, dark: boolean) {
  const s = engine.state;
  const st = s.strategies[sid];
  const a = s.attestations[sid];
  const u = s.users[st.owner];
  const w = s.watches[sid];
  const cs = engine.cosign(sid);
  const bg = dark ? '#000000' : '#FFFFFF', fg = dark ? '#FFFFFF' : '#000000', mid = dark ? '#A3A3A3' : '#5C5C5C', line = dark ? '#2A2A2A' : '#E3E3E3';
  const gain = a && a.returnPct < 0 ? (dark ? '#FF6B5E' : '#C2261B') : (dark ? '#4FD488' : '#0E7A3A');
  const code = engine.cardCode(sid) ?? '';
  const font = `font-family="Geist, Helvetica Neue, Helvetica, Arial, sans-serif"`;
  const mono = `font-family="Geist Mono, SFMono-Regular, Menlo, monospace"`;
  const stats = [
    ['Max drawdown', a ? `${a.maxDrawdownPct.toFixed(1)}%` : '0%'],
    ['Sharpe', a ? a.sharpe.toFixed(2) : '0.00'],
    ['Receipts', a ? String(a.receipts) : '0'],
    ['Forks', String(engine.children(sid).length)],
    ['Co-signers', String(cs.count)],
  ];
  const title = wrap(st.title, 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${bg}"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="${line}" stroke-width="2"/>
<g transform="translate(72 72)"><rect width="44" height="44" rx="11" fill="${fg}"/><path d="M15 12v20M15 27c0-5 4-7 13-7" stroke="${bg}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="15" cy="12" r="4" fill="${bg}"/><circle cx="15" cy="32" r="4" fill="${bg}"/><circle cx="30" cy="20" r="4" fill="${bg}"/></g>
<text x="130" y="104" ${font} font-size="32" font-weight="750" fill="${fg}" letter-spacing="-1.2">scion</text>
<g transform="translate(1128 80)"><text text-anchor="end" ${font} font-size="22" font-weight="600" fill="${fg}">Verified card</text><text y="28" text-anchor="end" ${font} font-size="18" fill="${mid}">${a ? `epoch ${a.epoch}${a.seeded ? ', seeded history' : ''}${a.paper ? ', paper' : ''}` : 'no record yet'}</text></g>
${title.map((l, i) => `<text x="72" y="${196 + i * 58}" ${font} font-size="50" font-weight="700" fill="${fg}" letter-spacing="-1.8">${esc(l)}</text>`).join('')}
<text x="72" y="${196 + title.length * 58 + 4}" ${font} font-size="24" fill="${mid}">${esc(u.handle)}${st.parent ? `, fork of ${esc(s.strategies[st.parent.id].title)}` : ''}</text>
<text x="72" y="458" ${font} font-size="112" font-weight="750" fill="${gain}" letter-spacing="-5">${a ? pct(a.returnPct) : 'New'}</text>
<text x="76" y="494" ${font} font-size="20" fill="${mid}">Verified return from signed receipts</text>
${stats.map(([k, v], i) => `<g transform="translate(${560 + (i < 3 ? i : i - 3) * 196} ${i < 3 ? 352 : 440})"><text ${font} font-size="38" font-weight="650" fill="${fg}" letter-spacing="-1">${v}</text><text y="30" ${font} font-size="18" fill="${mid}">${k}</text></g>`).join('')}
<g transform="translate(952 412)"><rect width="176" height="12" rx="3" fill="${fg}"/><rect width="128" height="12" rx="3" fill="${fg}" y="18"/><rect width="150" height="12" rx="3" fill="${fg}" y="36"/><text y="76" ${font} font-size="18" fill="${mid}">Positions sealed</text></g>
${w ? `<g transform="translate(948 128)"><rect width="180" height="38" rx="19" fill="${w.state === 'invalidated' ? fg : 'none'}" stroke="${fg}" stroke-width="2"/><text x="90" y="25" text-anchor="middle" ${font} font-size="17" font-weight="600" fill="${w.state === 'invalidated' ? bg : fg}">${w.state === 'invalidated' ? 'Thesis invalidated' : 'Thesis holding'}</text></g>` : ''}
<line x1="72" y1="540" x2="1128" y2="540" stroke="${line}" stroke-width="2"/>
<text x="72" y="576" ${mono} font-size="18" fill="${mid}">Verify: ${code.slice(0, 16)}…${code.slice(-10)}</text>
<text x="1128" y="576" text-anchor="end" ${font} font-size="18" fill="${mid}">Paste the full code at scion, Security log, Verify a card</text>
</svg>`;
}

async function saveFile(filename: string, data: Blob | string) {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<{ save: (r: { filename: string; data: Blob | string }) => Promise<unknown> } | null> } }).claude;
  if (c?.use) {
    const d = await c.use('downloads').catch(() => null);
    if (d) {
      try { await d.save({ filename, data }); return true; } catch (e) { const code = (e as { code?: string }).code; if (code === 'declined') return false; throw new Error('Saving is not available here. Copy the card code instead.'); }
    }
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: 'image/svg+xml' }) : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return true;
}

function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
      c.getContext('2d')!.drawImage(img, 0, 0);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the image.'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not render the image.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); engine.toast(`${what} copied.`); }
  catch { engine.toast('Copying is blocked here. Select the text and copy it.', 'warn'); }
}

export function ShareSheet({ sid, onClose }: { sid: string; onClose: () => void }) {
  const s = useStore();
  const [dark, setDark] = useState(false);
  const svg = cardSvg(sid, dark);
  const code = engine.cardCode(sid) ?? '';
  const slug = s.strategies[sid].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  useEffect(() => { engine.markTried('card'); const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="share-h" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" style={{ width: 'min(760px, 100%)' }}>
        <div className="sheet-head"><h2 id="share-h" className="h2">Share a verified card</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" /></button></div>
        <div className="sheet-body" style={{ display: 'grid', gap: 14 }}>
          <div className="cardpreview" dangerouslySetInnerHTML={{ __html: svg.replace(' width="1200" height="630"', '') }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="seg2" role="group" aria-label="Card theme"><button aria-pressed={!dark} onClick={() => setDark(false)}>Light</button><button aria-pressed={dark} onClick={() => setDark(true)}>Dark</button></div>
            <span className="small muted">Positions never appear on a card. Only signed results.</span>
          </div>
          <label className="field"><span>Card code. Anyone can verify it against the gateway key.</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}><input className="input mono" readOnly value={code} onFocus={(e) => e.currentTarget.select()} /><button className="btn" onClick={() => copy(code, 'Card code')}>Copy</button></div>
          </label>
        </div>
        <div className="sheet-foot">
          <button className="btn" onClick={() => copy(svg, 'SVG embed')}>Copy SVG embed</button>
          <button className="btn" onClick={() => act(() => saveFile(`scion-${slug}.svg`, svg))}>Save SVG</button>
          <button className="btn primary" onClick={() => act(async () => saveFile(`scion-${slug}.png`, await svgToPng(svg)))}>Save PNG</button>
        </div>
      </div>
    </div>
  );
}

export function VerifyCard() {
  const s = useStore();
  const [code, setCode] = useState('');
  const [res, setRes] = useState<Awaited<ReturnType<typeof engine.verifyCard>> | null>(null);
  const run = async () => { setRes(await engine.verifyCard(code)); engine.markTried('verify'); };
  return (
    <div className="box">
      <div className="box-head"><h2 className="h3">Verify a card</h2><span className="small faint">Paste a code from any shared card</span></div>
      <div className="box-body" style={{ display: 'grid', gap: 10 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input mono" value={code} onChange={(e) => { setCode(e.target.value); setRes(null); }} placeholder="SCN1…" aria-label="Card code" />
          <button className="btn primary" disabled={!code.trim()} onClick={run}>Verify</button>
        </div>
        {res && (
          res.ok && res.body ? (
            <div className="well">
              <div className="strong gain" style={{ marginBottom: 6 }}><Icon n="check" s={13} w={2.4} /> {res.reason}</div>
              <dl className="kv">
                <dt>Strategy</dt><dd>{s.strategies[res.body.strategyId]?.title ?? res.body.strategyId}</dd>
                <dt>Return</dt><dd>{pct(res.body.returnPct)}</dd><dt>Max drawdown</dt><dd>{res.body.maxDrawdownPct.toFixed(1)}%</dd>
                <dt>Receipts</dt><dd>{res.body.receipts}</dd><dt>Epoch</dt><dd>{res.body.epoch}{res.current ? ', current' : ', newer results exist'}</dd>
              </dl>
            </div>
          ) : <div className="well loss strong">{res.reason}</div>
        )}
      </div>
    </div>
  );
}
