// 현실적인 빌드 벤치마크: 레벨업 ~5회 기준 ATTACK / ECHO / DASH / HYBRID (+ RANDOM 기준선)
//  · 일반 구간(60초, 사망 가능한 sweeper 봇) + PARADOX CORE(BOT B, 5회 선택한 빌드로 보스 단독) 각각 RUNS판, 조건 간 동일 seed 세트
//  · 자동 판정: BUILD DOMINANCE (다른 빌드 평균 대비 DPS +25% / 처치 +25% / 생존율 +20%p / 보스 클리어 시간 20%↓ 중 3개 이상), 성격(성공 기준) 체크
// 사용: node sim/build_benchmark.js [RUNS=200]   → tests/sim/out/build_report.json, BUILD_REPORT.md
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const {SURVIVE,BOSS_BOT,BUILDS,pickByBuild}=require('../bots');
const RUNS=+(process.argv[2]||process.env.RUNS||200);
const o=load();const E=o.E;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const sum=obj=>Object.values(obj||{}).reduce((a,b)=>a+b,0);
const names=['ATTACK','ECHO','DASH','HYBRID','RANDOM'];
function shares(dmg){                       // dmg = {player:{kind:v}, echo:{kind:v}}
  const pl=sum(dmg.player),ec=sum(dmg.echo),tot=pl+ec||1;
  const kind=k=>(dmg.player[k]||0)+(dmg.echo[k]||0);
  const syn=kind('resonance')+kind('mark');
  return{tot:pl+ec,player:pl/tot,echo:ec/tot,dashTrail:(kind('dash')+kind('trail'))/tot,synergy:syn/tot,basicPlayer:dmg.player.basic||0};
}
function runSurvive(name,seed){
  const bd=BUILDS[name];o.setSeed(seed);E().startGame();
  for(let t=0;t<3700;t++){
    const G=E().G;if(G.phase==='dead'||G.stage!=='survive')break;
    if(G.phase==='levelup'){E().chooseUpgrade(pickByBuild(G.levelChoices,name,o.rand));t--;continue}
    SURVIVE.sweeper(E,G,t,{dashAssist:bd.dashAssist});E().step();
    if(t%240===0)E().render();
  }
  const G=E().G,tel=G.stats.tel,el=Math.max(1,G.t/60),s=shares(tel.dmg);
  return{survived:G.stage!=='survive'?1:0,time:Math.min(60,G.t/60),kills:G.stats.kills,dps:s.tot/el,directDps:s.basicPlayer/el,echoKillShare:G.stats.kills?G.stats.echo/G.stats.kills:0,
    player:s.player,echo:s.echo,dashTrail:s.dashTrail,synergy:s.synergy,level:G.exp.level,resPerMin:tel.syn.resonance/el*60,markPerMin:tel.syn.mark/el*60,trailHits:tel.syn.trailHits,fbSaved:tel.syn.fbSaved};
}
function runBoss(name,seed){
  const bd=BUILDS[name];o.setSeed(seed);E().debugStartBoss({picks:0});
  for(let i=0;i<5;i++){const ch=E().rollChoices();if(!ch.length)break;const u=ch[pickByBuild(ch,name,o.rand)];u.apply(E().B());E().B().stacks[u.id]=(E().B().stacks[u.id]||0)+1;E().G.exp.level++}
  E().G.p.hp=E().CFG.pHp;E().G.spawnT=1e9;const mem={dashAssist:bd.dashAssist};
  for(let bt=0;bt<14400;bt++){const G=E().G;if(G.phase!=='play')break;BOSS_BOT.B(E,G,bt,mem);E().step();if(bt%300===0)E().render()}
  const G=E().G,b=G.stats.tel.boss,s=shares(G.stats.tel.dmgBoss),el=Math.max(1,G.bossT/60);
  return{clear:G.phase==='win'?1:0,time:G.bossT/60,taken:b.taken,breaks:b.syncBreaks,player:s.player,echo:s.echo,dashTrail:s.dashTrail,synergy:s.synergy,dps:s.tot/el,res:G.stats.tel.syn.resonance,mark:G.stats.tel.syn.mark};
}
const res={};const t0=Date.now();
for(const n of names){
  const sv=[],bs=[];for(let i=0;i<RUNS;i++){sv.push(runSurvive(n,40000+i));bs.push(runBoss(n,50000+i))}
  const wins=bs.filter(r=>r.clear),m=k=>avg(sv.map(r=>r[k])),bm=k=>avg(bs.map(r=>r[k]));
  res[n]={runs:RUNS,
    survive:{survival:m('survived'),time:m('time'),kills:m('kills'),dps:m('dps'),directDps:m('directDps'),player:m('player'),echo:m('echo'),dashTrail:m('dashTrail'),synergy:m('synergy'),level:m('level'),resPerMin:m('resPerMin'),markPerMin:m('markPerMin'),trailHits:m('trailHits'),fbSaved:m('fbSaved'),echoKillShare:m('echoKillShare')},
    boss:{clear:bm('clear'),time:wins.length?avg(wins.map(r=>r.time)):NaN,taken:bm('taken'),breaks:bm('breaks'),player:bm('player'),echo:bm('echo'),dashTrail:bm('dashTrail'),synergy:bm('synergy'),dps:bm('dps'),res:bm('res'),mark:bm('mark'),wins:wins.length}};
}
// ---- BUILD DOMINANCE ----
const core=['ATTACK','ECHO','DASH','HYBRID'];
const dominance={};
for(const n of core){
  const others=core.filter(x=>x!==n),ref=f=>avg(others.map(x=>f(res[x])));
  const g={dps:res[n].survive.dps/ref(r=>r.survive.dps)-1,kills:res[n].survive.kills/ref(r=>r.survive.kills)-1,survival:res[n].survive.survival-ref(r=>r.survive.survival),
    bossTime:1-res[n].boss.time/ref(r=>r.boss.time)};
  const hits=[g.dps>=0.25,g.kills>=0.25,g.survival>=0.20,Number.isFinite(g.bossTime)&&g.bossTime>=0.20];
  dominance[n]={gains:g,hits:hits.filter(Boolean).length,dominant:hits.filter(Boolean).length>=3};
}
// ---- 성격(성공 기준) 체크 ----
const argmax=(f)=>core.reduce((b,n)=>f(res[n])>f(res[b])?n:b,core[0]);
const character=[];
const chk=(name,pass,detail)=>character.push({name,pass,detail});
const bestDirect=argmax(r=>r.survive.directDps);chk('ATTACK: 직접 공격(PLAYER 기본 공격) DPS 최고',bestDirect==='ATTACK',core.map(n=>n+' '+res[n].survive.directDps.toFixed(2)).join(' / '));
const bestEcho=argmax(r=>(r.survive.echo+r.boss.echo)/2);chk('ECHO: ECHO 피해 비율 최고 (일반+보스 평균)',bestEcho==='ECHO',core.map(n=>n+' '+(((res[n].survive.echo+res[n].boss.echo)/2)*100).toFixed(0)+'%').join(' / '));
const bestDash=argmax(r=>r.survive.dashTrail);const dashOthersTime=avg(['ATTACK','ECHO','HYBRID'].map(n=>res[n].survive.time)),dashOthersTaken=avg(['ATTACK','ECHO','HYBRID'].map(n=>res[n].boss.taken));
chk('DASH: DASH·TRAIL 피해 비율 최고',bestDash==='DASH',core.map(n=>n+' '+(res[n].survive.dashTrail*100).toFixed(0)+'%').join(' / '));
chk('DASH: 생존성(평균 생존시간 또는 보스 받은 피해)이 다른 빌드 평균보다 우수',res.DASH.survive.time>=dashOthersTime||res.DASH.boss.taken<=dashOthersTaken,'생존시간 '+res.DASH.survive.time.toFixed(1)+'s (타 평균 '+dashOthersTime.toFixed(1)+'s), 보스 받은 피해 '+res.DASH.boss.taken.toFixed(2)+' (타 평균 '+dashOthersTaken.toFixed(2)+')');
const bestTrig=argmax(r=>r.survive.resPerMin+r.survive.markPerMin);chk('HYBRID: RESONANCE/PHASE MARK 발동 빈도 최고 (일반, 분당)',bestTrig==='HYBRID',core.map(n=>n+' '+(res[n].survive.resPerMin+res[n].survive.markPerMin).toFixed(1)).join(' / '));
const bestSyn=argmax(r=>(r.survive.synergy+r.boss.synergy)/2);chk('HYBRID: 시너지 피해 비율(ECHO 활용 보상) 최고',bestSyn==='HYBRID',core.map(n=>n+' '+(((res[n].survive.synergy+res[n].boss.synergy)/2)*100).toFixed(0)+'%').join(' / '));
// 한 빌드가 세 영역(일반 전투/생존/보스) 모두 압도?
const rank=(f,hi)=>core.slice().sort((a,b)=>hi?f(res[b])-f(res[a]):f(res[a])-f(res[b]));
const areas={'일반 전투(DPS)':rank(r=>r.survive.dps,true)[0],'생존(60초 생존율)':rank(r=>r.survive.survival,true)[0],'보스(클리어 시간)':rank(r=>r.boss.time,false)[0]};
const overwhelm=core.filter(n=>Object.values(areas).every(x=>x===n));
const rep={runs:RUNS,elapsed:(Date.now()-t0)/1000,results:res,dominance,character,areas,overwhelm,exceptions:o.errs.length};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','build_report.json'),JSON.stringify(rep,null,1));
// ---- BUILD_REPORT.md ----
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-',pc=x=>Number.isFinite(x)?(x*100).toFixed(0)+'%':'-',sg=x=>Number.isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(0)+'%':'-';
let md='# BUILD REPORT (v2.4) — 빌드별 벤치마크\n\n빌드당 일반 구간 '+RUNS+'판 + PARADOX CORE '+RUNS+'판, 조건 간 동일 seed 세트. 레벨업 약 5회 기준(일반 구간은 실제 레벨업 진행, 보스는 5회 선택 후 시작).\n\n'
 +'우선순위: ATTACK = SHARP EDGE > RAPID CUT > LONG REACH (남는 선택은 공격 계열) / ECHO = ECHO POWER > DEEP RECORD > RESONANCE / DASH = PHASE TRAIL > PHASE DRIVE > IMPACT > PHASE MARK / HYBRID = RESONANCE > PHASE MARK > FEEDBACK LOOP > ECHO POWER > PHASE TRAIL / RANDOM = 기준선(무작위 선택, 판정 제외).\n'
 +'봇: 일반 구간 sweeper(사망 가능), 보스 BOT B. 모든 빌드가 동일한 봇 조건(쿨이 돌면 적/보스 쪽으로 공격 대시 사용)으로 플레이하므로 차이는 업그레이드 선택에서만 나온다.\n\n## 일반 구간 (60초)\n\n'
 +'| 빌드 | 60초 생존 | 평균 생존시간 | 처치 | 총 DPS | 직접 공격 DPS | PLAYER 피해 | ECHO 피해 | DASH·TRAIL 피해 | 시너지 피해 | RESONANCE/분 | MARK/분 | 최종 LV |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const n of names){const s=res[n].survive;md+='| '+n+' | '+pc(s.survival)+' | '+f(s.time)+'s | '+f(s.kills)+' | '+f(s.dps,2)+' | '+f(s.directDps,2)+' | '+pc(s.player)+' | '+pc(s.echo)+' | '+pc(s.dashTrail)+' | '+pc(s.synergy)+' | '+f(s.resPerMin)+' | '+f(s.markPerMin)+' | '+f(s.level)+' |\n'}
