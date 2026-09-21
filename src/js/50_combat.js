/* ================= HELPERS ================= */
const rand=(a,b)=>a+Math.random()*(b-a);
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return d};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fmtTime(sec){sec=Math.max(0,Math.ceil(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}

/* ================= COMBAT ================= */
function addPart(x,y,c,n,spd){
  for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(.4,1)*spd;G.fx.push({k:'part',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:rand(.25,.5),c})}
}
// WARDEN 방패: '공격이 발생한 위치(origin) → WARDEN' 방향이 WARDEN 정면 ±60° 안이면 막는다.
// origin이 없는 피해(비방향성 공격, PHASE 충돌 등)는 방패를 무시한다.
function shieldBlocks(e,ox,oy){
  if(e.type!=='warden')return false;
  return Math.abs(angDiff(Math.atan2(oy-e.y,ox-e.x),e.face))<=CFG.warden.shield;
}
// 피해 이벤트: source(PLAYER/ECHO) · kind(basic/dash/trail = 실제 공격 판정, resonance/mark/collision = 추가·기타 피해) · 적 id · 피해량 · 시각(틱)
// 시너지(onRealHit)는 '실제 공격 판정'에서만 발동하고, 추가 피해는 다시 시너지/SYNC를 일으키지 않는다.
const REAL_KINDS={basic:1,dash:1,trail:1};
function logDamage(e,dmg,src,kind){
  const tel=G.stats.tel;
  tel.dmg[src][kind]=(tel.dmg[src][kind]||0)+dmg;
  if(e.type==='boss')tel.dmgBoss[src][kind]=(tel.dmgBoss[src][kind]||0)+dmg;
  G.dmgLog.push({t:G.t,src,kind,id:e.id,dmg});if(G.dmgLog.length>300)G.dmgLog.shift();
}
function killEnemy(e,src){
  const who=src==='echo'?'echo':'player';
  e.dead=true;
  const xpv=XP_VALUE[e.type]||0,mul=e.elite?ELITE.xpMul:1;
  gainXp(xpv*mul);                               // 처치 시점에 딱 1회 지급 (플레이어/ECHO/대시/트레일/추가 피해 동일). ELITE는 XP x2
  if(e.elite){const te=G.stats.tel.elite;te.xpBonus+=xpv*(mul-1);te.kills[e.type]++;e.elite.stat.died=G.t}
  if(e.rHit!==undefined&&G.t-e.rHit<=90)G.stats.tel.elite.relayAssists++;
  G.stats.tel.killBy[e.type][who]++;
  G.stats.kills++;if(src==='echo')G.stats.echo++;else G.stats.you++;
  addPart(e.x,e.y,KILL_COLOR[e.type]||'#ffffff',12,220);
  G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,c:src==='echo'?'#a487ff':'#ffffff',r:26});
  G.shake=Math.max(G.shake,src==='echo'?3:5);
  sfx('kill');
}
function hitEnemy(e,dmg,src,ang,knock,origin,kind){
  kind=kind||'basic';
  if(e.type==='boss')return hitBoss(e,dmg,src,ang,kind);
  if(e.dead)return false;                        // 이미 처치된 적은 무시 (XP 중복 지급 방지)
  const who=src==='echo'?'echo':'player';
  if(origin&&shieldBlocks(e,origin.x,origin.y)){
    const a=Math.atan2(origin.y-e.y,origin.x-e.x);
    G.fx.push({k:'shield',x:e.x,y:e.y,a,t:0,life:.2,r:e.r});
    addPart(e.x+Math.cos(a)*(e.r+8),e.y+Math.sin(a)*(e.r+8),'#cfe8ff',3,110);
    G.stats.tel.shieldBlocked[who]++;sfx('block');
    return false;
  }
  if(e.type==='warden')G.stats.tel.wardenHit[who]++;
  dmg=eliteDmgIn(e,dmg);                         // SYNC LOCK: 보호막이 있으면 받는 피해 -65%
  const applied=Math.min(dmg,Math.max(0,e.hp));
  if(e.elite)e.elite.stat[who==='echo'?'dmgE':'dmgP']+=applied;  // 실제로 깎인 피해(오버킬 제외)
  G.stats.tel.dmgDealt[who]+=applied;logDamage(e,applied,who,kind);
  e.hp-=dmg;e.flash=0.09;
  e.kx+=Math.cos(ang)*CFG.atkKnock*knock;e.ky+=Math.sin(ang)*CFG.atkKnock*knock;
  addPart(e.x,e.y,src==='echo'?'#a487ff':'#ffffff',4,140);
  G.shake=Math.max(G.shake,src==='echo'?2:3.5);
  if(src!=='echo')G.freeze=Math.max(G.freeze,e.hp<=0?0.05:0.03);
  sfx('hit');
  if(e.hp<=0)killEnemy(e,src);
  if(REAL_KINDS[kind]){
    onRealHit(e,who,kind);                       // RESONANCE / PHASE MARK / FEEDBACK LOOP
    if(e.elite&&e.hp>0)onEliteReal(e,who);       // SYNC LOCK / RELAY CORE (실제 공격 판정만)
  }
  return true;
}
// 시너지가 주는 추가 피해 (방패 무시, 시너지/SYNC 재발동 없음)
function applyExtra(e,dmg,src,kind){
  if(e.dead||e.hp<=0)return;
  if(e.type==='boss'){hitBoss(e,dmg,src,0,kind);return}
  const who=src==='echo'?'echo':'player';
  dmg=eliteDmgIn(e,dmg);
  const applied=Math.min(dmg,e.hp);
  if(e.elite)e.elite.stat[who==='echo'?'dmgE':'dmgP']+=applied;
  G.stats.tel.dmgDealt[who]+=applied;logDamage(e,applied,who,kind);
  e.hp-=dmg;e.flash=0.09;
  const xc=kind==='mark'?'#ff9ad5':kind==='relay'?'#ffb14a':'#ffd54a';
  addPart(e.x,e.y,xc,6,160);
  G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.25,c:xc,r:20});
  if(e.hp<=0)killEnemy(e,who);
}
function slash(a,ang,src){
  const dmg=atkDmgOf(src),rng=atkRange();
  G.fx.push({k:'slash',x:a.x,y:a.y,a:ang,t:0,src,rng});
  sfx(src==='echo'?'eatk':'atk');
  let n=0;
  for(const e of G.enemies){
    if(e.hp<=0||e.spawn>0)continue;
    const dx=e.x-a.x,dy=e.y-a.y,d=Math.hypot(dx,dy);
    if(d-e.r>rng)continue;
    const ang2=Math.atan2(dy,dx);
    if(Math.abs(angDiff(ang2,ang))<=CFG.atkArc/2||d<e.r+16){if(hitEnemy(e,dmg,src,ang2,1,a,'basic'))n++}
  }
  return n;
}
function distToSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;
  if(l2===0)return Math.hypot(px-x1,py-y1);
  const k=clamp(((px-x1)*dx+(py-y1)*dy)/l2,0,1);
  return Math.hypot(px-(x1+dx*k),py-(y1+dy*k));
}
function dashDamage(a,src){
  const dmg=dashDmgOf(src);
  for(const e of G.enemies){
    if(e.hp<=0||e.spawn>0||a.dashHit.has(e))continue;
    const d=Math.hypot(e.x-a.x,e.y-a.y);
    if(d<a.r+e.r+8){a.dashHit.add(e);hitEnemy(e,dmg,src,a.dashAng,.35,a,'dash')}
  }
}
function hurtPlayer(dmg,fromX,fromY,tag){
  const p=G.p;
  if(p.inv>0||G.phase!=='play')return;
  if(G.stage==='boss'){const bt=G.stats.tel.boss;bt.taken+=dmg;const k=tag||'other';bt.takenBy[k]=(bt.takenBy[k]||0)+dmg}
  p.hp-=dmg;p.inv=CFG.invSec;
  if(p.hp<=0&&!G.death)G.death={phase:(G.stage==='boss'||G.stage==='intro')?4:phaseOf(runSec()).id,t:runSec(),bossT:G.bossT/60,src:G.lastDmgSrc||'unknown',kind:tag||'other',
    enemies:G.enemies.filter(e=>e.hp>0&&e.type!=='boss').length,elites:G.enemies.filter(e=>e.elite&&e.hp>0).length,level:G.exp.level,hpBefore:p.hp+dmg,stacks:{...G.build.stacks}};   // DEATH HEATMAP용p.flash=.2;G.shake=10;G.hurtFlash=.35;G.freeze=Math.max(G.freeze,0.06);
  addPart(p.x,p.y,'#ff6b6b',10,200);sfx('hurt');
  if(p.hp<=0){p.hp=0;endGame(false)}
}

