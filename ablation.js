// v2.6.1 SMART ABLATION: SMART 봇의 ECHO 관련 판단을 하나씩 제거해 장기 생존 기여도를 분해한다.
//  FULL / NO WARDEN FLANK / NO PHASE LURE / NO ELITE SYNC  (+ 대조군 BASIC)
//  사용: node sim/ablation.js [N=200]  →  ABLATION_REPORT.md, sim/out/ablation_report.json
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const B=require('../bots');
const N=+(process.argv[2]||process.env.N||200);
const o=load();const E=o.E;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const VARIANTS=[
  {key:'FULL SMART',bot:'SMART',env:{}},
  {key:'NO WARDEN FLANK',bot:'SMART',env:{NO_WARDEN:'1'}},
  {key:'NO PHASE LURE',bot:'SMART',env:{NO_PHASE:'1'}},
  {key:'NO ELITE SYNC',bot:'SMART',env:{NO_ELITE:'1'}},
  {key:'BASIC (대조군)',bot:'BASIC',env:{}}
];
function runOne(bot,seed){
  o.setSeed(seed);E().startGame();let G=E().G;const mem={};
  for(let t=0;t<60*480;t++){
    G=E().G;
    if(G.phase!=='play'&&G.phase!=='levelup')break;
    if(G.phase==='levelup'){B.pickRandom(E,G,o.rand);continue}
    if(G.stage==='shift'){E().step();continue}
    B.RUN_BOT[bot](E,G,t,mem);E().step();
  }
  G=E().G;const tel=G.stats.tel,d=G.death;
  return{reach:G.stage!=='survive',win:G.phase==='win',runT:G.runT/60,kills:G.stats.kills,level:G.exp.level,
    breaks:tel.elite.syncBreaks,bursts:tel.elite.relayBursts,eliteKills:tel.elite.kills.chaser+tel.elite.kills.shooter,
    heal:tel.run.heal,death:d?{src:d.src,kind:d.kind,phase:d.phase,t:d.t}:null};
}
const res={};const t0=Date.now();
for(const v of VARIANTS){
  for(const[k,val]of Object.entries(v.env))process.env[k]=val;
  res[v.key]=Array.from({length:N},(_,i)=>runOne(v.bot,95000+i));
  for(const k of Object.keys(v.env))delete process.env[k];
}
function srcShare(rs,match){
  const d=rs.map(r=>r.death).filter(Boolean);
  if(!d.length)return NaN;
  return d.filter(x=>match.test(x.src)).length/d.length;
}
const S={};
for(const v of VARIANTS){
  const rs=res[v.key];
  S[v.key]={n:rs.length,reach:avg(rs.map(r=>r.reach?1:0)),win:avg(rs.map(r=>r.win?1:0)),runT:avg(rs.map(r=>r.runT)),
    kills:avg(rs.map(r=>r.kills)),level:avg(rs.map(r=>r.level)),breaks:avg(rs.map(r=>r.breaks)),bursts:avg(rs.map(r=>r.bursts)),
    eliteKills:avg(rs.map(r=>r.eliteKills)),deathWarden:srcShare(rs,/warden/),deathPhase:srcShare(rs,/phase/),deathElite:srcShare(rs,/ELITE/),deathShooter:srcShare(rs,/shooter/),deathChaser:srcShare(rs,/^chaser/)};
}
const full=S['FULL SMART'];
const rep={N,elapsed:(Date.now()-t0)/1000,exceptions:o.errs.length,summary:S};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','ablation_report.json'),JSON.stringify(rep,null,1));
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=(x,d=0)=>Number.isFinite(x)?(x*100).toFixed(d)+'%':'-';
const mmss=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'):'-';
const dpp=x=>Number.isFinite(x)?((x>=0?'+':'')+(x*100).toFixed(0)+'%p'):'-';
let md='# ABLATION REPORT (v2.6.1) — SMART 봇 기능 분해\n\n조건당 '+N+'판, 동일 seed 세트. 이동·회피·대시·교전 거리는 모든 조건이 같은 코드를 쓰고, 표시된 판단만 제거한다.\n업그레이드 선택은 전부 무작위(빌드 편향 배제).\n\n';
md+='| 조건 | 보스 도달률 | FULL 대비 | 클리어율 | 평균 생존 | 처치 | ELITE SYNC BREAK | RELAY BURST | ELITE 처치 |\n|---|---|---|---|---|---|---|---|---|\n';
for(const v of VARIANTS){const s=S[v.key];md+='| '+v.key+' | '+pc(s.reach)+' | '+(v.key==='FULL SMART'?'—':dpp(s.reach-full.reach))+' | '+pc(s.win)+' | '+mmss(s.runT)+' | '+f(s.kills,0)+' | '+f(s.breaks,2)+' | '+f(s.bursts,2)+' | '+f(s.eliteKills,2)+' |\n'}
md+='\n## 사망 원인 분포 (사망한 판 기준)\n\n| 조건 | WARDEN | PHASE HUNTER | ELITE | SHOOTER | CHASER |\n|---|---|---|---|---|---|\n';
for(const v of VARIANTS){const s=S[v.key];md+='| '+v.key+' | '+pc(s.deathWarden)+' | '+pc(s.deathPhase)+' | '+pc(s.deathElite)+' | '+pc(s.deathShooter)+' | '+pc(s.deathChaser)+' |\n'}
md+='\n## 해석\n\n';
const items=[['NO WARDEN FLANK','WARDEN 측후방 공략'],['NO PHASE LURE','PHASE HUNTER를 ECHO에 맡기는 판단'],['NO ELITE SYNC','ELITE SYNC LOCK / RELAY CORE 타이밍']];
for(const[k,label]of items){
  const s=S[k],d=full.reach-s.reach;
  md+='- **'+label+'** 제거 시 보스 도달률 '+pc(s.reach)+' ('+dpp(-d)+'), 평균 생존 '+mmss(s.runT)+' → '+(d>=0.05?'기여 큼':d>=0.02?'기여 보통':d>-0.02?'기여 거의 없음':'**역효과** (제거하는 편이 유리)')+'\n';
}
md+='- 대조군 BASIC(모든 ECHO 판단 없음): 도달률 '+pc(S['BASIC (대조군)'].reach)+' ('+dpp(S['BASIC (대조군)'].reach-full.reach)+')\n';
md+='\n예외 '+rep.exceptions+'건, 경과 '+f(rep.elapsed)+'s\n';
fs.writeFileSync(path.join(__dirname,'..','..','ABLATION_REPORT.md'),md);
console.log(md);
process.exit(o.errs.length?1:0);
