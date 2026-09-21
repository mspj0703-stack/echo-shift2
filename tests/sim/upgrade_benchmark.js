// 업그레이드 자동 벤치마크: 같은 seed 세트·같은 봇 조건에서 [기준 빌드 / 업그레이드 1스택 / 최대 스택]을 비교한다.
//  · 고정 빌드: 레벨업 선택창은 열리되 선택 결과를 되돌려 빌드를 조건대로 유지 (레벨은 그대로 오름 → '최종 레벨' 측정)
//  · 일반 구간(60초): 사망 가능한 kiter 봇 / 보스: 보스 단독, BOT B, HP 6
//  · 이상치(BALANCE OUTLIER): 같은 스택 수준의 '다른 업그레이드 평균 향상폭'보다 기준 이상 크게 향상되면 표시 (수치는 자동 수정하지 않음)
// 사용: node sim/upgrade_benchmark.js [RUNS=100]
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const {SURVIVE,BOSS_BOT}=require('../bots');
const RUNS=+(process.argv[2]||process.env.RUNS||100);
const o=load();const E=o.E;
const ups=E().UPGRADES.map(u=>({id:u.id,name:u.name,max:u.max}));
const specs=[{key:'BASE',id:null,n:0,build:{}}];
for(const u of ups){specs.push({key:u.id+'@1',id:u.id,n:1,build:{[u.id]:1}});specs.push({key:u.id+'@max',id:u.id,n:u.max,build:{[u.id]:u.max}})}
function applyBuild(build){for(const[id,n]of Object.entries(build)){const u=E().UPGRADES.find(x=>x.id===id);for(let i=0;i<n;i++)u.apply(E().B());E().B().stacks[id]=n}}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const DASHY={has:()=>true};        // 공정성: 기준/모든 조건의 봇이 동일하게 공격 대시를 사용 (차이는 업그레이드에서만)
function runSurvive(spec,seed){
  o.setSeed(seed);E().startGame();applyBuild(spec.build);const snap=JSON.stringify(E().G.build);
  for(let t=0;t<3700;t++){
    let G=E().G;if(G.phase==='dead'||G.stage!=='survive')break;
    if(G.phase==='levelup'){E().chooseUpgrade(0);E().G.build=JSON.parse(snap);t--;continue}     // 선택 결과를 되돌려 빌드 고정
    SURVIVE.sweeper(E,G,t,{dashAssist:DASHY.has(spec.id)});E().step();
  }
  const G=E().G,tel=G.stats.tel,d=tel.dmgDealt,tot=d.player+d.echo,el=Math.max(1,G.t/60);
  return{survived:G.stage!=='survive'?1:0,time:Math.min(60,G.t/60),kills:G.stats.kills,dps:tot/el,echoShare:tot?d.echo/tot:0,level:G.exp.level};
}
function runBoss(spec,seed){
  o.setSeed(seed);E().debugStartBoss({picks:0});applyBuild(spec.build);E().G.p.hp=E().CFG.pHp;E().G.spawnT=1e9;
  for(let bt=0;bt<14400;bt++){const G=E().G;if(G.phase!=='play')break;BOSS_BOT.B(E,G,bt,{dashAssist:DASHY.has(spec.id)});E().step()}
  const G=E().G,b=G.stats.tel.boss,tot=b.dmg.player+b.dmg.echo;
  return{clear:G.phase==='win'?1:0,time:G.bossT/60,taken:b.taken,dps:tot/Math.max(1,G.bossT/60),echoShare:tot?b.dmg.echo/tot:0,breaks:b.syncBreaks};
}
const res={};const t0=Date.now();
for(const s of specs){
  const sv=[],bs=[];for(let i=0;i<RUNS;i++){sv.push(runSurvive(s,20000+i));bs.push(runBoss(s,30000+i))}     // 모든 조건이 같은 seed 세트를 사용
  const wins=bs.filter(r=>r.clear);
  res[s.key]={spec:s,survival:avg(sv.map(r=>r.survived)),surviveTime:avg(sv.map(r=>r.time)),kills:avg(sv.map(r=>r.kills)),dps:avg(sv.map(r=>r.dps)),echoShareSurvive:avg(sv.map(r=>r.echoShare)),level:avg(sv.map(r=>r.level)),
    bossClear:avg(bs.map(r=>r.clear)),bossTime:wins.length?avg(wins.map(r=>r.time)):NaN,bossTimeAll:avg(bs.map(r=>r.time)),bossTaken:avg(bs.map(r=>r.taken)),bossDps:avg(bs.map(r=>r.dps)),echoShareBoss:avg(bs.map(r=>r.echoShare)),bossBreaks:avg(bs.map(r=>r.breaks)),wins:wins.length,runs:RUNS};
}
// ---- 이상치 판정 ----
const TH={dps:0.30,kills:0.30,bossTime:0.20,survival:0.20};                    // RELATIVE: 다른 업그레이드 평균 향상폭 대비
const ABS={dps:0.30,kills:0.40,survival:0.25,bossTime:0.25};                    // ABSOLUTE: 기준 빌드(BASE) 대비 (v2.6)
const base=res.BASE;
const gain=(r)=>({dps:r.dps/base.dps-1,kills:r.kills/base.kills-1,bossDps:r.bossDps/base.bossDps-1,survival:r.survival-base.survival,
  bossTime:(Number.isFinite(r.bossTime)&&Number.isFinite(base.bossTime))?1-r.bossTime/base.bossTime:NaN,bossTimeAll:1-r.bossTimeAll/base.bossTimeAll,clear:r.bossClear-base.bossClear});
