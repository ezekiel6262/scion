import { useEffect, useState } from 'react';
import { engine, personaUser } from '../core/engine';
import { spec } from '../core/policy';
import { act, Av, date, Icon, left, Ret, SECTION_LABEL, usdc, useStore, useUi, Verified } from './bits';
import { StrategyCard } from './Discover';
import { PlayCard } from './Plays';
import { VerifyCard } from './Trust';
import { RecordPill } from './Sentiment';
import { useLive } from './live';

export function AccountPage(){
  const live=useLive(),[form,setForm]=useState({displayName:live.profile?.displayName??'',handle:live.profile?.handle??'',bio:live.profile?.bio??''}),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{if(live.profile)setForm({displayName:live.profile.displayName,handle:live.profile.handle,bio:live.profile.bio});},[live.profile?.updatedAt]);
  if(!live.session)return <div className="view narrow"><div className="pagehead"><div><h1 className="title">Your Scion account</h1><p className="muted">Connect a real NEAR mainnet wallet. Scion asks for a gas-free NEP-413 signature and never receives your private key.</p></div></div><div className="box empty"><p className="h2">Connect your NEAR wallet</p><p>Create your profile, publish strategies under your account, and approve every future execution in your wallet.</p><button className="btn primary lg" onClick={()=>act(()=>live.connect())}><Icon n="wallet" s={16}/> Connect NEAR wallet</button></div></div>;
  const change=(patch:Partial<typeof form>)=>{setSaved(false);setForm((current)=>({...current,...patch}));};
  const save=async()=>{setBusy(true);setSaved(false);try{const profile=await act(()=>live.saveProfile(form));if(profile){setSaved(true);engine.toast('Profile saved.', 'ok');}}finally{setBusy(false);}};
  return <div className="view narrow"><div className="pagehead"><div><h1 className="title">Your Scion account</h1><p className="muted">Authenticated as {live.session.accountId}</p></div><button className="btn" onClick={()=>act(()=>live.disconnect())}>Disconnect</button></div><div className="box"><div className="box-head"><h2 className="h3">Public profile</h2>{saved&&<span className="pill gain"><Icon n="check" s={12}/> Saved</span>}</div><div className="box-body" style={{display:'grid',gap:14}}><label className="field"><span>Display name</span><input className="input" value={form.displayName} onChange={(e)=>change({displayName:e.target.value})}/></label><label className="field"><span>Handle</span><input className="input" value={form.handle} onChange={(e)=>change({handle:e.target.value})} placeholder="your-handle"/></label><label className="field"><span>Bio</span><textarea className="input" value={form.bio} onChange={(e)=>change({bio:e.target.value})} maxLength={280}/></label><button className="btn primary" disabled={busy||!form.displayName.trim()||!form.handle.trim()} onClick={save}>{busy?'Saving…':saved?'Profile saved':live.profile?'Save profile':'Create profile'}</button></div></div></div>;
}

const needWallet = (what: string) => (
  <div className="view narrow empty"><p className="h2">Choose a wallet</p><p>Switch to Alice or Bob in the sidebar to see {what}.</p></div>
);

