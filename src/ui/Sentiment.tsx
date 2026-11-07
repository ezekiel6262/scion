import { engine, personaUser } from '../core/engine';
import type { Side } from '../core/types';
import { act, Icon, useStore } from './bits';

/** Back or fade: free, public, and settled by data. */
export function BackFade({ id, compact }: { id: string; compact?: boolean }) {
  const s = useStore();
  const me = personaUser(s.persona);
  const sen = s.sentiment[id];
  const t = engine.tally(id);
  const mine = me ? sen?.stances.find((x) => x.uid === me) : undefined;
  const author = s.plays[id]?.author ?? s.strategies[id]?.owner;
  const backPct = t.total ? Math.round((t.back / t.total) * 100) : 50;
  const locked = !!sen?.settled || (s.plays[id]?.outcome && s.plays[id].outcome !== 'open') || s.watches[id]?.state === 'invalidated';
  const pick = (side: Side) => act(() => engine.stance(id, side));
  const who = s.plays[id] ? 'call' : 'thesis';
  return (
    <div className={`bf ${compact ? 'compact' : ''}`}>
      <div className="bf-bar" role="img" aria-label={`${backPct}% back, ${100 - backPct}% fade, ${t.total} people`}>
        <i style={{ width: `${backPct}%` }} />
      </div>
      <div className="bf-row">
        <span className="small"><b>{backPct}%</b> back <span className="faint">{t.back.toLocaleString()}</span></span>
        {!locked && (
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn sm ${mine?.side === 'back' ? 'primary' : ''}`} aria-pressed={mine?.side === 'back'} disabled={!me || me === author} onClick={() => pick('back')} title={!me ? 'Choose a wallet first' : me === author ? 'You can’t back your own ' + who : undefined}><Icon n="up" s={13} /> Back</button>
            <button className={`btn sm ${mine?.side === 'fade' ? 'primary' : ''}`} aria-pressed={mine?.side === 'fade'} disabled={!me || me === author} onClick={() => pick('fade')} title={!me ? 'Choose a wallet first' : me === author ? 'You can’t fade your own ' + who : undefined}><Icon n="down" s={13} /> Fade</button>
          </div>
        )}
        <span className="small" style={{ textAlign: 'right' }}><span className="faint">{t.fade.toLocaleString()}</span> fade <b>{100 - backPct}%</b></span>
      </div>
      {sen?.settled ? (
        <p className="small strong">Settled: {sen.settled.reason}. {sen.settled.winner === 'back' ? 'Backers' : 'Faders'} were right{mine ? `, so you were ${mine.result ?? (mine.side === sen.settled.winner ? 'right' : 'wrong')}` : ''}.</p>
      ) : !compact && (
        <p className="small faint">Free. Settled by the data, never by vote: {who === 'call' ? 'its target, stop or exit' : `thesis watch invalidating it, or ${7} market days of holding`}. Right calls build your public record.</p>
      )}
    </div>
  );
}

export function RecordPill({ uid }: { uid: string }) {
  useStore();
  const r = engine.record(uid);
  if (!r.total) return <span className="pill">No settled calls yet</span>;
  return <span className="pill solid" title={r.seeded ? 'Includes seeded history' : undefined}><Icon n="target" s={12} /> {r.right} of {r.total} calls right</span>;
}
