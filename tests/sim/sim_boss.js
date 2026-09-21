// 보스 자동 시뮬레이션: BOT A/B/C × (보스 단독 / 전체 런) — 통계, 상태 오류 검사, 업그레이드 분석
// 사용: node sim/sim_boss.js [N=기본 100] [FULL=기본 50]   →  결과 JSON: tests/sim/out/boss_report.json
const fs=require('fs'),path=require('path');
const {load}=require('../harness');const {SURVIVE,BOSS_BOT,pickRandom}=require('../bots');
const N=+(process.argv[2]||process.env.N||200),FULL=+(process.argv[3]||process.env.FULL||100);
const MAX_BOSS_TICKS=+(process.env.MAX_BOSS_TICKS||14400);      // 보스전 최대 4분 (초과 = 미클리어)
const o=load();const E=o.E,errs=o.errs;
const problems=[];const chk=(cond,msg)=>{if(!cond&&problems.length<50)problems.push(msg)};
const fin=(...a)=>a.every(Number.isFinite);
let ticksTotal=0;
function invariants(G,tag){
  const b=G.boss;
  if(!fin(G.p.x,G.p.y,G.p.hp,G.exp.xp))chk(false,tag+' NaN 플레이어');
  for(const e of G.enemies)if(!fin(e.x,e.y,e.hp))chk(false,tag+' NaN 적');
  if(b){
    if(!fin(b.x,b.y,b.hp,b.clock,b.vuln,b.protect,b.stagger))chk(false,tag+' NaN 보스');
    chk(b.hp>=0&&b.hp<=b.maxHp,tag+' 보스 HP 범위 '+b.hp);
    chk(b.shield?b.vuln===0:b.vuln>0,tag+' 방패/취약 상태 꼬임');
    chk(b.stagger>=0&&b.protect>=0&&b.vuln>=0,tag+' 음수 타이머');
    chk(!(b.shield===false&&b.protect>0),tag+' 취약 중 보호시간');
    chk(G.enemies.filter(e=>e.type==='boss').length<=1,tag+' 보스 중복');
    if(G.stage==='boss')chk(G.enemies.every(e=>e.type==='boss'),tag+' 보스전 중 일반 적 존재');
    chk(!b.elite&&!G.fx.some(f=>f.elite)&&G.enemies.every(e=>!e.elite),tag+' 보스전 중 ELITE 상태/이펙트 잔존');
  }
}
function runOne(botKind,mode,picks,seed){
  o.setSeed(seed);E().startGame();let G=E().G;const mem={};let t=0;
  if(mode==='boss'){
    E().debugStartBoss({picks});G=E().G;G.p.hp=E().CFG.pHp;G.spawnT=1e9;
  }else{                                        // 전체 런: 일반 구간 60초를 무적으로 진행해 레벨/빌드를 쌓은 뒤 300초 지점으로 건너뛰어 보스 진입 (v2.6)
    G.p.hp=1e9;
    for(;t<3600&&G.stage==='survive';t++){
      if(G.phase==='levelup'){pickRandom(E,G,o.rand);t--;continue}
      SURVIVE.sweeper(E,G,t);E().step();ticksTotal++;
      if(t%200===0)invariants(E().G,'survive');
    }
    G=E().G;
    if(G.stage==='survive'){G.runT=300*60-1;G.phaseIdx=2;E().step()}     // 300초 → 보스 전환
    for(let g=0;g<200&&G.stage==='intro';g++)E().step();
    G=E().G;G.p.hp=E().CFG.pHp;
  }
  let bt=0;
  for(;bt<MAX_BOSS_TICKS;bt++){
    G=E().G;
    if(G.phase==='dead'||G.phase==='win')break;
    if(G.phase==='levelup'){pickRandom(E,G,o.rand);bt--;continue}
    BOSS_BOT[botKind](E,G,bt,mem);
    E().step();ticksTotal++;
    if(bt%30===0)invariants(E().G,'boss');
    if(bt%300===0)E().render();
  }
  G=E().G;invariants(G,'end');
  const bs=G.stats.tel.boss,tot=bs.dmg.player+bs.dmg.echo;
  return{win:G.phase==='win',dead:G.phase==='dead',timeout:G.phase==='play',t:G.bossT/60,taken:bs.taken,breaks:bs.syncBreaks,level:G.exp.level,
    echoShare:tot>0?bs.dmg.echo/tot:0,hitsP:bs.hits.player,hitsE:bs.hits.echo,stacks:{...G.build.stacks},
    vulnDmg:bs.vulnDmg,shieldDmg:bs.shieldDmg,takenBy:{...bs.takenBy},syncWait:bs.syncWaitN?bs.syncWait/bs.syncWaitN/60:NaN};
}
const results={boss:{A:[],B:[],C:[]},full:{A:[],B:[],C:[]}};
const t0=Date.now();
for(const kind of['A','B','C']){
  for(let i=0;i<N;i++)results.boss[kind].push(runOne(kind,'boss',4+(i%3),1000+i));   // 같은 seed를 A/B/C가 공유   // 업그레이드 4~6개(평균 LV 약 6)
  for(let i=0;i<FULL;i++)results.full[kind].push(runOne(kind,'full',0,5000+i));
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
function summarize(arr){
  const wins=arr.filter(r=>r.win);
  return{n:arr.length,clear:wins.length/arr.length,dead:arr.filter(r=>r.dead).length/arr.length,timeout:arr.filter(r=>r.timeout).length/arr.length,
    timeWin:avg(wins.map(r=>r.t)),timeAll:avg(arr.map(r=>r.t)),taken:avg(arr.map(r=>r.taken)),breaks:avg(arr.map(r=>r.breaks)),level:avg(arr.map(r=>r.level)),
    echoShare:avg(arr.map(r=>r.echoShare)),hitsE:avg(arr.map(r=>r.hitsE)),hitsP:avg(arr.map(r=>r.hitsP)),
    vulnDmg:avg(arr.map(r=>r.vulnDmg)),shieldDmg:avg(arr.map(r=>r.shieldDmg)),syncWait:avg(arr.map(r=>r.syncWait).filter(Number.isFinite)),
    takenBy:Object.fromEntries(['contact','pulse','line','zone'].map(k=>[k,avg(arr.map(r=>r.takenBy[k]||0))]))};
}
const rep={config:{N,FULL,MAX_BOSS_TICKS},boss:{},full:{},problems,exceptions:errs.length,elapsed:(Date.now()-t0)/1000,ticks:ticksTotal};
for(const k of['A','B','C']){rep.boss[k]=summarize(results.boss[k]);rep.full[k]=summarize(results.full[k])}
// 업그레이드 분석 (모든 봇·모든 판 합산, 사용/미사용 비교)
const all=[...['A','B','C'].flatMap(k=>results.boss[k]),...['A','B','C'].flatMap(k=>results.full[k])];
const ids=new Set();for(const r of all)for(const id of Object.keys(r.stacks))ids.add(id);
rep.upgrades={};
const baseClear=all.filter(r=>r.win).length/all.length,baseTime=avg(all.filter(r=>r.win).map(r=>r.t));
for(const id of ids){
  const w=all.filter(r=>(r.stacks[id]||0)>0),wo=all.filter(r=>!(r.stacks[id]||0));
  const cw=w.filter(r=>r.win),cwo=wo.filter(r=>r.win);
  rep.upgrades[id]={picked:w.length,pickRate:w.length/all.length,clearWith:w.length?cw.length/w.length:NaN,clearWithout:wo.length?cwo.length/wo.length:NaN,timeWith:avg(cw.map(r=>r.t)),timeWithout:avg(cwo.map(r=>r.t)),takenWith:avg(w.map(r=>r.taken)),takenWithout:avg(wo.map(r=>r.taken))};
}
rep.baseline={clear:baseClear,time:baseTime,n:all.length};
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out','boss_report.json'),JSON.stringify(rep,null,1));
const f=(x,d)=>Number.isFinite(x)?x.toFixed(d===undefined?1:d):'-';
for(const mode of['boss','full']){
  console.log('\n== '+(mode==='boss'?'보스 단독 (업그레이드 4~6개 고정)':'전체 런 (일반 구간 60초 진행 후 300초 지점으로 건너뛰어 보스)')+'  [클리어율 / 평균 클리어시간 / 평균 받은 피해 / SYNC BREAK / 평균 LV / ECHO 피해비율]');
  for(const k of['A','B','C']){const s=rep[mode][k];console.log(' BOT '+k+' n='+s.n+' 클리어 '+f(s.clear*100,0)+'% (사망 '+f(s.dead*100,0)+'%, 시간초과 '+f(s.timeout*100,0)+'%) | 시간 '+f(s.timeWin)+'s | 피해 '+f(s.taken,2)+' | SYNC '+f(s.breaks)+' | LV '+f(s.level)+' | ECHO '+f(s.echoShare*100,0)+'% | SYNC 대기 '+f(s.syncWait,2)+'s | 취약 중 피해 '+f(s.vulnDmg,0)+' / 방패 중 '+f(s.shieldDmg,0)+' | 피해원 접촉 '+f(s.takenBy.contact,2)+' 펄스 '+f(s.takenBy.pulse,2)+' 선 '+f(s.takenBy.line,2)+' 존 '+f(s.takenBy.zone,2))}
}
console.log('\n상태/수치 문제:',problems.length,'개, 예외',errs.length,'개, 총 틱',ticksTotal,'경과',f(rep.elapsed)+'s');
if(problems.length)console.log(problems.slice(0,10));
process.exit(0);
