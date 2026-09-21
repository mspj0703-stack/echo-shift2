/* ================= LOOP ================= */
let last=0,acc=0;
function frame(ts){
  if(!last)last=ts;
  acc+=Math.min(0.1,(ts-last)/1000);last=ts;
  if(G.phase==='levelup')acc=0;                  // 레벨업 선택 중엔 시간/연출 모두 정지
  while(acc>=DT){
    if(G.freeze>0)G.freeze-=DT;else step();
    stepFx();
    acc-=DT;
  }
  render();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{last=0});
requestAnimationFrame(frame);

// 디버그/테스트 훅
window.__ES2={get G(){return G},CFG,input,keys,mouse,startGame,step:()=>{if(G.phase==='levelup')return;if(G.freeze>0)G.freeze=0;step();stepFx()},render,hitEnemy,gainXp,chooseUpgrade,openLevelUp,UPGRADES,slash,dashDamage,makeEnemy,pickType,spawnEnemy,XP_VALUE,
  // v2.3 보스/자동 테스트 훅
  BOSS,SYN,ELITE,ELITE_INFO,makeElite,rollElite,eliteStatus,eliteCount,debugSpawnElite,nextEchoHitOn,echoTargetHits,onEliteReal,applyExtra,startBossIntro,debugStartBoss,hitBoss,bossDanger,patHits,syncStatus,nextEchoBossHit,echoBossHits,rollChoices,B,
  // v2.6 런 구조 훅
  RUN,phaseOf,runSec,healPlayer,startShift,updateRun};
