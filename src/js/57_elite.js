/* ================= ELITE: SYNC LOCK / RELAY CORE ================= */
// ELITE는 새 적 종류가 아니라 CHASER/SHOOTER에 붙는 특수 상태다. 특성은 둘 중 하나만 (동시 보유 없음).
//  · SYNC LOCK : 평소 피해 -65%. PLAYER와 ECHO가 1.25초 안에 각각 한 번 이상 맞히면 SYNC BREAK(0.3초 경직, 3초 정상 피해, 복구 후 0.75초 보호)
//  · RELAY CORE: 생성 시 RELAY GUARD(피해 -40%). PLAYER와 ECHO가 1초 안에 각각 맞히면 RELAY BURST(자신 +2, 반경 140px 다른 적 2 피해 + 약한 넉백, 내부 쿨 1.5초).
//    첫 BURST가 터지면 GUARD는 영구 해제된다(재생성 없음) → 연계를 한 번 만들 시간만 벌어 주고, 이후에는 평범한 ELITE처럼 빨리 처리된다.
// 판정은 '실제 공격 판정(basic/dash/trail)'만 사용한다 — RESONANCE/PHASE MARK/RELAY의 추가 피해 이벤트는 등록되지 않는다.
const ELITE={
  hpMul:1.8,rMul:1.25,xpMul:2,
  bands:[{from:45,to:90,p:0.10,max:1},{from:90,to:210,p:0.16,max:2},{from:210,to:1e9,p:0.20,max:3}],   // v2.6: 초반 45초 없음 / PHASE 1 낮은 확률·1기 / PHASE 2 2기 / PHASE 3 3기
  lock:{dmgMul:0.35,syncT:75,breakT:180,staggerT:18,protectT:45},         // 피해 -65% / 1.25초 / 3초 / 0.3초 / 0.75초
  relay:{syncT:60,extra:2,radius:140,splash:2,cdT:90,guardMul:0.6,knock:260}   // 1초 / 자신 +2 / 반경 140 / 주변 2 / 1.5초 / GUARD 피해 -40% / 주변 넉백
};
const ELITE_INFO={
  lock:{name:'SYNC LOCK',hint:'PLAYER + ECHO로 보호막 파괴',c:'#5cc8ff'},
  relay:{name:'RELAY CORE',hint:'PLAYER + ECHO로 연쇄 폭발',c:'#ffb14a'}
};
const eliteRule=tSec=>ELITE.bands.find(b=>tSec>=b.from&&tSec<b.to)||null;
const eliteCount=()=>{let n=0;for(const e of G.enemies)if(e.elite&&e.hp>0)n++;return n};
function makeElite(e,trait){
  e.hp=e.maxHp=Math.ceil(e.hp*ELITE.hpMul-1e-9);                // HP x1.8 올림 (이동속도/공격 피해는 그대로)
  e.r=Math.round(e.r*ELITE.rMul*10)/10;
  e.elite={trait,shield:trait==='lock',guard:trait==='relay',brk:0,prot:0,stag:0,cd:-1e9,last:{player:-1e9,echo:-1e9},
    stat:{dmgP:0,dmgE:0,breaks:0,bursts:0,burstKills:0,born:G.t,died:-1,firstBurst:-1}};
  G.stats.tel.elite.spawned[trait]++;
  return e;
}
// 스폰 시 호출: 조건이 맞으면 ELITE로 만든다 (CHASER/SHOOTER만, 20초 이후, 동시 상한)
function rollElite(e,tSec){
  if(e.type!=='chaser'&&e.type!=='shooter')return false;
  if(G.stage!=='survive'||G.noElite)return false;
  const r=eliteRule(tSec);if(!r||eliteCount()>=r.max)return false;
  if(Math.random()>=r.p)return false;
  makeElite(e,Math.random()<0.5?'lock':'relay');
  return true;
}
function eliteNotice(e){                                        // 런에서 각 특성 처음 등장할 때 한 번만, 게임을 멈추지 않는 짧은 안내
  const k='elite_'+e.elite.trait;if(G.seen[k])return;G.seen[k]=true;
  const i=ELITE_INFO[e.elite.trait];G.notice={text:i.name+' — '+i.hint,c:i.c,t:0};
}
// 매 틱: 보호막 상태 갱신 (레벨업 중에는 step 자체가 멈추므로 함께 정지)
function tickElite(e){
  const el=e.elite;if(el.trait!=='lock')return;
  if(!el.shield){
    el.brk--;
    if(el.brk<=0){el.shield=true;el.brk=0;el.prot=ELITE.lock.protectT;el.last={player:-1e9,echo:-1e9};
      G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.4,c:'#5cc8ff',r:e.r+26,elite:true})}
  }else if(el.prot>0)el.prot--;
}
function eliteDmgIn(e,dmg){
  const el=e.elite;if(!el)return dmg;
  if(el.trait==='lock')return el.shield?dmg*ELITE.lock.dmgMul:dmg;
  return el.guard?dmg*ELITE.relay.guardMul:dmg;                 // RELAY GUARD: 첫 BURST 전까지만 -40%
}
// 실제 공격 판정이 ELITE에 들어갔을 때 (hitEnemy → onRealHit 이후). who = 'player' | 'echo'
function onEliteReal(e,who){
  const el=e.elite,t=G.t,other=who==='echo'?'player':'echo';
  if(el.trait==='lock'){
    if(!el.shield||el.prot>0)return;                            // 이미 BREAK 상태이거나 복구 직후 보호시간
    el.last[who]=t;
    if(t-el.last[other]<=ELITE.lock.syncT)eliteSyncBreak(e);    // 같은 주체 연속 공격은 other가 갱신되지 않아 성립하지 않는다
  }else{
    el.last[who]=t;
    if(t-el.last[other]<=ELITE.relay.syncT&&t-el.cd>=ELITE.relay.cdT)relayBurst(e,who);
  }
}
function eliteSyncBreak(e){
  const el=e.elite;
  el.shield=false;el.brk=ELITE.lock.breakT;el.stag=ELITE.lock.staggerT;el.last={player:-1e9,echo:-1e9};el.stat.breaks++;
  G.stats.tel.elite.syncBreaks++;
  G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,c:'#7cf5ff',r:e.r+40,elite:true});
  G.fx.push({k:'text',x:e.x,y:e.y-e.r-18,txt:'SYNC BREAK',t:0,life:.8,c:'#7cf5ff',elite:true});
  addPart(e.x,e.y,'#7cf5ff',14,220);G.shake=Math.max(G.shake,4);sfx('sync');
}
function relayBurst(e,who){
  const el=e.elite,R=ELITE.relay,tel=G.stats.tel.elite;
  el.cd=G.t;el.last={player:-1e9,echo:-1e9};el.stat.bursts++;tel.relayBursts++;
  if(el.guard){el.guard=false;el.stat.firstBurst=G.t-el.stat.born;tel.guardBroken++;   // 첫 BURST → GUARD 영구 해제 (재생성 없음)
    G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,c:'#ffe08a',r:e.r+30,elite:true})}
  G.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.45,c:'#ffb14a',r:R.radius,elite:true});
  G.fx.push({k:'text',x:e.x,y:e.y-e.r-18,txt:'RELAY BURST',t:0,life:.8,c:'#ffb14a',elite:true});
  addPart(e.x,e.y,'#ffb14a',18,260);G.shake=Math.max(G.shake,5);sfx('sync');
  applyExtra(e,R.extra,who,'relay');                             // ELITE 자신 추가 피해
  for(const o of G.enemies){                                     // 반경 안의 다른 적 (PLAYER/ECHO에는 피해 없음)
    if(o===e||o.hp<=0||o.dead||o.spawn>0||o.type==='boss')continue;
    if(Math.hypot(o.x-e.x,o.y-e.y)>R.radius)continue;
    applyExtra(o,R.splash,who,'relay');el.stat.splash=(el.stat.splash||0)+R.splash;
    const a=Math.atan2(o.y-e.y,o.x-e.x);o.kx+=Math.cos(a)*R.knock;o.ky+=Math.sin(a)*R.knock;   // 약한 넉백
    G.fx.push({k:'ring',x:o.x,y:o.y,t:0,life:.25,c:'#ffb14a',r:16,elite:true});
    tel.relayHits++;
    if(o.dead){tel.relayKills++;el.stat.burstKills++}else o.rHit=G.t;          // BURST를 맞은 적이 1.5초 안에 다른 공격으로 죽으면 '기여 처치'(assist)
  }
}
// 화면 표시용 상태
function eliteStatus(e){
  const el=e.elite,t=G.t;
  if(el.trait==='lock'){
    if(!el.shield)return{kind:'break',left:el.brk/ELITE.lock.breakT,text:'BREAK',p:false,e:false};
    if(el.prot>0)return{kind:'protect',left:0,text:'',p:false,e:false};
    return{kind:'lock',p:t-el.last.player<=ELITE.lock.syncT,e:t-el.last.echo<=ELITE.lock.syncT};
  }
  return{kind:t-el.cd<ELITE.relay.cdT?'cool':(el.guard?'guard':'relay'),guard:!!el.guard,p:t-el.last.player<=ELITE.relay.syncT,e:t-el.last.echo<=ELITE.relay.syncT};
}
/* ---- 임의 대상(ELITE 등)에 대한 ECHO 타격 예측 (HUD/봇/테스트 공용) ---- */
function echoHitsTarget(f,tg){
  const dx=tg.x-f.x,dy=tg.y-f.y,d=Math.hypot(dx,dy);
  if(d-tg.r>atkRange())return false;
  return Math.abs(angDiff(Math.atan2(dy,dx),f.a))<=CFG.atkArc/2||d<tg.r+16;
}
function echoTargetHits(e,tg,maxTicks){                         // 한 ECHO의 앞으로 maxTicks 이내 대상 타격: [{ticks,x,y}]
  const out=[],len=e.clip.length;
  for(let k=1;k<=maxTicks;k++){
    const n=e.i+k-1;
    if(e.loop+Math.floor(n/len)>=B().echoLoops)break;
    const f=e.clip[n%len];
    if(f.atk&&echoHitsTarget(f,tg))out.push({ticks:k,x:f.x,y:f.y});
  }
  return out;
}
function nextEchoHitOn(tg,maxTicks){
  let best=null;
  for(const e of G.echoes){const h=echoTargetHits(e,tg,maxTicks||240);if(h.length&&(!best||h[0].ticks<best.ticks))best={ticks:h[0].ticks,echo:e,x:h[0].x,y:h[0].y}}
  return best;
}
// 디버그/봇용: 지정 특성의 ELITE를 즉시 생성
function debugSpawnElite(trait,type,x,y){
  const e=makeEnemy(type||'chaser',x===undefined?W/2:x,y===undefined?H/2:y);
  makeElite(e,trait);e.spawn=0;G.enemies.push(e);eliteNotice(e);return e;
}
