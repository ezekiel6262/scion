import { useState } from 'react';
import { Icon, useUi } from './bits';
import { useLive } from './live';

export function LiveFeed({explore=false}:{explore?:boolean}){
  const live=useLive(),{go}=useUi(),[busy,setBusy]=useState('');
  const act=async(key:string,fn:()=>Promise<void>)=>{setBusy(key);try{await fn();}catch(error){alert(error instanceof Error?error.message:'Action failed');}finally{setBusy('');}};
  return <div className="view">
    <div className="pagehead"><div><h1 className="display">{explore?'Explore Scion':'Strategies worth building on.'}</h1><p className="lede">A live network of wallet-backed creators. Demo research is labeled while genuine profiles, reactions, comments and forks grow beside it.</p></div>{!live.session&&<button className="btn lg primary" onClick={()=>go({name:'account'})}><Icon n="wallet" s={14}/> Connect NEAR wallet</button>}</div>
    <div className="repo"><div>
      {live.status==='connecting'&&<div className="empty">Loading the network…</div>}
      {live.status==='offline'&&<div className="empty">{live.error} <button className="linkish" onClick={()=>void live.refresh()}>Retry</button></div>}
      {live.feed.map(item=><article className="event" key={item.strategy.id}>
        <div className="av sm">{(item.profile?.displayName??item.strategy.owner).slice(0,1).toUpperCase()}</div>
        <div style={{minWidth:0,width:'100%'}}>
          <div className="event-line"><b>{item.profile?.displayName??item.strategy.owner}</b> <span className="faint">@{item.profile?.handle??item.strategy.owner}</span>{item.demo&&<span className="pill solid">Demo data</span>}{live.session?.accountId!==item.strategy.owner&&item.profile&&<button disabled={!!busy} className="btn ghost sm" onClick={()=>void act(`follow:${item.strategy.owner}`,()=>live.toggleFollow(item.strategy.owner))}>{item.following?'Following':'Follow'}</button>}</div>
          <div className="scard"><button className="linkish scard-title" onClick={()=>go({name:'live-strategy',id:item.strategy.id})}>{item.strategy.name} <span className={`pill ${item.strategy.visibility==='public'?'gain':''}`}>{item.strategy.visibility==='public'?'Public':'Sealed'}</span></button>
            <p className="scard-sum">{item.strategy.latestVersion.restricted.length?'Private strategy content. Public metadata and lineage remain verifiable.':`${item.strategy.latestVersion.horizonDays}-day horizon · ${item.strategy.latestVersion.riskClass} risk · version ${item.strategy.latestVersion.semver}`}</p>
            <div className="event-actions"><button disabled={!!busy} className="btn ghost" onClick={()=>void act(`like:${item.strategy.id}`,()=>live.toggleLike(item.strategy.id))}><Icon n="heart" s={15}/> {item.likes}{item.liked?' · liked':''}</button><button className="btn ghost" onClick={()=>go({name:'live-strategy',id:item.strategy.id})}><Icon n="chat" s={15}/> {item.comments}</button><button className="btn ghost" onClick={()=>go({name:'live-strategy',id:item.strategy.id})}><Icon n="fork" s={15}/> {item.forks}</button></div>
          </div>
        </div>
      </article>)}
      {live.status==='live'&&!live.feed.length&&<div className="empty"><p className="h2">The network is ready.</p><p>Publish the first wallet-backed strategy.</p></div>}
    </div></div>
  </div>;
}
