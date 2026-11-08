import { useEffect, useState } from 'react';
import type { LivePublicProfile } from '../core/live-api';
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
        {item.profile?.avatarUrl?<img className="av sm" src={item.profile.avatarUrl} alt="" style={{objectFit:'cover'}}/>:<div className="av sm">{(item.profile?.displayName??item.strategy.owner).slice(0,1).toUpperCase()}</div>}
        <div style={{minWidth:0,width:'100%'}}>
          <div className="event-line"><button className="linkish strong" onClick={()=>go({name:'live-profile',id:item.strategy.owner})}>{item.profile?.displayName??item.strategy.owner}</button> <span className="faint">@{item.profile?.handle??item.strategy.owner}</span>{item.demo&&<span className="pill solid">Demo data</span>}{live.session?.accountId!==item.strategy.owner&&item.profile&&<button disabled={!!busy} className="btn ghost sm" onClick={()=>void act(`follow:${item.strategy.owner}`,()=>live.toggleFollow(item.strategy.owner))}>{item.following?'Following':'Follow'}</button>}</div>
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

export function LivePublicProfilePage({account}:{account:string}){
  const live=useLive(),{go}=useUi(),[data,setData]=useState<LivePublicProfile>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reporting,setReporting]=useState(false),[reason,setReason]=useState('');
  const load=()=>live.loadProfile(account).then(setData).catch(cause=>setError(cause instanceof Error?cause.message:'Profile unavailable'));
  useEffect(()=>{void load();},[account,live.session?.token]);
  if(error)return <div className="view narrow empty"><p className="h2">{error}</p><button className="btn" onClick={()=>go({name:'explore'})}>Back to explore</button></div>;
  if(!data)return <div className="view narrow empty">Loading creator profile…</div>;
  const mine=live.session?.accountId===account;
  const follow=async()=>{setBusy(true);try{await live.toggleFollow(account);await load();}catch(cause){alert(cause instanceof Error?cause.message:'Could not follow');}finally{setBusy(false);}};
  const block=async()=>{setBusy(true);try{const blocked=await live.blockAccount(account);if(blocked)go({name:'home'});else await load();}catch(cause){setError(cause instanceof Error?cause.message:'Could not block account');}finally{setBusy(false);}};const submitReport=async()=>{setBusy(true);try{await live.report({targetType:'profile',targetId:account,reason});setReporting(false);setReason('');alert('Report submitted for review.');}catch(cause){setError(cause instanceof Error?cause.message:'Could not submit report');}finally{setBusy(false);}};
  return <div className="view"><div className="pagehead"><div><div className="row">{data.profile.avatarUrl?<img className="av" src={data.profile.avatarUrl} alt={`${data.profile.displayName} profile`} style={{objectFit:'cover'}}/>:<div className="av">{data.profile.displayName.slice(0,1).toUpperCase()}</div>}<div><h1 className="title">{data.profile.displayName}</h1><p className="muted">@{data.profile.handle} · {data.profile.accountId}</p></div></div><p className="lede" style={{marginTop:14}}>{data.profile.bio||'No bio yet.'}</p><div className="row"><span><b>{data.followers}</b> followers</span><span><b>{data.following}</b> following</span><span><b>{data.strategies.length}</b> strategies</span></div></div><div className="row">{mine?<button className="btn" onClick={()=>go({name:'account'})}>Edit profile</button>:<><button className="btn primary" disabled={busy||!live.session} onClick={()=>void follow()}>{data.viewerFollowing?'Following':'Follow'}</button><button className="btn" disabled={busy||!live.session} onClick={()=>setReporting(!reporting)}>Report</button><button className="btn ghost" disabled={busy||!live.session} onClick={()=>void block()}>Block</button></>}</div></div>{reporting&&<div className="box" style={{marginBottom:16}}><div className="box-body" style={{display:'grid',gap:10}}><label className="field"><span>Why are you reporting this profile?</span><textarea className="input" maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Describe the issue for Scion moderation."/></label><div className="row"><button className="btn primary" disabled={busy||reason.trim().length<5} onClick={()=>void submitReport()}>Submit report</button><button className="btn" onClick={()=>setReporting(false)}>Cancel</button></div></div></div>}
    <div className="box"><div className="box-head"><h2 className="h3">Published strategies</h2><span>{data.strategies.length}</span></div>{data.strategies.map(strategy=><button className="gnode" key={strategy.id} onClick={()=>go({name:'live-strategy',id:strategy.id})}><span className="t">{strategy.name}<small>{strategy.visibility}</small></span><span className="r">v{strategy.latestVersion.semver}<small>{strategy.latestVersion.riskClass} · {strategy.latestVersion.horizonDays} days</small></span></button>)}{!data.strategies.length&&<div className="box-body muted">No strategies published yet.</div>}</div>
  </div>;
}
