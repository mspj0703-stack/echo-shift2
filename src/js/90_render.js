/* ================= RENDER ================= */
function drawWedge(x,y,a,r,c,alpha){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=c;ctx.translate(x,y);ctx.rotate(a);
  ctx.beginPath();ctx.moveTo(r+7,0);ctx.lineTo(r-1,-5);ctx.lineTo(r-1,5);ctx.closePath();ctx.fill();ctx.restore();
}
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#070a10';ctx.fillRect(0,0,W,H);
  ctx.save();
  if(G.shake>0)ctx.translate(rand(-G.shake,G.shake),rand(-G.shake,G.shake));
  // 격자
  ctx.strokeStyle='rgba(120,160,210,.05)';ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=W;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,H)}
  for(let y=0;y<=H;y+=40){ctx.moveTo(0,y);ctx.lineTo(W,y)}
  ctx.stroke();
  ctx.strokeStyle='rgba(92,200,255,.18)';ctx.strokeRect(1,1,W-2,H-2);

  const p=G.p,playing=G.phase==='play';
  const cyc=G.rec.length/CFG.echoTicks;      // 현재 녹화 구간 진행도

  // ---- 녹화 중인 경로 + 다음 ECHO 생성 위치 ----
  if(playing&&G.rec.length>1){
    ctx.strokeStyle='rgba(164,135,255,.32)';ctx.lineWidth=2;ctx.beginPath();
    for(let i=0;i<G.rec.length;i+=2){const f=G.rec[i];i===0?ctx.moveTo(f.x,f.y):ctx.lineTo(f.x,f.y)}
    ctx.stroke();
    for(const f of G.rec){if(f.atk){ctx.strokeStyle='rgba(164,135,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,8,0,TAU);ctx.stroke()}}
    const s0=G.rec[0],pulse=0.35+0.65*cyc;
    ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(164,135,255,'+pulse+')';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(s0.x,s0.y,17,0,TAU);ctx.stroke();ctx.restore();
    ctx.fillStyle='rgba(164,135,255,'+pulse+')';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('ECHO',s0.x,s0.y-23);
  }

  drawBossTelegraphs();
  drawTrails();
  // ---- ECHO들 ----
  for(const e of G.echoes){
    // 앞으로 지나갈 경로와 공격 위치를 흐리게 예고
    ctx.strokeStyle='rgba(164,135,255,.13)';ctx.lineWidth=2;ctx.beginPath();
    for(let i=e.i;i<e.clip.length;i+=3){const f=e.clip[i];i===e.i?ctx.moveTo(f.x,f.y):ctx.lineTo(f.x,f.y)}
    ctx.stroke();
    for(let i=e.i+1;i<e.clip.length;i++){const f=e.clip[i];if(f.atk){ctx.strokeStyle='rgba(164,135,255,.4)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(f.x,f.y,9,0,TAU);ctx.stroke()}}
    const life=1-((e.loop*e.clip.length+e.i)/(B().echoLoops*e.clip.length));
    const alpha=life<.12?0.15+life*4:0.55;
    ctx.globalAlpha=alpha;ctx.fillStyle='#a487ff';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,TAU);ctx.fill();
    ctx.globalAlpha=1;drawWedge(e.x,e.y,e.a,e.r,'#c9b8ff',alpha+.2);
    ctx.strokeStyle='rgba(201,184,255,'+(alpha+.15)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+4,-Math.PI/2,-Math.PI/2+TAU*(e.i/e.clip.length));ctx.stroke();
    if(e.dashing){ctx.globalAlpha=.3;ctx.fillStyle='#a487ff';ctx.beginPath();ctx.arc(e.x-Math.cos(e.dashAng)*14,e.y-Math.sin(e.dashAng)*14,e.r,0,TAU);ctx.fill();ctx.globalAlpha=1}
  }

  // ---- PHASE HUNTER → ECHO 타겟 선 ----
  for(const e of G.enemies){
    if(e.type==='phase'&&e.hp>0&&e.spawn<=0&&e.tgt&&G.echoes.includes(e.tgt)){
      ctx.strokeStyle='rgba(110,231,168,.4)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.tgt.x,e.tgt.y);ctx.stroke();ctx.setLineDash([]);
    }
  }
  // ---- 적 ----
  for(const e of G.enemies){
    if(e.type==='boss')continue;
    const sp=e.spawn>0;
    ctx.globalAlpha=sp?0.25+0.5*(1-e.spawn/.55):1;
    const col=e.flash>0?'#ffffff':(KILL_COLOR[e.type]||'#ffb547');
    ctx.fillStyle=col;
    if(e.type==='phase'){
      const stunned=e.stun>0;
      ctx.globalAlpha=(sp?0.25+0.5*(1-e.spawn/.55):1)*(stunned?.55:1);
      ctx.beginPath();ctx.moveTo(e.x,e.y-e.r-3);ctx.lineTo(e.x+e.r,e.y);ctx.lineTo(e.x,e.y+e.r+3);ctx.lineTo(e.x-e.r,e.y);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(5,25,15,.55)';ctx.beginPath();ctx.moveTo(e.x,e.y-5);ctx.lineTo(e.x+4,e.y);ctx.lineTo(e.x,e.y+5);ctx.lineTo(e.x-4,e.y);ctx.closePath();ctx.fill();
      if(stunned){ctx.strokeStyle='#fff3a0';ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,0,TAU);ctx.stroke();ctx.setLineDash([])}
    }else if(e.type==='warden'){
      const sh=CFG.warden.shield;
      // 방패로 막히는 영역(반투명 부채꼴) + 방패 호 + 정면 표식
      ctx.save();ctx.globalAlpha=sp?0.15:1;
      ctx.fillStyle='rgba(255,190,235,.14)';ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,e.r+30,e.face-sh,e.face+sh);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(215,240,255,.95)';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.arc(e.x,e.y,e.r+8,e.face-sh,e.face+sh);ctx.stroke();ctx.lineCap='butt';
      ctx.restore();
      ctx.beginPath();for(let k=0;k<6;k++){const a=e.face+k*TAU/6;const px=e.x+Math.cos(a)*e.r,py=e.y+Math.sin(a)*e.r;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(60,10,45,.55)';ctx.beginPath();ctx.arc(e.x,e.y,5,0,TAU);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(e.x+Math.cos(e.face)*(e.r+17),e.y+Math.sin(e.face)*(e.r+17));ctx.lineTo(e.x+Math.cos(e.face+.16)*(e.r+9),e.y+Math.sin(e.face+.16)*(e.r+9));ctx.lineTo(e.x+Math.cos(e.face-.16)*(e.r+9),e.y+Math.sin(e.face-.16)*(e.r+9));ctx.closePath();ctx.fill();
    }else if(e.type==='chaser'){
      const a=Math.atan2(p.y-e.y,p.x-e.x);
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(e.r+3,0);ctx.lineTo(-e.r,-e.r);ctx.lineTo(-e.r,e.r);ctx.closePath();ctx.fill();ctx.restore();
    }else{
      ctx.fillRect(e.x-e.r,e.y-e.r,e.r*2,e.r*2);
      if(e.wind>0){
        ctx.strokeStyle='rgba(255,181,71,'+(0.25+0.5*(1-e.wind/CFG.shooter.wind))+')';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.aim)*420,e.y+Math.sin(e.aim)*420);ctx.stroke();
      }
    }
    if(e.elite)drawEliteMarks(e,sp);
    if((e.hp<e.maxHp||e.elite)&&!sp){ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(e.x-e.r,e.y-e.r-7,(e.r*2)*(e.hp/e.maxHp),3)}
    ctx.globalAlpha=1;
  }
  if(G.boss&&!G.boss.dead)drawBossBody(G.boss);
  drawMarks();
  drawEchoBossHits();
  drawEchoEliteHits();
  // ---- 투사체 ----
  for(const s of G.shots){
    ctx.fillStyle='#ffb547';ctx.shadowColor='#ffb547';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
  }
  // ---- 이펙트 ----
  for(const f of G.fx){
    if(f.k==='slash'){
      const k=f.t/.16,col=f.src==='echo'?'164,135,255':'255,255,255';
      ctx.strokeStyle='rgba('+col+','+(1-k)+')';ctx.lineWidth=7*(1-k)+1;
      ctx.beginPath();ctx.arc(f.x,f.y,(f.rng||CFG.atkRange)*(0.62+0.38*k),f.a-CFG.atkArc/2,f.a+CFG.atkArc/2);ctx.stroke();
    }else if(f.k==='ring'){
      const k=f.t/f.life;ctx.strokeStyle=f.c;ctx.globalAlpha=1-k;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,f.r*k+4,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    }else if(f.k==='part'){
      const k=f.t/f.life;ctx.globalAlpha=Math.max(0,1-k);ctx.fillStyle=f.c;ctx.fillRect(f.x-2,f.y-2,4,4);ctx.globalAlpha=1;
    }else if(f.k==='linefx'){
      const k=f.t/f.life;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.dy,f.dx));ctx.globalAlpha=1-k;ctx.fillStyle='#ffb0b0';ctx.fillRect(0,-f.w/2,1700,f.w);ctx.restore();
    }else if(f.k==='shield'){
      const k=f.t/f.life;ctx.strokeStyle='rgba(225,242,255,'+(1-k)+')';ctx.lineWidth=7*(1-k)+2;
      ctx.beginPath();ctx.arc(f.x,f.y,f.r+10+k*6,f.a-.75,f.a+.75);ctx.stroke();
    }else if(f.k==='text'){
      const k=f.t/f.life;ctx.globalAlpha=1-k;ctx.fillStyle=f.c;ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText(f.txt,f.x,f.y-k*14);ctx.globalAlpha=1;
    }else if(f.k==='ghost'){
      const k=f.t/f.life;ctx.globalAlpha=.4*(1-k);ctx.fillStyle=f.c;ctx.beginPath();ctx.arc(f.x,f.y,CFG.pR,0,TAU);ctx.fill();ctx.globalAlpha=1;
    }
  }
  // ---- 플레이어 ----
  if(G.phase!=='dead'){
    const blink=p.inv>0&&p.dashT<=0&&Math.floor(p.inv*20)%2===0;
    ctx.globalAlpha=blink?.35:1;
    ctx.fillStyle=p.flash>0?'#ff9a9a':'#5cc8ff';ctx.shadowColor='#5cc8ff';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
    drawWedge(p.x,p.y,p.aim,p.r,'#e8f8ff',1);
    ctx.globalAlpha=1;
  }
  ctx.restore();

  // ---- 피격 비네트 ----
  if(G.hurtFlash>0){ctx.fillStyle='rgba(255,60,60,'+(G.hurtFlash*.5)+')';ctx.fillRect(0,0,W,H)}

  // ---- 신규 적 첫 등장 안내 ----
  if(G.notice&&G.phase==='play'){
    const n=G.notice,a=n.t<0.3?n.t/0.3:(n.t>3?Math.max(0,1-(n.t-3)/0.5):1);
    ctx.globalAlpha=a;ctx.textAlign='center';ctx.font='bold 14px system-ui';ctx.fillStyle=n.c;ctx.fillText(n.text,W/2,G.stage==='survive'?64:118);ctx.globalAlpha=1;
  }
  // ---- HUD ----
  if(G.phase!=='title'){
    if(G.boss)drawBossHud();
    ctx.textBaseline='alphabetic';
    for(let i=0;i<CFG.pHp;i++){ctx.fillStyle=i<p.hp?'#ff6b6b':'rgba(255,107,107,.2)';ctx.fillRect(16+i*20,14,14,14)}
    ctx.textAlign='center';ctx.fillStyle='#e7edf5';ctx.font='bold 20px ui-monospace,Menlo,Consolas,monospace';
    if(G.stage==='survive')ctx.fillText(fmtTime(CFG.gameSec-G.t/60),W/2,30);
    ctx.textAlign='right';ctx.font='13px system-ui';ctx.fillStyle='#8ea0b6';
    ctx.fillText('처치 '+G.stats.kills+' (ECHO '+G.stats.echo+')',W-16,24);
    // ECHO 녹화 게이지
    const remain=(CFG.echoTicks-G.rec.length)/60;
    ctx.fillStyle='rgba(164,135,255,.2)';ctx.fillRect(W-176,34,160,6);
    ctx.fillStyle='#a487ff';ctx.fillRect(W-176,34,160*cyc,6);
    ctx.fillStyle='#a487ff';ctx.font='11px system-ui';ctx.fillText('ECHO 생성까지 '+remain.toFixed(1)+'초',W-16,54);
    // 대시 쿨다운
    ctx.textAlign='left';ctx.fillStyle='rgba(92,200,255,.2)';ctx.fillRect(16,H-22,90,6);
    ctx.fillStyle=p.dashCd<=0?'#5cc8ff':'#3a7ea3';ctx.fillRect(16,H-22,90*Math.max(0,1-p.dashCd/B().dashCd),6);
    ctx.fillStyle='#8ea0b6';ctx.font='11px system-ui';ctx.fillText('대시',16,H-28);
    // 빌드 요약 (현재 스탯)
    const b=G.build;ctx.textAlign='right';ctx.font='11px system-ui';
    ctx.fillStyle='#8ea0b6';ctx.fillText('공격 '+num(CFG.atkDmg*(1+b.atkPct/100))+' · 쿨 '+num(b.atkCd)+'초 · 사거리 '+Math.round(atkRange()),W-16,H-44);
    ctx.fillStyle='#a487ff';ctx.fillText('ECHO 피해 '+Math.round(b.echoPow*100)+'% · 반복 '+b.echoLoops+'회 · 동시 '+b.echoMax+'개',W-16,H-31);
    ctx.fillStyle='#5cc8ff';ctx.fillText('대시 피해 '+(CFG.dashDmg+b.dashBonus)+' · 쿨 '+num(b.dashCd)+'초',W-16,H-18);
    // 레벨 / XP
    const xp=G.exp,target=xp.xp/xp.need;
    if(G.xpShown===undefined||G.xpLv!==xp.level){G.xpShown=0;G.xpLv=xp.level}   // 레벨업 시 0부터 다시 채움
    G.xpShown+=(target-G.xpShown)*0.25;
    ctx.fillStyle='rgba(124,245,176,.16)';ctx.fillRect(0,H-6,W,6);
    ctx.fillStyle='#7cf5b0';ctx.fillRect(0,H-6,W*G.xpShown,6);
    ctx.textAlign='center';ctx.fillStyle='#bff7d8';ctx.font='bold 13px ui-monospace,Menlo,Consolas,monospace';
    ctx.fillText('LV '+xp.level+'   '+xp.xp+' / '+xp.need+' XP',W/2,H-13);
  }
}

