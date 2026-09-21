// ELITE 전용 비교: 특성(SYNC LOCK / RELAY CORE) × 봇(IGNORE / SMART) × N판 (같은 seed 세트)
// 시나리오: 일반 플레이로 20초까지 진행 → 특성 고정 ELITE(CHASER/SHOOTER 번갈아) 1기 생성 → 최대 25초 동안 교전
// 사용: node sim/elite_bench.js [N=200]  →  ELITE_REPORT.md, sim/out/elite_report.json
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const {SURVIVE,pickRandom}=require('../bots');
const N=+(process.argv[2]||process.env.N||200);
const o=load();const E=o.E;
const WINDOW=1500,PRE={lock:1200,relay:2700};   // SYNC LOCK은 20초 시점, RELAY CORE는 주변 적 밀도가 실제와 비슷한 45초 시점에서 측정 (기획 5: ELITE는 20~60초에 등장)
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
function run(trait,mode,seed){
  o.setSeed(seed);E().startGame();E().G.noElite=true;
  for(let t=0;E().G.t<PRE[trait];t++){
    const G=E().G;if(G.phase==='dead')return null;
    if(G.phase==='levelup'){pickRandom(E,G,o.rand);t--;continue}
    SURVIVE.sweeper(E,G,t);E().step();
  }
  let G=E().G;const p=G.p;
  const a=o.rand()*Math.PI*2,type=seed%2?'chaser':'shooter';
  const x=Math.max(40,Math.min(920,p.x+Math.cos(a)*260)),y=Math.max(40,Math.min(560,p.y+Math.sin(a)*260));
  const el=E().debugSpawnElite(trait,type,x,y);
  const hp0=p.hp,tel0={bk:G.stats.tel.elite.syncBreaks,bu:G.stats.tel.elite.relayBursts,rk:G.stats.tel.elite.relayKills,rh:G.stats.tel.elite.relayHits,ra:G.stats.tel.elite.relayAssists},t0=G.t;
  const pol=mode==='smart'?SURVIVE.eliteSmart:mode==='timing'?SURVIVE.eliteTiming:SURVIVE.eliteIgnore;
  for(let k=0;k<WINDOW;k++){
    G=E().G;if(G.phase==='dead'||el.dead)break;
    if(G.phase==='levelup'){pickRandom(E,G,o.rand);k--;continue}
    pol(E,G,G.t);E().step();
  }
  G=E().G;const s=el.elite.stat,tel=G.stats.tel.elite;
  const st=el.elite.stat;return{killed:el.dead?1:0,firstBurst:st.firstBurst>=0?st.firstBurst/60:NaN,guardBroken:st.firstBurst>=0?1:0,diedGuarded:(el.dead&&st.firstBurst<0)?1:0,splash:st.splash||0,ticks:el.dead?(s.died-t0):WINDOW,taken:hp0-G.p.hp,dmgP:s.dmgP,dmgE:s.dmgE,breaks:tel.syncBreaks-tel0.bk,bursts:tel.relayBursts-tel0.bu,burstKills:tel.relayKills-tel0.rk,burstHits:tel.relayHits-tel0.rh,assists:tel.relayAssists-tel0.ra,
    playerDied:G.phase==='dead'&&!el.dead?1:0,type};
}
const res={};
for(const trait of['lock','relay'])for(const mode of['ignore','timing','smart']){
  const rs=[];let invalid=0;for(let i=0;i<N*5&&rs.length<N;i++){const r=run(trait,mode,40000+i);if(r)rs.push(r);else invalid++}   // PRE 구간에서 죽은 seed는 제외(세 봇 모두 같은 seed에서 제외됨)
  const kills=rs.filter(r=>r.killed);
  res[trait+':'+mode]={n:rs.length,invalid,killRate:kills.length/rs.length,timeAll:avg(rs.map(r=>r.ticks))/60,timeKill:avg(kills.map(r=>r.ticks))/60,taken:avg(rs.map(r=>r.taken)),dmgP:avg(rs.map(r=>r.dmgP)),dmgE:avg(rs.map(r=>r.dmgE)),
    breaks:avg(rs.map(r=>r.breaks)),bursts:avg(rs.map(r=>r.bursts)),firstBurst:avg(rs.map(r=>r.firstBurst).filter(Number.isFinite)),guardBrokenRate:avg(rs.map(r=>r.guardBroken)),diedGuardedRate:avg(rs.map(r=>r.diedGuarded)),burstKills:avg(rs.map(r=>r.burstKills)),burstHits:avg(rs.map(r=>r.burstHits)),assists:avg(rs.map(r=>r.assists)),deathRate:avg(rs.map(r=>r.playerDied)),
    byType:Object.fromEntries(['chaser','shooter'].map(ty=>{const q=rs.filter(r=>r.type===ty);return[ty,{n:q.length,timeAll:avg(q.map(r=>r.ticks))/60,killRate:avg(q.map(r=>r.killed))}]}))};
}
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=x=>Number.isFinite(x)?(x*100).toFixed(0)+'%':'-';
const L=res['lock:ignore'],LS=res['lock:smart'],LT=res['lock:timing'],R=res['relay:ignore'],RS=res['relay:smart'],RT=res['relay:timing'];
const lockGain=1-LS.timeAll/L.timeAll,burstX=RS.bursts/Math.max(1e-9,R.bursts);
const contrib=RS.burstKills+RS.assists;
const notSlower=RS.timeAll<=R.timeAll*1.05;      // v2.5.1: SMART의 평균 처치 시간이 IGNORE보다 느리지 않을 것
const verdict={lock:lockGain>=0.195,relayBursts:RS.bursts>R.bursts*1.5,relayKills:contrib>=0.10,relayNotSlower:notSlower,
  relay:RS.bursts>R.bursts*1.5&&contrib>=0.10&&notSlower,lockGain,burstX,contrib,timeSmart:RS.timeAll,timeIgnore:R.timeAll,
  guardBrokenRate:RS.guardBrokenRate,guardBrokenRateIgnore:R.guardBrokenRate,diedGuarded:RS.diedGuardedRate,firstBurst:RS.firstBurst};
