import { useEffect, useState, type CSSProperties } from 'react';
import { Icon, Logo } from './bits';

const features = [
  { icon:'lock', eyebrow:'Private by design', title:'Reveal the record. Keep the edge.', text:'Seal thesis, positions, rules, evidence, and trades independently. License only the intelligence a buyer needs.' },
  { icon:'key', eyebrow:'Ownable access', title:'Keys, not copies.', text:'Wallet-bound, scoped, expiring access turns private research into a permissioned product without transferring authorship.' },
  { icon:'fork', eyebrow:'Verifiable lineage', title:'Every idea remembers where it came from.', text:'Fork a strategy under new limits while attribution, version history, and upstream economics remain visible.' },
  { icon:'bot', eyebrow:'User-owned agents', title:'Automation with an owner and a boundary.', text:'Agents research, propose, and execute under explicit assets, spending, allocation, and slippage policies.' },
  { icon:'swap', eyebrow:'Live markets', title:'From intelligence to execution.', text:'Discover NEAR assets, inspect live routes, and approve swaps from your own wallet through NEAR Intents infrastructure.' },
  { icon:'shield', eyebrow:'Proof over promises', title:'Performance is a record, not a pitch.', text:'Receipts, attestations, versions, and public lineage make outcomes inspectable without claiming that history guarantees returns.' },
];

const tracks = [
  ['01','Unstoppable DeFi','Strategies, markets, agents, and non-custodial execution through NEAR Intents.'],
  ['03','Privacy & Private AI','Protected intelligence with selective, wallet-bound access.'],
  ['04','Autonomous Business','Agents and authors can turn intelligence into products and attributable revenue.'],
  ['06','AI Security & Defense','Policy engines, spending limits, owner approval, audit, pause, and revocation.'],
  ['07','Agent Economy','Dedicated agent identities, public records, accounts, and earnings.'],
  ['02','Investment Thesis','Sourced, rerunnable research and conditions that can invalidate a thesis.'],
];

function SealScene(){return <div className="lp-scene seal-scene" aria-label="Animated model of a sealed strategy">
  <div className="scene-orbit orbit-a"/><div className="scene-orbit orbit-b"/>
  {['THESIS','POSITIONS','RULES','EVIDENCE','TRADES'].map((label,index)=><div key={label} className="intel-layer" style={{'--i':index} as CSSProperties}><span>{label}</span><i/></div>)}
  <div className="proof-ring"><span>VERIFIED</span></div>
</div>}

function LineageScene(){return <div className="lp-scene lineage-scene" aria-label="Animated strategy lineage and royalty flow">
  <svg viewBox="0 0 640 420" role="img"><defs><linearGradient id="flow"><stop stopColor="currentColor" stopOpacity=".1"/><stop offset=".5" stopColor="currentColor"/><stop offset="1" stopColor="currentColor" stopOpacity=".1"/></linearGradient></defs><path className="branch base" d="M80 210H250C310 210 290 95 390 95H560M250 210C310 210 290 210 390 210H560M250 210C310 210 290 325 390 325H560"/><path className="branch pulse" d="M80 210H250C310 210 290 95 390 95H560M250 210C310 210 290 210 390 210H560M250 210C310 210 290 325 390 325H560"/></svg>
  <div className="node origin"><span>ORIGINAL</span><b>Edge / v1.4</b></div><div className="node child c1"><span>FORK 01</span><b>Lower risk</b></div><div className="node child c2"><span>FORK 02</span><b>Agent run</b></div><div className="node child c3"><span>FORK 03</span><b>Private</b></div><div className="royalty-chip">↙ attribution + royalty</div>
</div>}

function AgentScene(){return <div className="lp-scene agent-scene" aria-label="Animated user-owned agent account">
  <div className="agent-core"><Logo s={52}/><span>AGENT</span><b>sentinel.alice.near</b></div>
  <div className="limit l1"><small>ASSETS</small><b>NEAR · USDC</b></div><div className="limit l2"><small>PER TRADE</small><b>10 USDC</b></div><div className="limit l3"><small>DAILY LIMIT</small><b>25 USDC</b></div><div className="limit l4"><small>OWNER</small><b>alice.near</b></div>
  <div className="account-rail"><span>research</span><i/><span>proposal</span><i/><span>approve</span><i/><span>execute</span></div>
</div>}

