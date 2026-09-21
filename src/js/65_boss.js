/* ================= BOSS: PARADOX CORE ================= */
// 60초 생존 → 일반 적/투사체 정리 → 보스 등장. 핵심 기믹 SYNC SHIELD:
//   PLAYER와 ECHO, 서로 다른 두 소스가 1.25초 안에 모두 맞혀야 SYNC BREAK → 5초 VULNERABLE.
// 모든 보스 타이머는 '틱' 단위 정수(60틱=1초)라 정확히 5.00초처럼 결정적이다.
const PATTERNS=['pulse','line','zone'];       // RADIAL PULSE → MEMORY LINE → PARADOX ZONE 순환

function makeBoss(){
  return{id:NEXT_EID++,type:'boss',x:W/2,y:130,r:BOSS.r,hp:BOSS.hp,maxHp:BOSS.hp,kx:0,ky:0,flash:0,spawn:0,cd:0,wind:0,aim:0,touchCd:0,stun:0,collideCd:0,face:0,tgt:null,dead:false,
    shield:true,protect:0,vuln:0,stagger:0,lastHit:{player:-9999,echo:-9999},clock:0,patIdx:0,gap:60,pat:null,breaks:0,spin:0};
}
function startBossIntro(){
  for(const e of G.enemies){addPart(e.x,e.y,'#ffffff',6,180);G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,c:'#ffffff',r:22})}
  G.enemies=[];G.shots=[];                       // 남은 일반 적/투사체 제거 (XP 없음) — ELITE 상태도 함께 사라진다
  G.fx=G.fx.filter(f=>!f.elite);                 // ELITE 이펙트 제거
  const b=makeBoss();G.boss=b;G.enemies.push(b);
  G.stage='intro';G.stageT=0;G.bossT=0;
  G.shake=Math.max(G.shake,6);sfx('win');
  G.notice={text:'PARADOX CORE — 방패는 PLAYER와 ECHO가 1.25초 안에 모두 맞혀야 깨진다',c:'#ff9ad5',t:0};
}
const bossGap=b=>Math.round(BOSS.gapT*(b.hp<=b.maxHp*0.5?BOSS.fastMul:1));     // HP 50% 이하: 패턴 사이 간격 15% 감소 (예고 시간은 그대로)

/* ---- 패턴 판정 (그려지는 위험 영역 = 실제 피해 영역) ---- */
function patHits(pat,x,y){
  if(pat.kind==='pulse')return Math.hypot(x-pat.cx,y-pat.cy)<=pat.r;
  if(pat.kind==='line'){
    const rx=x-pat.ox,ry=y-pat.oy,along=rx*pat.dx+ry*pat.dy,perp=Math.abs(rx*pat.dy-ry*pat.dx);
    return along>=0&&perp<=pat.w/2;
  }
  for(const z of pat.zones)if(Math.hypot(x-z.x,y-z.y)<=z.r)return true;
  return false;
}
// (x,y)가 lookTicks 안에 이 위치에서 피해를 받게 되는가 (봇/테스트용 — 화면에 보이는 예고 정보만 사용)
function bossDanger(x,y,lookTicks){
  const b=G.boss;if(!b||b.dead||!b.pat)return false;
  const pat=b.pat;
  if(pat.kind==='zone'){
    if(pat.ph==='active')return patHits(pat,x,y);
    return pat.t<=lookTicks&&patHits(pat,x,y);
  }
  return pat.t<=lookTicks&&patHits(pat,x,y);
}