md+='\n(PLAYER+ECHO 피해 비율 합 = 100%. DASH·TRAIL은 두 주체의 대시/트레일 피해를 합친 값이고 PLAYER/ECHO 비율과 겹친다. 시너지 = RESONANCE+PHASE MARK 추가 피해.)\n\n## PARADOX CORE\n\n| 빌드 | 클리어율 | 클리어 시간 | 받은 피해 | SYNC BREAK | PLAYER 피해 | ECHO 피해 | 시너지 피해 | 보스 DPS | RESONANCE | MARK |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const n of names){const s=res[n].boss;md+='| '+n+' | '+pc(s.clear)+' | '+f(s.time)+'s | '+f(s.taken,2)+' | '+f(s.breaks)+' | '+pc(s.player)+' | '+pc(s.echo)+' | '+pc(s.synergy)+' | '+f(s.dps,2)+' | '+f(s.res)+' | '+f(s.mark)+' |\n'}
md+='\n(보스 피해 비율: PLAYER + ECHO + 시너지 = 100%. PLAYER/ECHO는 시너지 추가 피해를 제외한 기본/대시/트레일 피해.)\n\n## BUILD DOMINANCE 판정\n\n기준: 다른 3개 빌드 평균 대비 총 DPS +25% / 처치량 +25% / 생존율 +20%p / 보스 클리어 시간 20% 단축 중 3개 이상 동시 만족.\n\n| 빌드 | DPS | 처치 | 생존율(%p) | 보스 시간 단축 | 충족 수 | 판정 |\n|---|---|---|---|---|---|---|\n';
for(const n of core){const d=dominance[n];md+='| '+n+' | '+sg(d.gains.dps)+' | '+sg(d.gains.kills)+' | '+sg(d.gains.survival)+' | '+sg(d.gains.bossTime)+' | '+d.hits+' | '+(d.dominant?'**BUILD DOMINANCE**':'-')+' |\n'}
md+='\n영역별 1위: '+Object.entries(areas).map(([k,v])=>k+' → '+v).join(' / ')+'\n\n세 영역 모두 1위인 빌드: '+(overwhelm.length?'**'+overwhelm.join(', ')+'** (압도 여부는 위 표의 격차로 판단)':'없음')+'\n\n## 빌드 성격 체크 (성공 기준)\n\n'+character.map(c=>'- '+(c.pass?'✅':'❌')+' '+c.name+' — '+c.detail).join('\n')+'\n';
fs.writeFileSync(path.join(__dirname,'..','..','BUILD_REPORT.md'),md);
console.log(md);console.log('예외',o.errs.length,'경과',rep.elapsed.toFixed(1)+'s');
process.exit(o.errs.length?1:0);
