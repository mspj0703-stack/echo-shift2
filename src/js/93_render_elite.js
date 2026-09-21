/* ================= RENDER: ELITE ================= */
// 금색 외곽선 + 왕관 아이콘 = ELITE. 특성별 표시: SYNC LOCK(청색 보호막 링), RELAY CORE(주황 폭발 반경). P/E 점 = PLAYER·ECHO가 창 안에서 맞혔는지
function drawEliteMarks(e,sp){
  const el=e.elite,st=eliteStatus(e),I=ELITE_INFO[el.trait];
  ctx.save();ctx.globalAlpha=sp?0.4:1;
  ctx.strokeStyle='#ffd54a';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(e.x,e.y,e.r+4,0,TAU);ctx.stroke();
  const y0=e.y-e.r-17;ctx.fillStyle='#ffd54a';ctx.beginPath();
  ctx.moveTo(e.x-7,y0+6);ctx.lineTo(e.x-7,y0);ctx.lineTo(e.x-3.5,y0+3);ctx.lineTo(e.x,y0-2);ctx.lineTo(e.x+3.5,y0+3);ctx.lineTo(e.x+7,y0);ctx.lineTo(e.x+7,y0+6);ctx.closePath();ctx.fill();
  if(el.trait==='lock'){
    if(el.shield){
      ctx.save();if(el.prot>0)ctx.setLineDash([4,4]);
      ctx.strokeStyle=el.prot>0?'rgba(140,170,200,.7)':'rgba(92,200,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+10,0,TAU);ctx.stroke();ctx.restore();
    }else{
      ctx.fillStyle='#7cf5ff';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText('BREAK '+(el.brk/60).toFixed(1)+'s',e.x,e.y+e.r+20);
      ctx.fillStyle='rgba(124,245,255,.25)';ctx.fillRect(e.x-14,e.y+e.r+23,28,3);ctx.fillStyle='#7cf5ff';ctx.fillRect(e.x-14,e.y+e.r+23,28*st.left,3);
    }
  }else{
    ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle=st.kind==='cool'?'rgba(255,177,74,.25)':'rgba(255,177,74,.6)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(e.x,e.y,ELITE.relay.radius,0,TAU);ctx.stroke();ctx.restore();                  // RELAY BURST 반경
    ctx.strokeStyle=I.c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+9,0,TAU);ctx.stroke();
  }
  if(st.kind==='lock'||st.kind==='relay'||st.kind==='cool'){          // P / E 점
    const py=e.y+e.r+16;ctx.font='bold 8px system-ui';ctx.textAlign='center';
    for(const[dx,on,lab,c]of[[-7,st.p,'P','#ffffff'],[7,st.e,'E','#a487ff']]){
      ctx.fillStyle=on?c:'rgba(255,255,255,.18)';ctx.beginPath();ctx.arc(e.x+dx,py,4.5,0,TAU);ctx.fill();
      ctx.fillStyle=on?'#111':'rgba(255,255,255,.5)';ctx.fillText(lab,e.x+dx,py+3);
    }
  }
  ctx.restore();
}
// ECHO가 앞으로 이 ELITE를 타격할 지점 + 남은 시간 (가장 이른 1개)
function drawEchoEliteHits(){
  if(G.stage!=='survive')return;
  for(const e of G.enemies){
    if(!e.elite||e.hp<=0||e.spawn>0)continue;
    const st=eliteStatus(e);if(st.kind==='break'||st.kind==='protect')continue;
    const nx=nextEchoHitOn(e,240);if(!nx)continue;
    ctx.strokeStyle='rgba(255,213,74,.95)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(nx.x,nx.y,13,0,TAU);ctx.stroke();
    ctx.fillStyle='rgba(255,213,74,.95)';ctx.font='bold 11px ui-monospace,Menlo,Consolas,monospace';ctx.textAlign='center';ctx.fillText((nx.ticks/60).toFixed(1)+'s',nx.x,nx.y-18);
    ctx.strokeStyle='rgba(255,213,74,.3)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(nx.x,nx.y);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.setLineDash([]);
  }
}