function startPattern(b){
  const p=G.p,kind=PATTERNS[b.patIdx%PATTERNS.length];b.patIdx++;
  if(kind==='pulse'){
    b.pat={kind,ph:'tele',t:BOSS.pulse.teleT,cx:b.x,cy:b.y,r:BOSS.pulse.radius};
  }else if(kind==='line'){
    const past=G.posHist.length>=BOSS.line.backT?G.posHist[G.posHist.length-BOSS.line.backT]:(G.posHist[0]||{x:p.x,y:p.y});   // 약 1.5초 전 위치
    let dx=past.x-b.x,dy=past.y-b.y;const l=Math.hypot(dx,dy)||1;
    b.pat={kind,ph:'tele',t:BOSS.line.teleT,ox:b.x,oy:b.y,dx:dx/l,dy:dy/l,w:BOSS.line.width,tx:past.x,ty:past.y};
  }else{
    const zones=[],Z=BOSS.zone;
    for(let n=0;n<Z.count;n++){
      let x,y,tries=0;
      do{x=rand(90,W-90);y=rand(90,H-90);tries++}while(tries<30&&zones.some(z=>Math.hypot(z.x-x,z.y-y)<Z.radius*2.4));
      zones.push({x,y,r:Z.radius});
    }
    b.pat={kind,ph:'tele',t:Z.teleT,zones,tick:0};
  }
  sfx('warn');
}
function moveBoss(b){
  const p=G.p,dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1;
  b.x=clamp(b.x+dx/d*BOSS.speed*DT,b.r,W-b.r);b.y=clamp(b.y+dy/d*BOSS.speed*DT,b.r,H-b.r);
}
function firePulse(b,pat){
  const p=G.p;
  G.fx.push({k:'ring',x:pat.cx,y:pat.cy,t:0,life:.5,c:'#ff6b6b',r:pat.r});
  G.shake=Math.max(G.shake,8);sfx('hurt');
  if(patHits(pat,p.x,p.y)){
    const a=Math.atan2(p.y-pat.cy,p.x-pat.cx);
    p.kx+=Math.cos(a)*BOSS.pulse.knock;p.ky+=Math.sin(a)*BOSS.pulse.knock;      // 바깥쪽 넉백
    (G.lastDmgSrc='PARADOX CORE',hurtPlayer(1,pat.cx,pat.cy,'pulse'));
  }
}
function fireLine(b,pat){
  const p=G.p;
  G.fx.push({k:'linefx',x:pat.ox,y:pat.oy,dx:pat.dx,dy:pat.dy,w:pat.w,t:0,life:.3});
  G.shake=Math.max(G.shake,5);sfx('hurt');
  if(patHits(pat,p.x,p.y))(G.lastDmgSrc='PARADOX CORE',hurtPlayer(1,pat.ox,pat.oy,'line'));
}
function updateBoss(){
  const b=G.boss;if(!b||b.dead)return;
  const p=G.p;
  if(G.stage==='intro'){                          // 등장 연출 ~2초: 보스는 무적, 행동 없음
    G.stageT++;b.spin+=0.05;
    if(G.stageT>=BOSS.introT){G.stage='boss';b.gap=60}
    return;
  }
  if(G.stage!=='boss')return;
  G.bossT++;b.clock++;b.spin+=0.03;
  if(!b.shield){b.vuln--;if(b.vuln<=0)restoreShield(b)}          // VULNERABLE은 경직 중에도 흐른다 (정확히 300틱)
  else if(b.protect>0)b.protect--;
  if(b.stagger>0){b.stagger--;return}                             // 경직: 이동/패턴 정지
  const pat=b.pat;
  if(!pat){
    moveBoss(b);
    b.gap--;
    if(b.gap<=0)startPattern(b);
  }else{
    pat.t--;
    if(pat.kind==='zone'){
      if(pat.ph==='tele'){
        if(pat.t<=0){pat.ph='active';pat.t=BOSS.zone.activeT;pat.tick=BOSS.zone.tickT}
      }else{
        moveBoss(b);                              // 발동 후 보스는 다시 천천히 추적
        pat.tick--;
        if(pat.tick<=0){pat.tick=BOSS.zone.tickT;if(patHits(pat,p.x,p.y))(G.lastDmgSrc='PARADOX CORE',hurtPlayer(1,p.x,p.y,'zone'))}
        if(pat.t<=0){b.pat=null;b.gap=bossGap(b)}
      }
    }else if(pat.t<=0){
      if(pat.kind==='pulse')firePulse(b,pat);else fireLine(b,pat);
      b.pat=null;b.gap=bossGap(b);
    }
  }
  if(Math.hypot(p.x-b.x,p.y-b.y)<p.r+b.r&&p.inv<=0&&p.dashT<=0){G.lastDmgSrc='PARADOX CORE';hurtPlayer(1,b.x,b.y,'contact')}   // 접촉 피해
}

