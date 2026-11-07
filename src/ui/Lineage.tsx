import { useEffect } from 'react';
import { engine } from '../core/engine';
import type { Strategy } from '../core/types';
import { ExploreViews, ago, Ret, useStore, useUi } from './bits';

const RH = 68, LANE = 24, X0 = 22;

/** Family tree of strategies: one row per strategy, lanes by fork depth. */
export function Graph({ roots }: { roots: Strategy[] }) {
  const s = useStore();
  const { go } = useUi();
  const rows: { st: Strategy; depth: number }[] = [];
  const walk = (st: Strategy, depth: number) => {
    rows.push({ st, depth });
    engine.children(st.id).sort((a, b) => a.createdAt - b.createdAt).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  const index = new Map(rows.map((r, i) => [r.st.id, i]));
  const maxDepth = Math.max(0, ...rows.map((r) => r.depth));
  const railW = X0 + maxDepth * LANE + 22;
  const pos = (i: number) => ({ x: X0 + rows[i].depth * LANE, y: i * RH + RH / 2 });

  return (
    <div className="graph">
      <svg className="rail" width={railW} height={rows.length * RH} aria-hidden="true">
        {rows.map((r, i) => {
          if (!r.st.parent || !index.has(r.st.parent.id)) return null;
          const a = pos(index.get(r.st.parent.id)!), b = pos(i);
          return <path key={r.st.id} className={`edge ${r.st.seeded ? 'seed' : ''}`} d={`M${a.x} ${a.y} L${a.x} ${b.y - 22} C${a.x} ${b.y - 6} ${b.x} ${b.y - 16} ${b.x} ${b.y}`} />;
        })}
        {rows.map((r, i) => {
          const p = pos(i);
          return r.depth === 0
            ? <circle key={r.st.id} cx={p.x} cy={p.y} r="7" fill="var(--fg)" />
            : <circle key={r.st.id} cx={p.x} cy={p.y} r="6" fill="var(--bg)" stroke="var(--fg)" strokeWidth="2.5" />;
        })}
      </svg>
      {rows.map(({ st }) => {
        const a = s.attestations[st.id];
        const u = s.users[st.owner];
        const parent = st.parent ? s.strategies[st.parent.id] : undefined;
        const kids = engine.children(st.id).length;
        return (
          <button key={st.id} className="gnode" style={{ paddingLeft: railW }} onClick={() => go({ name: 'strategy', id: st.id })}>
            <span className="t"><span>{st.title}</span>{u.kind === 'agent' && <span className="pill solid">Agent</span>}{!st.seeded && <span className="pill">Live</span>}</span>
            <span className="r">{a ? <Ret v={a.returnPct} /> : 'New'}<small>{kids} fork{kids === 1 ? '' : 's'}</small></span>
            <span className="s">{u.handle}, v{st.versions.at(-1)!.v}, {parent ? `forked from ${s.users[parent.owner].handle} at v${st.parent!.v}` : 'original'}, {ago(s.clock, st.createdAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Lineage() {
  const s = useStore();
  useEffect(() => { engine.markLineageSeen(); }, []);
  const live = (st: Strategy): boolean => !st.seeded || engine.children(st.id).some(live);
  const roots = engine.lineageRoots().sort((a, b) => Number(live(b)) - Number(live(a)) || engine.children(b.id).length - engine.children(a.id).length);
  const forks = Object.values(s.strategies).filter((x) => x.parent).length;
  return (
    <div className="view">
      <ExploreViews current="lineage" />
      <div className="pagehead">
        <div>
          <h1 className="title">Family tree</h1>
          <p className="muted" style={{ maxWidth: '62ch' }}>Every strategy and every fork, as one family tree. Each fork records the exact version it came from and pays royalties to it. Results are attested. Contents stay sealed.</p>
        </div>
        <div className="row small muted">
          <span className="row" style={{ gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill="var(--fg)" /></svg> Original</span>
          <span className="row" style={{ gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="var(--bg)" stroke="var(--fg)" strokeWidth="2.2" /></svg> Fork</span>
          <span>{roots.length} originals, {forks} forks</span>
        </div>
      </div>
      <div className="box" style={{ overflow: 'hidden' }}><Graph roots={roots} /></div>
    </div>
  );
}
