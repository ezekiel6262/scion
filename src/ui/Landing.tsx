import { useEffect } from 'react';

export function Landing(){
  useEffect(()=>{document.body.classList.add('landing-host');return()=>document.body.classList.remove('landing-host')},[]);
  const section=location.pathname==='/how-it-works'?'#film':location.pathname==='/hackathon'?'#proof':'';
  return <iframe className="landing-frame" src={`/scion-homepage.html${section}`} title="Scion homepage"/>;
}