export function Keys() {
  const s = useStore();
  const { go } = useUi();
  const me = personaUser(s.persona);
  if (!me) return needWallet('your keys');
  const mine = Object.values(s.grants).filter((g) => g.payload.holder === me).sort((a, b) => b.payload.issuedAt - a.payload.issuedAt);
  return (
    <div className="view">
      <div className="pagehead"><div><h1 className="title">My keys</h1><p className="muted">Access you’ve bought. Each key works only in this wallet and only until it expires or its creator revokes it.</p></div></div>
      {mine.length === 0 ? (
        <div className="box empty"><p className="h2">No keys yet</p><p style={{ marginBottom: 14 }}>Open any strategy and choose Unlock to buy access to the sections you need.</p><button className="btn primary" onClick={() => go({ name: 'explore' })}>Explore strategies</button></div>
      ) : (
        <div className="box table-wrap"><table>
          <thead><tr><th>Strategy</th><th>Key</th><th>Opens</th><th>Status</th><th className="num" /></tr></thead>
          <tbody>{mine.map((g) => {
            const st = s.strategies[g.payload.strategyId];
            const live = !g.revoked && s.clock <= g.payload.expiresAt;
            return (
              <tr key={g.id}>
                <td><button className="linkish strong" onClick={() => go({ name: 'strategy', id: st.id })}>{st.title}</button><div className="small faint">{s.users[st.owner].handle}</div></td>
                <td>{spec(g.payload.cls).label}</td>
                <td className="small">{g.payload.sections.map((x) => SECTION_LABEL[x]).join(', ')}{g.payload.permissions.includes('fork') ? ', fork' : ''}</td>
                <td className={live ? 'gain' : 'loss'}>{g.revoked ? 'Revoked' : live ? left(g.payload.expiresAt - s.clock) : 'Expired'}</td>
                <td className="num">{live && g.payload.permissions.includes('fork') && <button className="btn sm" onClick={() => go({ name: 'fork', id: st.id })}><Icon n="fork" s={13} /> Fork</button>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

export function Earnings() {
  const s = useStore();
  const me = personaUser(s.persona);
  if (!me) return needWallet('your earnings');
  const rows = s.ledger.filter((l) => l.from === me || l.to === me);
  const inflow = s.ledger.filter((l) => l.to === me);
  const by = (k: string) => inflow.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0);
  const name = (id: string) => (id === 'protocol' ? 'Scion protocol' : s.users[id]?.handle ?? id);
  const kind: Record<string, string> = { key: 'Key sale', royalty: 'Fork royalty', protocol: 'Protocol fee', 'exec-royalty': 'Execution royalty' };
  return (
    <div className="view">
      <div className="pagehead"><div><h1 className="title">Earnings</h1><p className="muted">Key sales, plus royalties paid back by forks of your strategies.</p></div><span className="pill dash">Simulated USDC</span></div>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div><b>{s.balances[me].toFixed(2)}</b><span>Balance</span></div>
        <div><b>{by('key').toFixed(2)}</b><span>From key sales</span></div>
        <div><b className="gain">{(by('royalty') + by('exec-royalty')).toFixed(4)}</b><span>From forks</span></div>
        <div><b>{inflow.length}</b><span>Payments received</span></div>
      </div>
      <div className="box table-wrap">
        {rows.length === 0 ? <div className="empty">No payments yet. They appear here as keys sell and forks execute.</div> : (
          <table>
            <thead><tr><th>Time</th><th>Type</th><th>Counterparty</th><th>Memo</th><th className="num">Amount</th></tr></thead>
            <tbody>{rows.map((l) => {
              const incoming = l.to === me;
              return (
                <tr key={l.id}>
                  <td className="small">{date(l.ts)}</td>
                  <td>{l.kind === 'royalty' || l.kind === 'exec-royalty' ? <span className="pill solid">{kind[l.kind]}</span> : kind[l.kind]}</td>
                  <td>{name(incoming ? l.from : l.to)}</td>
                  <td className="small muted">{l.memo}</td>
                  <td className={`num strong ${incoming ? 'gain' : ''}`}>{incoming ? '+' : '-'}{usdc(l.amount)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function Security() {
  const s = useStore();
  const ids = Object.keys(s.strategies);
  const [sel, setSel] = useState(ids.find((i) => !s.strategies[i].seeded) ?? ids[0]);
  return (
    <div className="view">
      <div className="pagehead">
        <div><h1 className="title">Security log</h1><p className="muted" style={{ maxWidth: '64ch' }}>What the access gateway decides, and why. Section keys never leave it. Released data is re-encrypted for one wallet at a time.</p></div>
        <div className="row"><span className="pill gain">Real: AES-GCM, ECDSA, ECDH</span><span className="pill dash">Simulated: gateway enclave</span></div>
      </div>
      <div style={{ display: 'grid', gap: 18 }}>
        <VerifyCard />
        <div className="box">
          <div className="box-head"><h2 className="h3">Requests</h2><span className="small faint">{s.gatewayLog.length}</span></div>
          {s.gatewayLog.length === 0 ? <div className="empty small">No requests yet. Buying or using a key creates an entry.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Time</th><th>Wallet</th><th>Decision</th><th>Reason</th><th>Sections</th></tr></thead>
              <tbody>{s.gatewayLog.map((e) => (
                <tr key={e.id}><td className="small">{date(e.ts)}</td><td>{s.users[e.requester]?.handle}</td>
                  <td><span className={`pill ${e.decision === 'released' ? 'gain' : ''}`} style={e.decision === 'denied' ? { color: 'var(--loss)' } : undefined}>{e.decision === 'released' ? 'Released' : 'Denied'}</span></td>
                  <td className="small">{e.reason}</td><td className="small muted">{e.sections.map((x) => SECTION_LABEL[x]).join(', ') || 'None'}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <div className="box">
          <div className="box-head"><h2 className="h3">Signed keys</h2><span className="small faint">{Object.keys(s.grants).length}</span></div>
          {Object.keys(s.grants).length === 0 ? <div className="empty small">No keys issued yet.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Key</th><th>Holder</th><th>Bound to</th><th>Signature</th><th>Status</th></tr></thead>
              <tbody>{Object.values(s.grants).map((g) => (
                <tr key={g.id}><td>{spec(g.payload.cls).label}<div className="small faint">{s.strategies[g.payload.strategyId].title}</div></td><td>{s.users[g.payload.holder].handle}</td>
                  <td className="mono faint">{g.payload.holderKey.slice(0, 12)}</td><td className="mono faint">{g.sig.slice(0, 18)}</td>
                  <td className={g.revoked || s.clock > g.payload.expiresAt ? 'loss' : 'gain'}>{g.revoked ? 'Revoked' : s.clock > g.payload.expiresAt ? 'Expired' : left(g.payload.expiresAt - s.clock)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <div className="box">
          <div className="box-head"><h2 className="h3">Ciphertext anyone can read</h2>
            <select className="input" style={{ width: 'auto', height: 30 }} value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Strategy">{ids.map((i) => <option key={i} value={i}>{s.strategies[i].title}</option>)}</select>
          </div>
          <div className="box-body" style={{ display: 'grid', gap: 10 }}>
            {Object.entries(engine.ciphertext(sel)).map(([k, v]) => (
              <div key={k} className="well"><div className="h3" style={{ marginBottom: 4 }}>{SECTION_LABEL[k as keyof typeof SECTION_LABEL]}</div><div className="mono faint" style={{ wordBreak: 'break-all' }}>{v!.ct.slice(0, 200)}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Profile({ id }: { id: string }) {
  const s = useStore();
  const u = s.users[id];
  const me = personaUser(s.persona);
  if (!u) return <div className="view empty">Profile not found.</div>;
  const mine = Object.values(s.strategies).filter((x) => x.owner === id);
  const best = mine.map((x) => s.attestations[x.id]).filter(Boolean).sort((a, b) => b.returnPct - a.returnPct)[0];
  const forked = mine.reduce((a, x) => a + engine.children(x.id).length, 0);
  const following = me ? (s.following[me] ?? []).includes(id) : false;
  const plays = Object.values(s.plays).filter((p) => p.author === id).sort((a, b) => b.createdAt - a.createdAt);
  const trophies = Object.values(s.nfts).filter((n) => n.kind === 'trophy' && n.owner === id).length;
  return (
    <div className="view narrow">
      <div className="row" style={{ gap: 18, marginBottom: 18, flexWrap: 'nowrap', alignItems: 'center' }}>
        <Av u={u} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="title">{u.name}</h1>
          <div className="row" style={{ gap: 8, marginTop: 4 }}><span className="muted">{u.handle}</span>{u.kind === 'agent' && <span className="pill solid">AI agent</span>}</div>
        </div>
        {me && me !== id && <button className={`btn ${following ? '' : 'primary'}`} onClick={() => engine.follow(id)}>{following ? 'Following' : 'Follow'}</button>}
      </div>
      <p className="prose">{u.bio}</p>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', margin: '20px 0 10px' }}>
        <div><b>{best ? <Ret v={best.returnPct} /> : 'None'}</b><span>Best return</span></div>
        <div><b>{mine.length}</b><span>Strategies</span></div>
        <div><b>{forked}</b><span>Times forked</span></div>
        <div><b>{u.followers.toLocaleString()}</b><span>Followers</span></div>
      </div>
      <div className="row" style={{ gap: 8 }}>{best && <Verified a={best} />}<RecordPill uid={id} /></div>
      <h2 className="h2" style={{ margin: '28px 0 4px' }}>Strategies</h2>
      {mine.length === 0 ? <div className="empty">No strategies yet.</div> : mine.map((x) => <StrategyCard key={x.id} st={x} />)}
      {plays.length > 0 && <><h2 className="h2" style={{ margin: '28px 0 12px' }}>Plays <span className="faint">{trophies} trophies</span></h2><div className="plays">{plays.map((p) => <PlayCard key={p.id} play={p} />)}</div></>}
    </div>
  );
}


