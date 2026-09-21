// v2.6.1 300초 전체 런 빌드 벤치마크: ATTACK / ECHO / DASH / HYBRID / RANDOM
// 각 빌드는 레벨업마다 자기 우선순위대로 업그레이드를 고르고, 300초 일반 구간 + PARADOX CORE를 끝까지 플레이한다.
// 사용: node sim/long_build.js [N=200]  →  LONG_BUILD_REPORT.md, sim/out/long_build_report.json
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const B=require('../bots');
const N=+(process.argv[2]||process.env.N||200);
const o=load();const E=o.E;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const NAMES=['ATTACK','ECHO','DASH','HYBRID','RANDOM'];
let exceptions=0;
function runOne(build,seed){
  o.setSeed(seed);E().startGame();let G=E().G;const mem={};
  for(let t=0;t<60*480;t++){
    G=E().G;
    if(G.phase!=='play'&&G.phase!=='levelup')break;
    if(G.phase==='levelup'){B.pickBuild(E,G,build,o.rand);continue}
    if(G.stage==='shift'){E().step();continue}
    B.RUN_BOT.SMART(E,G,t,mem);E().step();      // 봇 실력은 모든 빌드에서 동일(SMART), 차이는 빌드뿐
  }
  G=E().G;const tel=G.stats.tel,rt=tel.run;
  const k=(src,kind)=>(tel.dmg[src]&&tel.dmg[src][kind])||0;
  const tot=['basic','dash','trail','resonance','mark','relay','collision'].reduce((s,x)=>s+k('player',x)+k('echo',x),0)||1;
  const secs=G.runT/60+G.bossT/60;
  return{win:G.phase==='win',reach:G.stage!=='survive',runT:G.runT/60,bossT:G.bossT/60,kills:G.stats.kills,
    level:rt.bossEntry?rt.bossEntry.level:G.exp.level,dps:(tot)/Math.max(1,secs),
    player:(k('player','basic')+k('player','dash')+k('player','trail'))/tot,echo:(k('echo','basic')+k('echo','dash')+k('echo','trail'))/tot,
    basic:(k('player','basic')+k('echo','basic'))/tot,dash:(k('player','dash')+k('echo','dash')+k('player','trail')+k('echo','trail'))/tot,
    syn:(k('player','resonance')+k('echo','resonance')+k('player','mark')+k('echo','mark')+k('player','relay')+k('echo','relay'))/tot,
    taken:(6-G.p.hp)+rt.heal,breaks:tel.elite.syncBreaks,bursts:tel.elite.relayBursts,
    bossTaken:tel.boss.taken,bossSync:tel.boss.syncBreaks,death:G.death};
}
const res={};const t0=Date.now();
for(const b of NAMES)res[b]=Array.from({length:N},(_,i)=>runOne(b,90000+i));
exceptions=o.errs.length;
const S={};
for(const b of NAMES){
  const rs=res[b],reach=rs.filter(r=>r.reach),win=rs.filter(r=>r.win);
  S[b]={n:rs.length,reach:reach.length/rs.length,win:win.length/rs.length,clearOfReach:reach.length?win.length/reach.length:NaN,
    runT:avg(rs.map(r=>r.runT)),kills:avg(rs.map(r=>r.kills)),level:avg(rs.map(r=>r.level)),dps:avg(rs.map(r=>r.dps)),
    player:avg(rs.map(r=>r.player)),echo:avg(rs.map(r=>r.echo)),basic:avg(rs.map(r=>r.basic)),dash:avg(rs.map(r=>r.dash)),syn:avg(rs.map(r=>r.syn)),
    taken:avg(rs.map(r=>r.taken)),breaks:avg(rs.map(r=>r.breaks)),bursts:avg(rs.map(r=>r.bursts)),
    bossTaken:avg(reach.map(r=>r.bossTaken)),bossSync:avg(reach.map(r=>r.bossSync)),bossT:avg(win.map(r=>r.bossT))};
}
// LONG BUILD DOMINANCE: 다른 빌드 평균 대비 5개 기준 중 3개 이상
const dom=[];
for(const b of NAMES){
  const others=NAMES.filter(x=>x!==b),ref=m=>avg(others.map(x=>S[x][m]));
  const hit=[];
  if(S[b].reach-ref('reach')>=0.20)hit.push('보스 도달률 +'+((S[b].reach-ref('reach'))*100).toFixed(0)+'%p');
  if(S[b].win-ref('win')>=0.20)hit.push('클리어율 +'+((S[b].win-ref('win'))*100).toFixed(0)+'%p');
  if(S[b].kills/ref('kills')-1>=0.25)hit.push('처치 +'+((S[b].kills/ref('kills')-1)*100).toFixed(0)+'%');
  if(S[b].dps/ref('dps')-1>=0.25)hit.push('총 DPS +'+((S[b].dps/ref('dps')-1)*100).toFixed(0)+'%');
  if(Number.isFinite(S[b].bossT)&&1-S[b].bossT/ref('bossT')>=0.20)hit.push('보스 시간 -'+((1-S[b].bossT/ref('bossT'))*100).toFixed(0)+'%');
  S[b].domHits=hit;
  if(hit.length>=3)dom.push({build:b,hit});
}
const best=m=>NAMES.reduce((a,b)=>S[b][m]>S[a][m]?b:a,NAMES[0]);
const ident={ATTACK:best('basic')==='ATTACK',ECHO:best('echo')==='ECHO',DASH:best('dash')==='DASH',HYBRID:best('syn')==='HYBRID'};
const rep={N,elapsed:(Date.now()-t0)/1000,exceptions,summary:S,dominance:dom,identity:ident,best:{basic:best('basic'),echo:best('echo'),dash:best('dash'),syn:best('syn'),reach:best('reach'),kills:best('kills')}};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','long_build_report.json'),JSON.stringify(rep,null,1));
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=(x,d=0)=>Number.isFinite(x)?(x*100).toFixed(d)+'%':'-';
const mmss=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'):'-';
let md='# LONG BUILD REPORT (v2.6.1) — 300초 전체 런 빌드 벤치마크\n\n빌드당 '+N+'판, 동일 seed 세트. 조작은 전부 SMART 봇으로 통일하고 업그레이드 선택만 빌드별 우선순위를 따른다(300초 일반 구간 + PARADOX CORE).\n\n';
md+='| 빌드 | 보스 도달률 | 전체 클리어율 | 도달 중 클리어 | 평균 생존 | 처치 | 보스 진입 LV | 총 DPS | 받은 피해 |\n|---|---|---|---|---|---|---|---|---|\n';
for(const b of NAMES){const s=S[b];md+='| '+b+' | '+pc(s.reach)+' | '+pc(s.win)+' | '+pc(s.clearOfReach)+' | '+mmss(s.runT)+' | '+f(s.kills,0)+' | '+f(s.level)+' | '+f(s.dps,2)+' | '+f(s.taken,1)+' |\n'}
md+='\n## 피해 구성 / 기믹 발동\n\n| 빌드 | PLAYER | ECHO | BASIC 공격 | DASH·TRAIL | SYNERGY | ELITE SYNC BREAK | RELAY BURST | 보스 클리어 시간 | 보스전 받은 피해 | 보스 SYNC BREAK |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const b of NAMES){const s=S[b];md+='| '+b+' | '+pc(s.player)+' | '+pc(s.echo)+' | '+pc(s.basic)+' | '+pc(s.dash)+' | '+pc(s.syn)+' | '+f(s.breaks,2)+' | '+f(s.bursts,2)+' | '+f(s.bossT)+'s | '+f(s.bossTaken,2)+' | '+f(s.bossSync,1)+' |\n'}
md+='\n## 빌드 정체성 판정 (300초 런 기준)\n\n';
md+='- ATTACK — BASIC 공격 비중 최고: '+(ident.ATTACK?'✅':'❌ (최고는 '+rep.best.basic+')')+'\n';
md+='- ECHO — ECHO 피해 비율 최고: '+(ident.ECHO?'✅':'❌ (최고는 '+rep.best.echo+')')+'\n';
md+='- DASH — DASH/TRAIL 피해 비율 최고: '+(ident.DASH?'✅':'❌ (최고는 '+rep.best.dash+')')+'\n';
md+='- HYBRID — SYNERGY 피해 비율 최고: '+(ident.HYBRID?'✅':'❌ (최고는 '+rep.best.syn+')')+'\n';
md+='\n## LONG BUILD DOMINANCE\n\n기준(다른 빌드 평균 대비): 보스 도달률 +20%p / 클리어율 +20%p / 처치 +25% / 총 DPS +25% / 보스 시간 -20% 중 3개 이상 동시 충족.\n\n'+(dom.length?dom.map(d=>'- **'+d.build+'**: '+d.hit.join(' / ')).join('\n'):'- 해당 없음')+'\n';
md+='\n각 빌드가 충족한 개별 기준: '+NAMES.map(b=>b+' '+(S[b].domHits.length?S[b].domHits.join('·'):'없음')).join(' / ')+'\n';
md+='\n예외 '+exceptions+'건, 경과 '+f(rep.elapsed)+'s\n';
fs.writeFileSync(path.join(__dirname,'..','..','LONG_BUILD_REPORT.md'),md);
console.log(md);
process.exit(exceptions?1:0);