const outliers=[];
for(const lvl of['@1','@max']){
  const keys=ups.map(u=>u.id+lvl);const g={};for(const k of keys)g[k]=gain(res[k]);
  for(const k of keys){
    const others=keys.filter(x=>x!==k);const ref=m=>avg(others.map(x=>g[x][m]).filter(Number.isFinite));
    const diff={dps:g[k].dps-ref('dps'),kills:g[k].kills-ref('kills'),bossTime:g[k].bossTime-ref('bossTime'),survival:g[k].survival-ref('survival')};
    const why=[],whyAbs=[];
    if(g[k].dps>=ABS.dps)whyAbs.push('DPS +'+(g[k].dps*100).toFixed(0)+'%');
    if(g[k].kills>=ABS.kills)whyAbs.push('처치량 +'+(g[k].kills*100).toFixed(0)+'%');
    if(g[k].survival>=ABS.survival)whyAbs.push('생존율 +'+(g[k].survival*100).toFixed(0)+'%p');
    if(Number.isFinite(g[k].bossTime)&&g[k].bossTime>=ABS.bossTime)whyAbs.push('보스 클리어 시간 -'+(g[k].bossTime*100).toFixed(0)+'%');
    if(diff.dps>=TH.dps)why.push('DPS +'+(diff.dps*100).toFixed(0)+'%p (다른 업그레이드 평균 대비)');
    if(diff.kills>=TH.kills)why.push('처치량 +'+(diff.kills*100).toFixed(0)+'%p');
    if(Number.isFinite(diff.bossTime)&&diff.bossTime>=TH.bossTime)why.push('보스 클리어 시간 -'+(diff.bossTime*100).toFixed(0)+'%p');
    if(diff.survival>=TH.survival)why.push('60초 생존율 +'+(diff.survival*100).toFixed(0)+'%p');
    res[k].gain=g[k];res[k].diffVsOthers=diff;res[k].outlier=why;res[k].absolute=whyAbs;
    if(why.length)outliers.push({key:k,why,kind:'RELATIVE'});
    if(whyAbs.length)outliers.push({key:k,why:whyAbs,kind:'ABSOLUTE'});
  }
}
const rep={runs:RUNS,thresholds:TH,elapsed:(Date.now()-t0)/1000,results:res,outliers};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','benchmark_report.json'),JSON.stringify(rep,null,1));
// ---- 마크다운 ----
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=x=>Number.isFinite(x)?(x*100).toFixed(0)+'%':'-',sg=x=>Number.isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(0)+'%':'-';
let md='# 업그레이드 벤치마크 (동일 seed '+RUNS+'회/조건, 조건당 일반 구간 '+RUNS+'판 + 보스 '+RUNS+'판)\n\n기준 빌드 = 업그레이드 없음. 일반 구간: sweeper 봇(사망 가능, 생존율이 낮은 편이라 생존율 기준은 보수적으로 작동 — 처치/DPS 기준이 주 지표). 보스: BOT B, 보스 단독.\n\n';
md+='| 조건 | 60초 생존 | 평균 생존시간 | 처치 | 총 DPS | ECHO 피해비율(일반) | 최종 LV | 보스 클리어 | 클리어 시간 | 받은 피해 | 보스 DPS | ECHO 피해비율(보스) | 판정 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const s of specs){const r=res[s.key];md+='| '+s.key+' | '+pc(r.survival)+' | '+f(r.surviveTime)+'s | '+f(r.kills)+' | '+f(r.dps,2)+' | '+pc(r.echoShareSurvive)+' | '+f(r.level)+' | '+pc(r.bossClear)+' | '+f(r.bossTime)+'s | '+f(r.bossTaken,2)+' | '+f(r.bossDps,2)+' | '+pc(r.echoShareBoss)+' | '+([(r.absolute&&r.absolute.length)?'**ABSOLUTE**':'',(r.outlier&&r.outlier.length)?'**RELATIVE**':''].filter(Boolean).join(' + '))+' |\n'}
md+='\n## 기준 빌드 대비 향상폭\n\n| 조건 | DPS | 처치 | 생존율(%p) | 보스 클리어율(%p) | 보스 클리어 시간 감소 | 보스 DPS |\n|---|---|---|---|---|---|---|\n';
for(const s of specs.slice(1)){const g=res[s.key].gain;md+='| '+s.key+' | '+sg(g.dps)+' | '+sg(g.kills)+' | '+sg(g.survival)+' | '+sg(g.clear)+' | '+sg(g.bossTime)+' | '+sg(g.bossDps)+' |\n'}
md+='\n## BALANCE OUTLIER 판정 (v2.6: ABSOLUTE / RELATIVE 분리)\n\n- ABSOLUTE = 기준 빌드(BASE) 대비 DPS +30% / 처치 +40% / 생존율 +25%p / 보스 클리어 시간 -25% 중 하나\n- RELATIVE = 다른 업그레이드 평균 향상폭 대비 DPS·처치 +30%p / 보스 시간 -20%p / 생존율 +20%p 중 하나 (상대 비교만으로 하향 판단하지 않음)\n\n'+
  (outliers.length?['ABSOLUTE','RELATIVE'].map(kind=>{const xs=outliers.filter(x=>x.kind===kind);return '**'+kind+'**\n'+(xs.length?xs.map(x=>'- `'+x.key+'`: '+x.why.join(' / ')).join('\n'):'- 해당 없음')}).join('\n\n'):'- 해당 없음')+'\n';
fs.writeFileSync(path.join(__dirname,'..','..','BENCHMARK_REPORT.md'),md);
console.log(md);console.log('경과',rep.elapsed.toFixed(1)+'s');
process.exit(0);
