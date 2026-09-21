/* ================= RENDER: BOSS ================= */
function ellipseCircle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU)}
// 패턴 위험 영역 — patHits()와 동일한 도형/좌표를 그리므로 '보이는 곳 = 맞는 곳'
function drawBossTelegraphs(){
  const b=G.boss;if(!b||b.dead||!b.pat)return;
  const pat=b.pat;
  if(pat.kind==='pulse'){
    const k=1-pat.t/BOSS.pulse.teleT;
    ctx.fillStyle='rgba(255,70,70,'+(0.07+0.15*k)+')';ellipseCircle(pat.cx,pat.cy,pat.r);ctx.fill();
    ctx.strokeStyle='rgba(255,100,100,.95)';ctx.lineWidth=2;ellipseCircle(pat.cx,pat.cy,pat.r);ctx.stroke();
    ctx.strokeStyle='rgba(255,150,150,.7)';ellipseCircle(pat.cx,pat.cy,Math.max(4,pat.r*k));ctx.stroke();
  }else if(pat.kind==='line'){
    const k=1-pat.t/BOSS.line.teleT;
    ctx.save();ctx.translate(pat.ox,pat.oy);ctx.rotate(Math.atan2(pat.dy,pat.dx));
    ctx.fillStyle='rgba(255,70,70,'+(0.08+0.18*k)+')';ctx.fillRect(0,-pat.w/2,1700,pat.w);
    ctx.strokeStyle='rgba(255,100,100,.95)';ctx.lineWidth=2;ctx.strokeRect(0,-pat.w/2,1700,pat.w);
    ctx.restore();
    ctx.strokeStyle='rgba(255,180,180,.7)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ellipseCircle(pat.tx,pat.ty,14);ctx.stroke();ctx.setLineDash([]);   // 1.5초 전 내 위치
    ctx.fillStyle='rgba(255,180,180,.8)';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText('1.5s 전',pat.tx,pat.ty-20);
  }else{
    for(const z of pat.zones){
      if(pat.ph==='tele'){
        const k=1-pat.t/BOSS.zone.teleT;
        ctx.fillStyle='rgba(190,80,255,'+(0.05+0.12*k)+')';ellipseCircle(z.x,z.y,z.r);ctx.fill();
        ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='rgba(215,140,255,.95)';ctx.lineWidth=2;ellipseCircle(z.x,z.y,z.r);ctx.stroke();ctx.restore();
      }else{
        const pulse=0.28+0.1*Math.sin(G.t/6);
        ctx.fillStyle='rgba(190,80,255,'+pulse+')';ellipseCircle(z.x,z.y,z.r);ctx.fill();
        ctx.strokeStyle='rgba(230,170,255,1)';ctx.lineWidth=3;ellipseCircle(z.x,z.y,z.r);ctx.stroke();
      }
    }
  }
}
function drawBossBody(b){
  const intro=G.stage==='intro',a=intro?Math.min(1,G.stageT/60):1;
  ctx.save();ctx.globalAlpha=a;
  const vuln=!b.shield;
  const col=b.flash>0?'#ffffff':(vuln?'#ffd54a':'#e05bff');
  if(vuln){ctx.shadowColor='#ff6b6b';ctx.shadowBlur=22}
  ctx.fillStyle=col;ctx.beginPath();
  for(let k=0;k<6;k++){const ang=b.spin+k*TAU/6,px=b.x+Math.cos(ang)*b.r,py=b.y+Math.sin(ang)*b.r;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(20,0,35,.6)';ctx.beginPath();
  for(let k=0;k<6;k++){const ang=-b.spin*1.6+k*TAU/6,px=b.x+Math.cos(ang)*(b.r*.55),py=b.y+Math.sin(ang)*(b.r*.55);k?ctx.lineTo(px,py):ctx.moveTo(px,py)}
  ctx.closePath();ctx.fill();
  ctx.fillStyle=vuln?'#ff6b6b':'#ffffff';ellipseCircle(b.x,b.y,7);ctx.fill();
  if(b.shield){                                    // SYNC SHIELD 링
    const prot=b.protect>0;
    ctx.save();if(prot)ctx.setLineDash([8,6]);
    ctx.strokeStyle=prot?'rgba(140,170,200,.6)':'rgba(92,200,255,.9)';ctx.lineWidth=4;ellipseCircle(b.x,b.y,b.r+12);ctx.stroke();ctx.restore();
    ctx.fillStyle='rgba(92,200,255,.08)';ellipseCircle(b.x,b.y,b.r+12);ctx.fill();
  }
  ctx.restore();
}
// ECHO가 앞으로 보스를 타격할 지점 + 남은 시간 (가장 이른 2개만, 화면이 지저분해지지 않게)
function drawEchoBossHits(){
  const b=G.boss;if(!b||b.dead||G.stage!=='boss')return;
  const nx=nextEchoBossHit(240);
  for(const e of G.echoes){
    const hs=echoBossHits(e,240).slice(0,2);
    for(const h of hs){
      ctx.strokeStyle='rgba(255,213,74,.95)';ctx.lineWidth=2.5;ellipseCircle(h.x,h.y,14);ctx.stroke();
      ctx.fillStyle='rgba(255,213,74,.95)';ctx.font='bold 11px ui-monospace,Menlo,Consolas,monospace';ctx.textAlign='center';
      ctx.fillText((h.ticks/60).toFixed(1)+'s',h.x,h.y-19);
    }
  }
  if(nx){ctx.strokeStyle='rgba(255,213,74,.35)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(nx.x,nx.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([])}
}
function drawBossHud(){
  const b=G.boss;if(!b)return;
  ctx.textAlign='center';
  const bw=420,bx=W/2-bw/2;
  ctx.fillStyle='#ffd0ee';ctx.font='bold 15px system-ui';ctx.fillText('PARADOX CORE',W/2,22);
  ctx.fillStyle='rgba(255,154,213,.18)';ctx.fillRect(bx,29,bw,12);
  ctx.fillStyle=b.shield?'#e05bff':'#ffd54a';ctx.fillRect(bx,29,bw*Math.max(0,b.hp/b.maxHp),12);
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.strokeRect(bx+.5,29.5,bw-1,11);
  ctx.fillStyle='#e7edf5';ctx.font='11px ui-monospace,Menlo,Consolas,monospace';ctx.fillText(Math.ceil(b.hp)+' / '+b.maxHp,W/2,39);
  if(G.stage==='boss'){
    const s=syncStatus(b);
    ctx.fillStyle=s.c;ctx.font='bold 16px system-ui';ctx.fillText(s.text,W/2,66);
    if(s.kind==='wait'||s.kind==='vuln'){                       // 남은 시간 바 (1.25초 창 / 취약 5초)
      ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(W/2-90,72,180,4);
      ctx.fillStyle=s.c;ctx.fillRect(W/2-90,72,180*Math.max(0,s.left),4);
    }
    const nx=nextEchoBossHit(240);
    if(nx&&b.shield){ctx.fillStyle='#ffd54a';ctx.font='12px system-ui';ctx.fillText('ECHO 타격까지 '+(nx.ticks/60).toFixed(1)+'초',W/2,92)}
  }
  if(G.bossMsg){const a=Math.max(0,1-G.bossMsg.t/1.1);ctx.globalAlpha=a;ctx.fillStyle='#7cf5ff';ctx.font='bold 34px system-ui';ctx.fillText(G.bossMsg.text,W/2,150);ctx.globalAlpha=1}
  if(G.stage==='intro'){const a=Math.min(1,G.stageT/40)*(1-Math.max(0,(G.stageT-90)/30));ctx.globalAlpha=a;ctx.fillStyle='#ff9ad5';ctx.font='bold 40px system-ui';ctx.fillText('PARADOX CORE',W/2,H/2-40);ctx.globalAlpha=1}
}

/* ================= RENDER: PHASE TRAIL / PHASE MARK (짧고 투명한 잔상) ================= */
function drawTrails(){
  for(const tr of G.trails){
    ctx.lineWidth=SYN.trailR*1.4;ctx.lineCap='round';
    for(const sg of tr.segs){
      const a=1-(G.t-sg.t)/SYN.trailTtl;
      ctx.strokeStyle=tr.src==='echo'?'rgba(164,135,255,'+(0.32*a)+')':'rgba(92,200,255,'+(0.32*a)+')';
      ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
    }
  }
  ctx.lineCap='butt';
}
function drawMarks(){
  for(const e of G.enemies){
    const m=markOf(e);if(!m||e.hp<=0)continue;
    const left=1-(G.t-m.t0)/SYN.markTicks,c=m.src==='echo'?'#a487ff':'#5cc8ff';
    ctx.strokeStyle=c;ctx.lineWidth=2;ctx.globalAlpha=0.5+0.5*left;
    const y=e.y-e.r-10;ctx.beginPath();ctx.moveTo(e.x,y-6);ctx.lineTo(e.x+6,y);ctx.lineTo(e.x,y+6);ctx.lineTo(e.x-6,y);ctx.closePath();ctx.stroke();
    ctx.globalAlpha=1;
  }
}