/* ---- SYNC SHIELD / SYNC BREAK ---- */
function hitBoss(b,dmg,src,ang,kind){
  if(b.dead||G.stage!=='boss')return false;       // 등장 연출 중에는 피해 없음
  kind=kind||'basic';const real=!!REAL_KINDS[kind];   // 추가 피해(resonance/mark)는 SYNC 적중으로 세지 않는다
  const who=src==='echo'?'echo':'player',bt=G.stats.tel.boss;
  const d=b.shield?dmg*BOSS.shieldMul:dmg;        // SYNC SHIELD: 모든 일반 피해 80% 감소 (ECHO도 동일)
  const before=b.hp;b.hp-=d;b.flash=0.09;
  const applied=Math.max(0,Math.min(d,before));bt.dmg[who]+=applied;if(real)bt.hits[who]++;logDamage(b,applied,who,kind);
  if(b.shield)bt.shieldDmg+=applied;else bt.vulnDmg+=applied;
  addPart(b.x,b.y,who==='echo'?'#a487ff':'#ffffff',3,120);
  G.shake=Math.max(G.shake,who==='echo'?1.5:2.5);sfx('hit');
  if(b.shield){
    if(real)G.fx.push({k:'shield',x:b.x,y:b.y,a:ang+Math.PI,t:0,life:.2,r:b.r});
    if(real&&b.protect<=0){                             // 재생 직후 보호 시간에는 SYNC를 쌓을 수 없다
      b.lastHit[who]=b.clock;
      const other=who==='echo'?'player':'echo';
      if(b.clock-b.lastHit[other]<=BOSS.syncT)syncBreak(b);          // 서로 다른 두 소스가 1.25초(75틱) 이내
    }
  }
  if(b.hp<=0){
    b.hp=0;b.dead=true;bt.time=G.bossT;
    addPart(b.x,b.y,'#ff9ad5',40,320);addPart(b.x,b.y,'#ffffff',20,260);
    G.fx.push({k:'ring',x:b.x,y:b.y,t:0,life:.8,c:'#ff9ad5',r:140});
    G.shake=14;G.freeze=Math.max(G.freeze,0.12);sfx('kill');
  }
  if(real&&!b.dead)onRealHit(b,who,kind);        // 시너지 (보스에게도 동일 적용)
  return true;
}
function syncBreak(b){
  b.shield=false;b.vuln=BOSS.vulnT;b.stagger=BOSS.staggerT;b.lastHit={player:-9999,echo:-9999};b.breaks++;
  G.stats.tel.boss.syncBreaks++;
  G.stats.tel.boss.syncWait+=Math.max(0,b.clock-(b.shieldSince||0)-(b.shieldSince?BOSS.protectT:0));G.stats.tel.boss.syncWaitN++;   // 방패가 (재)생성된 뒤 보호 해제부터 SYNC BREAK까지 걸린 틱
  G.fx.push({k:'ring',x:b.x,y:b.y,t:0,life:.6,c:'#7cf5ff',r:120});
  G.fx.push({k:'ring',x:b.x,y:b.y,t:0,life:.4,c:'#ffffff',r:70});
  addPart(b.x,b.y,'#7cf5ff',24,300);
  G.shake=Math.max(G.shake,9);G.freeze=Math.max(G.freeze,0.08);sfx('sync');
  G.bossMsg={text:'SYNC BREAK',t:0};
}
function restoreShield(b){
  b.shield=true;b.vuln=0;b.protect=BOSS.protectT;b.shieldSince=b.clock;b.lastHit={player:-9999,echo:-9999};
  G.fx.push({k:'ring',x:b.x,y:b.y,t:0,life:.5,c:'#5cc8ff',r:90});sfx('block');
}
// UI용 상태: 지금 방패가 어떤 상태인지
function syncStatus(b){
  if(!b.shield)return{kind:'vuln',text:'VULNERABLE — '+(b.vuln/60).toFixed(1)+'s',c:'#ffd54a',left:b.vuln/BOSS.vulnT};
  if(b.protect>0)return{kind:'protect',text:'SYNC SHIELD — 안정화 '+(b.protect/60).toFixed(1)+'s',c:'#8ea0b6',left:0};
  const pl=b.clock-b.lastHit.player<=BOSS.syncT,ec=b.clock-b.lastHit.echo<=BOSS.syncT;
  if(pl&&!ec)return{kind:'wait',text:'PLAYER ✓ / ECHO ○',c:'#7cf5b0',left:1-(b.clock-b.lastHit.player)/BOSS.syncT};
  if(ec&&!pl)return{kind:'wait',text:'PLAYER ○ / ECHO ✓',c:'#c9b8ff',left:1-(b.clock-b.lastHit.echo)/BOSS.syncT};
  return{kind:'shield',text:'SYNC SHIELD',c:'#5cc8ff',left:0};
}

