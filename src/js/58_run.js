/* ================= RUN 구조 (PHASE 1~3 + 전환 + 보스 진입) ================= */
// 런 타이머 G.runT는 '일반 전투가 실제로 진행된 시간'만 센다 — 구간 전환(4초) 동안은 멈춘다.
// 전환: 신규 스폰 중지 · 적 투사체 제거 · 기존 적 유지 · HP 2 회복(최대 초과 불가).
function healPlayer(n){
  const p=G.p,before=p.hp;p.hp=Math.min(CFG.pHp,p.hp+n);
  const got=p.hp-before;
  if(got>0){G.stats.tel.run.heal+=got;G.fx.push({k:'ring',x:p.x,y:p.y,t:0,life:.5,c:'#7cf5b0',r:44});addPart(p.x,p.y,'#7cf5b0',12,150);sfx('level')}
  return got;
}
function startShift(ph){
  G.stage='shift';G.shiftT=RUN.shiftT;G.shots=[];
  const before=G.p.hp,got=healPlayer(RUN.heal);
  G.stats.tel.run.phaseEnd.push({phase:ph.id-1,t:runSec(),hpBefore:before,hpAfter:G.p.hp,level:G.exp.level,enemies:G.enemies.length,elites:G.enemies.filter(e=>e.elite&&e.hp>0).length});
  G.notice={text:'PHASE '+ph.id+' — '+ph.name,c:ph.id===3?'#ff7ad0':'#ffd54a',t:0};
  G.bossMsg={text:'PHASE '+ph.id+' — '+ph.name,t:0};
  G.shake=Math.max(G.shake,5);sfx('warn');
}
function updateRun(){
  if(G.stage==='shift'){
    G.shiftT--;                                    // 전환 중에는 runT가 멈춘다 (적은 계속 움직이고 피해도 정상)
    if(G.shiftT<=0){G.stage='survive';G.spawnT=Math.min(G.spawnT,0.6)}
    return;
  }
  if(G.stage!=='survive')return;
  G.runT++;
  const sec=runSec();
  if(G.runT>=GAME_TICKS){                          // 300초 → PARADOX CORE
    const before=G.p.hp;healPlayer(RUN.heal);
    G.stats.tel.run.bossEntry={t:sec,hpBefore:before,hpAfter:G.p.hp,level:G.exp.level,stacks:{...G.build.stacks}};
    startBossIntro();return;
  }
  const idx=RUN.phases.indexOf(phaseOf(sec));
  if(idx>G.phaseIdx){G.phaseIdx=idx;startShift(RUN.phases[idx])}
  const lv=G.stats.tel.run.levelAt;                // 구간 경계 레벨 기록
  for(const m of [90,210,300])if(!lv[m]&&sec>=m-0.02&&sec<=m+0.02)lv[m]=G.exp.level;
}