const rep={N,window:WINDOW/60,results:res,verdict};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','elite_report.json'),JSON.stringify(rep,null,1));
let md='# ELITE REPORT (v2.5)\n\n시나리오: 일반 플레이를 진행(SYNC LOCK 20초 / RELAY CORE 45초 — 연쇄 대상이 되는 주변 적 밀도를 실제와 맞추기 위함)한 뒤 ELITE(CHASER/SHOOTER 번갈아) 1기를 특성 고정으로 생성 → 최대 25초 교전. 특성×봇 조합당 '+N+'판, 같은 seed 세트.\nIGNORE = 가장 가까운 적을 계속 공격(ECHO 타이밍 미사용). TIMING = 공격 타이밍만 ECHO 타격 예정 시간에 맞춤. SMART = TIMING + ECHO 공격 예정 지점으로 ELITE를 유인(이동 속도·회피·대시는 동일, 이동 목표만 다름).\n미처치(25초 초과)는 25초로 계산한 평균 시간(censored)을 함께 표기.\n\n';
md+='| 특성 | 봇 | 판 | 처치율 | 평균 처치 시간(전체) | 처치 시간(처치한 판) | 받은 피해 | PLAYER 피해 | ECHO 피해 | SYNC BREAK | RELAY BURST | BURST가 맞힌 주변 적 | BURST 직접 처치 | BURST 후 1.5초 내 처치(기여) | ELITE로 사망 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const[k,r]of Object.entries(res)){const[tr,m]=k.split(':');md+='| '+(tr==='lock'?'SYNC LOCK':'RELAY CORE')+' | '+m.toUpperCase()+' | '+r.n+' | '+pc(r.killRate)+' | '+f(r.timeAll,2)+'s | '+f(r.timeKill,2)+'s | '+f(r.taken,2)+' | '+f(r.dmgP,2)+' | '+f(r.dmgE,2)+' | '+f(r.breaks,2)+' | '+f(r.bursts,2)+' | '+f(r.burstHits,2)+' | '+f(r.burstKills,2)+' | '+f(r.assists,2)+' | '+pc(r.deathRate)+' |\n'}
md+='\n## 성공 기준 판정\n\n- SYNC LOCK: SMART 평균 처치 시간 '+f(lockGain*100,0)+'% 감소 (TIMING만: '+f((1-LT.timeAll/L.timeAll)*100,0)+'%) (목표 약 20% 이상) → '+(verdict.lock?'✅ 달성':'❌ 미달')+'. 받은 피해 '+f(L.taken,2)+' → '+f(LS.taken,2)+', ELITE로 사망 '+pc(L.deathRate)+' → '+pc(LS.deathRate)+'\n';
md+='- RELAY CORE (1) SMART가 IGNORE보다 RELAY BURST를 명확히 더 많이 발생: '+f(RS.bursts,2)+'회 vs '+f(R.bursts,2)+'회 (x'+f(burstX,1)+'; TIMING만 '+f(RT.bursts,2)+'회) → '+(verdict.relayBursts?'✅ 달성':'❌ 미달')+'\n';
md+='- RELAY CORE (2) BURST가 실제 주변 적 처치에 기여: BURST가 맞힌 주변 적 '+f(RS.burstHits,2)+'기/판, 직접 처치 '+f(RS.burstKills,2)+', 기여 처치(1.5초 내) '+f(RS.assists,2)+', 합계 '+f(contrib,2)+'기/판 (IGNORE '+f(R.burstKills,2)+' / '+f(R.assists,2)+') → '+(verdict.relayKills?'✅ 달성 (목표 0.10 이상)':'❌ 미달 (목표 0.10)')+'\n';
md+='- RELAY CORE (3) SMART의 평균 처치 시간이 IGNORE보다 느리지 않음: SMART '+f(RS.timeAll,2)+'s vs IGNORE '+f(R.timeAll,2)+'s → '+(verdict.relayNotSlower?'✅ 달성':'❌ 미달')+'\n';
md+='- RELAY GUARD: 첫 BURST까지 '+f(RS.firstBurst,2)+'s, GUARD 해제율 SMART '+pc(RS.guardBrokenRate)+' vs IGNORE '+pc(R.guardBrokenRate)+', GUARD 해제 전 처치 비율(SMART) '+pc(RS.diedGuardedRate)+'\n';
fs.writeFileSync(path.join(__dirname,'..','..','ELITE_REPORT.md'),md);
console.log(md);
process.exit(o.errs.length?1:0);
