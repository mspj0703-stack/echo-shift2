/* ================= ECHO ================= */
function spawnEcho(clip){
  const f=clip[0];
  while(G.echoes.length>=B().echoMax){           // 동시 ECHO 상한: 가장 오래된 것부터 소멸
    const old=G.echoes.reduce((m,e)=>e.id<m.id?e:m);
    G.echoes=G.echoes.filter(e=>e!==old);
    G.fx.push({k:'ring',x:old.x,y:old.y,t:0,life:.3,c:'#a487ff',r:24});
  }
  G.echoes.push({id:G.nextEchoId++,clip,i:0,loop:0,x:f.x,y:f.y,a:f.a,dashing:false,dashAng:0,dashHit:new Set(),r:CFG.pR,trail:null});
  G.stats.echoes++;
  G.fx.push({k:'ring',x:f.x,y:f.y,t:0,life:.6,c:'#a487ff',r:60});
  addPart(f.x,f.y,'#a487ff',14,160);
  sfx('echo');
}
function updateEchoes(){
  for(const e of G.echoes){
    const f=e.clip[e.i];
    if(e.i>0){e.dashAng=Math.atan2(f.y-e.y,f.x-e.x)}
    const px=e.x,py=e.y;
    e.x=f.x;e.y=f.y;e.a=f.a;
    if(e.i===0){e.dashHit.clear();G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,c:'#a487ff',r:30})}
    e.dashing=!!f.dash;
    if(f.atk)slash(e,f.a,'echo');
    if(f.dash){dashDamage(e,'echo');if(e.i>0)trailDash(e,'echo',px,py)}else{e.dashHit.clear();e.trail=null}   // PHASE TRAIL: ECHO 대시도 트레일 생성
    e.i++;
    if(e.i>=e.clip.length){e.i=0;e.loop++}
  }
  G.echoes=G.echoes.filter(e=>e.loop<B().echoLoops);
}

