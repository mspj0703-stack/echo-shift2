/* ================= PLAYER / STEP ================= */
function atkHeld(){return input.atk||keys.has('KeyJ')||mouse.down||touch.atk}
function nearestEnemy(p,maxD){
  let best=null,bd=maxD;
  for(const e of G.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<bd){bd=d;best=e}}
  return best;
}
function computeAim(p){
  if(input.aimAngle!=null)return input.aimAngle;
  if(mouse.seen&&!isTouch)return Math.atan2(mouse.y-p.y,mouse.x-p.x);
  if(isTouch){const t=nearestEnemy(p,320);if(t)return Math.atan2(t.y-p.y,t.x-p.x)}
  return p.face;
}
function stepPlayer(){
  const p=G.p;
  p.atkCd=Math.max(0,p.atkCd-DT);p.dashCd=Math.max(0,p.dashCd-DT);p.inv=Math.max(0,p.inv-DT);p.flash=Math.max(0,p.flash-DT);
  let mx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  let my=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
  if(touch.active){mx=touch.joyX;my=touch.joyY}
  const ml=Math.hypot(mx,my);
  if(ml>1){mx/=ml;my/=ml}
  if(ml>0.12)p.face=Math.atan2(my,mx);
  p.aim=computeAim(p);

  if(input.dash&&p.dashCd<=0&&p.dashT<=0){
    p.dashT=CFG.dashDur;p.dashCd=B().dashCd;p.dashHit.clear();
    p.dashAng=ml>0.12?Math.atan2(my,mx):p.aim;
    p.inv=Math.max(p.inv,CFG.dashDur+0.08);
    sfx('dash');
  }
  input.dash=false;

  let dashing=false;
  if(p.dashT>0){
    dashing=true;
    const tpx=p.x,tpy=p.y;
    p.x+=Math.cos(p.dashAng)*CFG.dashSpeed*DT;p.y+=Math.sin(p.dashAng)*CFG.dashSpeed*DT;
    p.dashT-=DT;
    dashDamage(p,'player');
    trailDash(p,'player',tpx,tpy);                 // PHASE TRAIL
    if(G.t%2===0)G.fx.push({k:'ghost',x:p.x,y:p.y,t:0,life:.28,c:'#5cc8ff'});
    if(p.dashT<=0)p.dashHit.clear();
  }else{
    p.trail=null;
    p.x+=mx*CFG.pSpeed*DT;p.y+=my*CFG.pSpeed*DT;
  }
  p.x+=p.kx*DT;p.y+=p.ky*DT;p.kx*=0.85;p.ky*=0.85;                // 보스 RADIAL PULSE 넉백
  p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r);

  let fired=false;
  if(atkHeld()&&p.atkCd<=0&&!dashing){
    fired=true;p.atkCd=B().atkCd;
    slash(p,p.aim,'player');
    p.x=clamp(p.x+Math.cos(p.aim)*6,p.r,W-p.r);p.y=clamp(p.y+Math.sin(p.aim)*6,p.r,H-p.r);   // 공격 시 살짝 전진
  }
  G.rec.push({x:p.x,y:p.y,a:p.aim,atk:fired,dash:dashing});
  G.posHist.push({x:p.x,y:p.y});if(G.posHist.length>150)G.posHist.shift();   // MEMORY LINE용 과거 위치
}
function endGame(win){
  G.phase=win?'win':'dead';
  if(win){G.shots=[];sfx('win')}
  const st=G.stats,tel=st.tel,ratio=st.kills?Math.round(100*st.echo/st.kills):0;
  const inBoss=G.stage==='boss'||G.stage==='intro',bt=tel.boss;
  const runT=G.runT/60;
  endTitle.textContent=win?'PARADOX CORE 격파!':(inBoss?'보스전에서 쓰러졌다':'쓰러졌다 — '+fmtTime(runT)+' 생존 (PHASE '+phaseOf(runT).id+')');
  // 피해 구성: PLAYER / ECHO, 그중 DASH·TRAIL, 시너지(RESONANCE/MARK/RELAY)
  const byKind=(src,k)=>(tel.dmg[src]&&tel.dmg[src][k])||0;
  const tot=['basic','dash','trail','resonance','mark','relay','collision'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0)||1;
  const pl=['basic','dash','trail'].reduce((s,k)=>s+byKind('player',k),0),ec=['basic','dash','trail'].reduce((s,k)=>s+byKind('echo',k),0);
  const dash=['dash','trail'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0);
  const syn=['resonance','mark','relay'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0);
  const pct=v=>Math.round(100*v/tot)+'%';
  const ups=UPGRADES.filter(u=>G.build.stacks[u.id]).map(u=>u.name+' x'+G.build.stacks[u.id]).join(' · ')||'없음';
  endStat.innerHTML=
    (win?'클리어 시간 <em>'+fmtTime(runT+G.bossT/60)+'</em>':'생존 <em>'+fmtTime(runT)+'</em>')
    +' · 최종 <em>LV '+G.exp.level+'</em> · 총 처치 <em>'+st.kills+'</em> (ECHO '+ratio+'%)'
    +'<br>피해 구성 — PLAYER '+pct(pl)+' / ECHO '+pct(ec)+' / DASH·TRAIL '+pct(dash)+' / 시너지 '+pct(syn)
    +(G.boss?'<br>PARADOX CORE '+(win?'격파':'실패')+' — '+(G.bossT/60).toFixed(1)+'초 · SYNC BREAK '+bt.syncBreaks+'회':'<br>PARADOX CORE 미도달')
    +'<br><span class="ups">업그레이드 — '+ups+'</span>';
  setTimeout(()=>{if(G.phase===(win?'win':'dead'))ovEnd.classList.remove('hidden')},win?300:600);
}
function step(){
  if(G.phase!=='play')return;
  G.t++;G.fbUsed=0;
  stepPlayer();
  updateEchoes();
  updateTrails();
  updateEnemies();
  updateBoss();
  if(G.phase!=='play')return;
  if(G.rec.length>=CFG.echoTicks){spawnEcho(G.rec);G.rec=[]}
  updateRun();                                    // 구간 전환 / 300초 → 보스
  if(G.boss&&G.boss.dead){endGame(true);return}
  if(G.exp.pending>0)openLevelUp();              // 이번 틱이 끝난 직후 정지
}
function stepFx(){
  if(G.notice){G.notice.t+=DT;if(G.notice.t>3.5)G.notice=null}
  if(G.bossMsg){G.bossMsg.t+=DT;if(G.bossMsg.t>1.1)G.bossMsg=null}
  for(const f of G.fx){f.t+=DT;if(f.k==='part'){f.x+=f.vx*DT;f.y+=f.vy*DT;f.vx*=.9;f.vy*=.9}}
  G.fx=G.fx.filter(f=>f.t<(f.life||.16));
  G.shake*=0.86;if(G.shake<.2)G.shake=0;
  G.hurtFlash=Math.max(0,G.hurtFlash-DT);
}

