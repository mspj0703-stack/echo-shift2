// v2.6 전체 런(300초 + PARADOX CORE) 시뮬레이션: BASIC vs SMART
//  · 런 구조/난도 곡선/레벨 곡선/빌드 완성 속도/사망 분포를 한 번에 측정한다.
//  · 사용: node sim/sim_run.js [N=300]  →  RUN_REPORT.md, DEATH_REPORT.md, sim/out/run_report.json
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const B=require('../bots');
const N=+(process.argv[2]||process.env.N||300);
const o=load();const E=o.E;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const fin=(...a)=>a.every(Number.isFinite);
const problems=[];const chk=(c,m)=>{if(!c&&problems.length<40)problems.push(m)};
function runOne(kind,seed){
  o.setSeed(seed);E().startGame();let G=E().G;const mem={};
  let peak=0,shiftTicks=0,runAtShift=[],healLog=[];
  for(let t=0;t<60*480;t++){
    G=E().G;
    if(G.phase!=='play'&&G.phase!=='levelup')break;
    if(G.phase==='levelup'){B.pickRandom(E,G,o.rand);continue}
    if(G.stage==='shift'){shiftTicks++;const r0=G.runT;E().step();chk(G.runT===r0,'전환 중 런 타이머가 진행됨');continue}
    B.RUN_BOT[kind](E,G,t,mem);E().step();
    G=E().G;
    if(t%60===0){
      peak=Math.max(peak,G.enemies.filter(e=>e.type!=='boss').length);
      chk(fin(G.p.x,G.p.y,G.p.hp,G.exp.xp),'NaN 상태');
      const el=G.enemies.filter(e=>e.elite&&e.hp>0).length,sec=G.runT/60;
      chk(el<=(sec<90?1:sec<210?2:3),'ELITE 동시 상한 초과 '+el+' @'+sec.toFixed(0));
      chk(G.enemies.filter(e=>e.type!=='boss').length<=31,'적 상한 초과');
      chk(sec<45?!G.enemies.some(e=>e.elite):true,'45초 이전 ELITE 등장');
    }
  }
  E().render();                                    // 런 종료 상태로 1회 렌더 (그리기 예외 검사). 렌더는 화면 흔들림에 난수를 쓰므로 런 도중에는 호출하지 않는다
  G=E().G;const tel=G.stats.tel,rt=tel.run;
  const byKind=(src,k)=>(tel.dmg[src]&&tel.dmg[src][k])||0;
  const tot=['basic','dash','trail','resonance','mark','relay','collision'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0)||1;
  return{
    win:G.phase==='win',reach:G.stage!=='survive',runT:G.runT/60,bossT:G.bossT/60,level:G.exp.level,kills:G.stats.kills,
    echoKill:G.stats.kills?G.stats.echo/G.stats.kills:0,peak,heal:rt.heal,phaseEnd:rt.phaseEnd,bossEntry:rt.bossEntry,levelAt:{...rt.levelAt},
    firstPick:{...rt.firstPick},maxAt:{...rt.maxAt},stacks:{...G.build.stacks},picks:Object.values(G.build.stacks).reduce((s,v)=>s+v,0),
    dmg:{player:['basic','dash','trail'].reduce((s,k)=>s+byKind('player',k),0)/tot,echo:['basic','dash','trail'].reduce((s,k)=>s+byKind('echo',k),0)/tot,
      dash:['dash','trail'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0)/tot,syn:['resonance','mark','relay'].reduce((s,k)=>s+byKind('player',k)+byKind('echo',k),0)/tot},
    death:G.death,elite:{...tel.elite},bossTaken:tel.boss.taken,syncBreaks:tel.boss.syncBreaks
  };
}
const res={};const t0=Date.now();
for(const kind of['BASIC','SMART'])res[kind]=Array.from({length:N},(_,i)=>runOne(kind,70000+i));
const UPS=E().UPGRADES.map(u=>({id:u.id,name:u.name,max:u.max}));
function summarize(rs){
  const reach=rs.filter(r=>r.reach),win=rs.filter(r=>r.win);
  const lv=m=>avg(rs.map(r=>r.levelAt[m]).filter(Number.isFinite));
  const ph=(i,k)=>avg(rs.map(r=>r.phaseEnd[i]&&r.phaseEnd[i][k]).filter(Number.isFinite));
  return{n:rs.length,reachRate:reach.length/rs.length,winRate:win.length/rs.length,clearOfReach:reach.length?win.length/reach.length:NaN,
    runT:avg(rs.map(r=>r.runT)),totalT:avg(rs.map(r=>r.runT+r.bossT)),clearT:avg(win.map(r=>r.runT+r.bossT)),
    level:avg(rs.map(r=>r.level)),lv90:lv(90),lv210:lv(210),lv300:lv(300),bossLevel:avg(rs.map(r=>r.bossEntry&&r.bossEntry.level).filter(Number.isFinite)),
    picks:avg(rs.map(r=>r.picks)),kills:avg(rs.map(r=>r.kills)),echoKill:avg(rs.map(r=>r.echoKill)),peak:avg(rs.map(r=>r.peak)),heal:avg(rs.map(r=>r.heal)),
    hp1:ph(0,'hpBefore'),hp1a:ph(0,'hpAfter'),hp2:ph(1,'hpBefore'),hp2a:ph(1,'hpAfter'),
    bossHp:avg(rs.map(r=>r.bossEntry&&r.bossEntry.hpBefore).filter(Number.isFinite)),bossHpA:avg(rs.map(r=>r.bossEntry&&r.bossEntry.hpAfter).filter(Number.isFinite)),
    dmg:{player:avg(rs.map(r=>r.dmg.player)),echo:avg(rs.map(r=>r.dmg.echo)),dash:avg(rs.map(r=>r.dmg.dash)),syn:avg(rs.map(r=>r.dmg.syn))},
    bossTaken:avg(reach.map(r=>r.bossTaken)),syncBreaks:avg(reach.map(r=>r.syncBreaks)),
    elite:{bursts:avg(rs.map(r=>r.elite.relayBursts)),breaks:avg(rs.map(r=>r.elite.syncBreaks))},
    build:Object.fromEntries(UPS.map(u=>{
      const first=rs.map(r=>r.firstPick[u.id]).filter(Number.isFinite),maxAt=rs.map(r=>r.maxAt[u.id]).filter(Number.isFinite);
      return[u.id,{pickRate:first.length/rs.length,firstAt:avg(first),maxRate:maxAt.length/rs.length,maxAt:avg(maxAt),avgStack:avg(rs.map(r=>r.stacks[u.id]||0))}];
    }))};
}
const rep={N,elapsed:0,problems,exceptions:o.errs.length,summary:{},deaths:{}};
for(const k of['BASIC','SMART'])rep.summary[k]=summarize(res[k]);
// ---- DEATH HEATMAP (20초 버킷) ----
function deaths(rs){
  const buckets={},byPhase={1:0,2:0,3:0,4:0},bySrc={},byKind={};let n=0;
  for(const r of rs){
    const d=r.death;if(!d)continue;n++;
    const b=Math.floor((d.phase===4?300+d.bossT:d.t)/20)*20;buckets[b]=(buckets[b]||0)+1;
    byPhase[d.phase]++;bySrc[d.src]=(bySrc[d.src]||0)+1;byKind[d.kind]=(byKind[d.kind]||0)+1;
  }
  const withD=rs.filter(r=>r.death);
  return{n,buckets,byPhase,bySrc,byKind,avgEnemies:avg(withD.map(r=>r.death.enemies)),avgElites:avg(withD.map(r=>r.death.elites)),avgLevel:avg(withD.map(r=>r.death.level))};
}
for(const k of['BASIC','SMART'])rep.deaths[k]=deaths(res[k]);
rep.elapsed=(Date.now()-t0)/1000;
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','run_report.json'),JSON.stringify(rep,null,1));
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=(x,d=0)=>Number.isFinite(x)?(x*100).toFixed(d)+'%':'-';
const mmss=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'):'-';
/* ---- RUN_REPORT.md ---- */
let md='# RUN REPORT (v2.6) — 5분 런 구조\n\n봇당 '+N+'판, 동일 seed 세트. BASIC/SMART는 이동·회피·대시·교전 거리를 같은 코드로 수행하고 ECHO 기믹 판단만 다르다.\n업그레이드 선택은 두 봇 모두 무작위(빌드 편향 배제).\n\n';
md+='| 봇 | 보스 도달률 | 클리어율(전체) | 도달 중 클리어 | 평균 일반 구간 | 평균 총 런 | 평균 클리어 시간 | 최종 LV | 처치 | ECHO 처치 비율 | 동시 적 최대 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const k of['BASIC','SMART']){const s=rep.summary[k];md+='| '+k+' | '+pc(s.reachRate)+' | '+pc(s.winRate)+' | '+pc(s.clearOfReach)+' | '+mmss(s.runT)+' | '+mmss(s.totalT)+' | '+mmss(s.clearT)+' | '+f(s.level)+' | '+f(s.kills,0)+' | '+pc(s.echoKill)+' | '+f(s.peak,0)+' |\n'}
md+='\n## 레벨 곡선 (목표: 보스 진입 LV 9~12)\n\n| 봇 | 90초 | 210초 | 300초 | 보스 진입 | 한 런 업그레이드 선택 |\n|---|---|---|---|---|---|\n';
for(const k of['BASIC','SMART']){const s=rep.summary[k];md+='| '+k+' | '+f(s.lv90)+' | '+f(s.lv210)+' | '+f(s.lv300)+' | '+f(s.bossLevel)+' | '+f(s.picks)+'회 |\n'}
md+='\n## HP / 전환 회복 (HP 최대 6, 전환마다 +2)\n\n| 봇 | PHASE 1 종료 | 회복 후 | PHASE 2 종료 | 회복 후 | 보스 진입 전 | 회복 후 | 한 런 실회복량 |\n|---|---|---|---|---|---|---|---|\n';
for(const k of['BASIC','SMART']){const s=rep.summary[k];md+='| '+k+' | '+f(s.hp1,2)+' | '+f(s.hp1a,2)+' | '+f(s.hp2,2)+' | '+f(s.hp2a,2)+' | '+f(s.bossHp,2)+' | '+f(s.bossHpA,2)+' | '+f(s.heal,2)+' |\n'}
md+='\n## 피해 구성 / 보스\n\n| 봇 | PLAYER | ECHO | DASH·TRAIL | 시너지 | ELITE SYNC BREAK | RELAY BURST | 보스전 받은 피해 | 보스 SYNC BREAK |\n|---|---|---|---|---|---|---|---|---|\n';
for(const k of['BASIC','SMART']){const s=rep.summary[k];md+='| '+k+' | '+pc(s.dmg.player)+' | '+pc(s.dmg.echo)+' | '+pc(s.dmg.dash)+' | '+pc(s.dmg.syn)+' | '+f(s.elite.breaks,2)+' | '+f(s.elite.bursts,2)+' | '+f(s.bossTaken,2)+' | '+f(s.syncBreaks,1)+' |\n'}
md+='\n## 빌드 완성 속도 (SMART 기준, 첫 선택 시각 / 최대 스택 도달)\n\n| 업그레이드 | 선택률 | 첫 선택 | 최대 스택 도달률 | 최대 도달 시각 | 평균 스택 |\n|---|---|---|---|---|---|\n';
for(const u of UPS){const b=rep.summary.SMART.build[u.id];md+='| '+u.name+' (max '+u.max+') | '+pc(b.pickRate)+' | '+mmss(b.firstAt)+' | '+pc(b.maxRate)+' | '+mmss(b.maxAt)+' | '+f(b.avgStack,2)+' |\n'}
const tr=rep.summary.SMART.build.trail,trB=rep.summary.BASIC.build.trail;
md+='\n### PHASE TRAIL 재판정 (기획 15)\n\n- 1스택 선택 시점: SMART '+mmss(tr.firstAt)+' / BASIC '+mmss(trB.firstAt)+' (선택률 '+pc(tr.pickRate)+')\n- max(3스택) 도달 확률: SMART '+pc(tr.maxRate)+' / BASIC '+pc(trB.maxRate)+', 도달 평균 시각 '+mmss(tr.maxAt)+'\n- 평균 스택: SMART '+f(tr.avgStack,2)+' → 5분 런에서 max 상태로 보내는 시간은 런 후반 일부에 그친다\n- 전체 런 DASH·TRAIL 피해 비중: BASIC '+pc(rep.summary.BASIC.dmg.dash)+' / SMART '+pc(rep.summary.SMART.dmg.dash)+'\n- ABSOLUTE/RELATIVE 이상치 판정은 BENCHMARK_REPORT.md 참조 (자동 하향은 적용하지 않음)\n';
md+='\n## 기술 검증\n\n- 예외 '+rep.exceptions+'건, 상태/상한 문제 '+problems.length+'건'+(problems.length?': '+problems.slice(0,5).join(' / '):'')+'\n- 경과 '+f(rep.elapsed)+'s\n';
fs.writeFileSync(path.join(__dirname,'..','..','RUN_REPORT.md'),md);
/* ---- DEATH_REPORT.md ---- */
let dm='# DEATH REPORT (v2.6) — 사망 분포\n\n봇당 '+N+'판. PHASE 4 = PARADOX CORE 전투 중 사망.\n\n';
for(const k of['BASIC','SMART']){
  const d=rep.deaths[k],tot=d.n||1;
  dm+='## '+k+' (사망 '+d.n+'판)\n\n구간별: '+[1,2,3,4].map(p=>'PHASE '+p+' '+pc(d.byPhase[p]/tot)).join(' · ')+'\n\n';
  dm+='사망 시 평균 — 적 '+f(d.avgEnemies,1)+'기 / ELITE '+f(d.avgElites,2)+'기 / LV '+f(d.avgLevel,1)+'\n\n';
  dm+='마지막 피해 원인: '+Object.entries(d.bySrc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([s,n])=>s+' '+pc(n/tot)).join(' · ')+'\n\n';
  dm+='피해 종류: '+Object.entries(d.byKind).sort((a,b)=>b[1]-a[1]).map(([s,n])=>s+' '+pc(n/tot)).join(' · ')+'\n\n';
  dm+='### DEATH HEATMAP (20초 버킷)\n\n```\n';
  const keys=Object.keys(d.buckets).map(Number).sort((a,b)=>a-b);
  const mx=Math.max(1,...keys.map(x=>d.buckets[x]));
  for(let s=0;s<=Math.max(300,...keys);s+=20){
    const c=d.buckets[s]||0,bar='#'.repeat(Math.round(20*c/mx));
    dm+=String(s).padStart(3)+'~'+String(s+20).padStart(3)+'s '+String(c).padStart(3)+' '+bar+'\n';
  }
  dm+='```\n\n';
  const spike=keys.filter(x=>d.buckets[x]>=0.20*tot);
  const top=Object.entries(d.bySrc).sort((a,b)=>b[1]-a[1])[0];
  if(top&&top[1]/tot>=0.60)dm+='**DEATH SOURCE DOMINANCE**: '+top[0]+'이(가) 사망 원인의 '+pc(top[1]/tot)+' 차지 (기준 60%)\n\n';
  else dm+='DEATH SOURCE DOMINANCE 없음 (최다 원인 '+(top?top[0]+' '+pc(top[1]/tot):'-')+', 기준 60%)\n\n';
  dm+=(spike.length?'난도 스파이크 의심: '+spike.map(s=>s+'~'+(s+20)+'초 ('+pc(d.buckets[s]/tot)+')').join(', '):'한 구간에 20% 이상 몰리는 난도 스파이크 없음')+'\n\n';
}
fs.writeFileSync(path.join(__dirname,'..','..','DEATH_REPORT.md'),dm);
console.log(md);console.log('예외',o.errs.length,'문제',problems.length,'경과',f(rep.elapsed)+'s');
process.exit(o.errs.length?1:0);