/* ---- ECHO의 앞으로의 보스 타격 예측 (HUD/봇/테스트 공용) ---- */
function echoHitsBoss(f,b){                        // 녹화 프레임 f의 공격이 '현재 보스 위치' 기준으로 보스에 닿는가
  const dx=b.x-f.x,dy=b.y-f.y,d=Math.hypot(dx,dy);
  if(d-b.r>atkRange())return false;
  return Math.abs(angDiff(Math.atan2(dy,dx),f.a))<=CFG.atkArc/2||d<b.r+16;
}
// 한 ECHO의 앞으로 maxTicks 이내 보스 타격 목록: [{ticks,x,y}] (ticks = 몇 틱 뒤)
function echoBossHits(e,maxTicks){
  const b=G.boss,out=[];if(!b||b.dead)return out;
  const len=e.clip.length;
  for(let k=1;k<=maxTicks;k++){
    const n=e.i+k-1;
    if(e.loop+Math.floor(n/len)>=B().echoLoops)break;
    const f=e.clip[n%len];
    if(f.atk&&echoHitsBoss(f,b))out.push({ticks:k,x:f.x,y:f.y});
  }
  return out;
}
function nextEchoBossHit(maxTicks){                // 모든 ECHO 중 가장 이른 보스 타격 → {ticks,echo} 또는 null
  let best=null;
  for(const e of G.echoes){
    const h=echoBossHits(e,maxTicks||240);
    if(h.length&&(!best||h[0].ticks<best.ticks))best={ticks:h[0].ticks,echo:e,x:h[0].x,y:h[0].y};
  }
  return best;
}
// 디버그/봇용: 곧바로 보스전 시작 (level: 미리 올릴 레벨 수 — 무작위 업그레이드 선택)
function debugStartBoss(opts){
  opts=opts||{};
  startGame();
  const picks=opts.picks||0;
  for(let i=0;i<picks;i++){
    const ch=rollChoices();if(!ch.length)break;
    const u=ch[Math.floor(Math.random()*ch.length)];u.apply(B());B().stacks[u.id]=(B().stacks[u.id]||0)+1;G.exp.level++;
  }
  startBossIntro();
  if(opts.skipIntro!==false){G.stage='boss';G.stageT=BOSS.introT}
  return G.boss;
}