export function Landing(){
  const [menu,setMenu]=useState(false);
  useEffect(()=>{const target=location.pathname==='/how-it-works'?'how':location.pathname==='/hackathon'?'hackathon':location.hash.slice(1);if(target)requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView());},[]);
  return <div className="landing">
    <header className="lp-nav"><a className="lp-brand" href="/" aria-label="Scion home"><Logo s={30}/><b>scion</b></a><nav aria-label="Public navigation"><a href="#why">Why Scion</a><a href="/how-it-works">How it works</a><a href="/hackathon">Hackathon</a><a href="/docs">Docs</a></nav><a className="lp-launch" href="/app">Launch app <span>↗</span></a><button className="lp-menu" aria-label="Open navigation" onClick={()=>setMenu(!menu)}><Icon n={menu?'x':'rail'}/></button>{menu&&<div className="lp-mobile-menu"><a href="#why">Why Scion</a><a href="/how-it-works">How it works</a><a href="/hackathon">Hackathon</a><a href="/docs">Docs</a><a href="/app">Launch app ↗</a></div>}</header>

    <main>
      <section className="lp-hero"><div className="hero-grid" aria-hidden="true"/><div className="hero-copy"><div className="lp-kicker"><span/> Built on NEAR · Live product</div><h1>Intelligence<br/>you can <em>own.</em></h1><p>Scion turns strategies, private research, and autonomous agents into verifiable, licensable, executable assets—without taking control of the user’s wallet.</p><div className="hero-actions"><a className="lp-btn primary" href="/app">Enter the network <span>↗</span></a><a className="lp-btn" href="/how-it-works">See how it works <Icon n="play" s={13}/></a></div><div className="hero-proof"><span><i className="live"/> Live on mainnet</span><span>32 routable NEAR markets</span><span>Non-custodial execution</span></div></div><SealScene/><div className="scroll-cue">SCROLL TO UNSEAL <i/></div></section>

      <section className="lp-statement" id="why"><span className="lp-index">01 / THE NEW PRIMITIVE</span><p>Markets have assets. Creators have content. Agents have actions.</p><h2>Scion makes <em>intelligence itself</em> an ownable economic object.</h2></section>

      <section className="feature-stage"><div className="stage-head"><span className="lp-index">02 / THE SYSTEM</span><h2>One network.<br/>Six connected primitives.</h2><p>Not a signal feed with a wallet button. Scion connects privacy, provenance, licensing, social proof, agents, and execution into one coherent market.</p></div><div className="feature-matrix">{features.map((f,i)=><article key={f.title} className={`feature-cell f${i}`}><span className="feature-no">0{i+1}</span><Icon n={f.icon} s={22}/><small>{f.eyebrow}</small><h3>{f.title}</h3><p>{f.text}</p></article>)}</div></section>

      <section className="cinema-section" id="how"><div className="cinema-copy"><span className="lp-index">03 / HOW IT WORKS</span><h2>Publish once.<br/>Branch without losing the source.</h2><p>A strategy becomes a versioned object. Public proof travels through the network while protected logic stays behind precise keys. Forks add new constraints and route value back through their lineage.</p><ol><li><span>01</span><div><b>Publish</b><small>Openly or section-sealed</small></div></li><li><span>02</span><div><b>Prove</b><small>Receipts, results, versions</small></div></li><li><span>03</span><div><b>License</b><small>Scoped, expiring keys</small></div></li><li><span>04</span><div><b>Fork + run</b><small>Your limits, your wallet</small></div></li></ol><a href="/docs">Read the full guide →</a></div><LineageScene/></section>

      <section className="agent-economy"><div className="agent-visual"><AgentScene/></div><div className="agent-copy"><span className="lp-index">04 / AGENT ECONOMY</span><h2>An agent should have an account—not your account.</h2><p>Scion agents are attached to a human owner but receive a distinct NEAR identity, policy, public record, and attributable earnings. Owners set the boundary; agents operate inside it.</p><div className="agent-principles"><div><b>Dedicated identity</b><span>Child account provisioned by the owner</span></div><div><b>Attributable earnings</b><span>Revenue belongs to the agent’s record</span></div><div><b>Fail-closed policy</b><span>Assets, spend, allocation, and slippage</span></div><div><b>Human sovereignty</b><span>Pause, approve, revoke, withdraw</span></div></div><a className="lp-btn dark" href="/app?view=agents">Explore agents ↗</a></div></section>

      <section className="difference"><span className="lp-index">05 / WHY IT IS DIFFERENT</span><div className="difference-grid"><h2>Most platforms ask:<br/><em>“What should I trade?”</em></h2><h2>Scion asks:<br/><em>“Who owns the intelligence—and what may it do?”</em></h2></div><div className="comparison"><div><span>TYPICAL SOCIAL TRADING</span><p>Copy a portfolio</p><p>Trust a screenshot</p><p>Expose the whole strategy</p><p>Give automation broad access</p><p>Lose attribution after copying</p></div><div className="scion-col"><span>SCION</span><p>Fork a versioned strategy</p><p>Inspect proof and lineage</p><p>License only selected sections</p><p>Bound an agent with policy</p><p>Keep ancestry and economics</p></div></div></section>

      <section className="hackathon" id="hackathon"><div className="hack-head"><span className="lp-index">06 / NEAR HACKATHON 2026</span><h2>One product.<br/>A constellation of tracks.</h2><p>Scion is built where programmable money, private intelligence, and autonomous agents converge. Each track is a different view of the same working system.</p><a href="https://nearhackathon.com/" target="_blank" rel="noreferrer">Official hackathon ↗</a></div><div className="track-orbit"><div className="track-core"><Logo s={48}/><b>SCION</b><span>OWNABLE<br/>INTELLIGENCE</span></div>{tracks.map(([n,name,text],i)=><article key={n} className={`track t${i}`}><span>{n}</span><h3>{name}</h3><p>{text}</p></article>)}</div><div className="hack-proof"><span><b>LIVE</b> Wallet authentication</span><span><b>LIVE</b> NEAR markets + swaps</span><span><b>LIVE</b> Persisted strategies</span><span><b>LIVE</b> Policy-bounded agents</span><span><b>DEMO-LABELED</b> Seeded activity</span></div></section>

      <section className="build-truth"><span className="lp-index">07 / WHAT EXISTS TODAY</span><h2>Not a concept deck.<br/>A product you can open.</h2><div className="truth-grid"><div><b>Live product</b><strong>scionhub.xyz/app</strong><p>Wallet login, profiles, strategies, agents, markets, swaps, social activity, security, and commerce foundations.</p></div><div><b>Inspectable system</b><strong>Proof before promise</strong><p>Demo records are labeled. Wallet-backed actions, public data, and future infrastructure are distinguished honestly.</p></div><div><b>Open guide</b><strong>Docs with real screens</strong><p>Understand keys, privacy, lineage, agents, trades, risks, and every major user flow.</p></div></div></section>

      <section className="lp-final"><div className="final-scene" aria-hidden="true"><span>THESIS</span><span>KEY</span><span>FORK</span><span>AGENT</span><span>TRADE</span></div><h2>The edge can stay private.<br/><em>The record cannot.</em></h2><p>Enter a network where intelligence has ownership, ancestry, permissions, and consequences.</p><div className="hero-actions"><a className="lp-btn light" href="/app">Launch Scion ↗</a><a className="lp-btn outline-light" href="/docs">Read the docs</a></div></section>
    </main>
    <footer className="lp-footer"><a className="lp-brand" href="/"><Logo s={28}/><b>scion</b></a><p>Ownable trading intelligence on NEAR.</p><div><a href="/app">App</a><a href="/docs">Docs</a><a href="/hackathon">Hackathon</a><a href="https://near.org" target="_blank" rel="noreferrer">NEAR ↗</a></div><small>Non-custodial software. Not financial advice.</small></footer>
  </div>
}
