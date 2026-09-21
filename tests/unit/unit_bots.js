// 봇 무결성: BOT A는 ECHO/SYNC 타이밍 정보를 절대 쓰지 않고, 접촉 피해가 이전(v2.3, 4.52)보다 크게 줄었는지, A/B/C가 같은 회피 코드를 쓰는지
const {load,steps,ok,summary}=require('../harness');const bots=require('../bots');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const FORBID=['nextEchoBossHit','echoBossHits','echoes','lastHit','syncStatus','echoHitsBoss','.clip'];
// 1) 정적 검사: A가 호출하는 모든 공용 함수의 소스에 ECHO/SYNC 참조가 없어야 한다
const shared=[bots.BOSS_BOT.A,bots.evade,bots.pickDir,bots.inDanger];
const src=shared.map(f=>f.toString()).join('\n');
t(FORBID.every(k=>!src.includes(k)),'A + 공용 회피 코드에 ECHO/SYNC 참조 없음 ('+FORBID.join(', ')+')');
t(!bots.BOSS_BOT.A.toString().includes('.clock'),'A는 보스 SYNC 타이머(clock)도 사용하지 않음');
t(['A','B','C'].every(k=>/evade\(E,G,wx,wy\)/.test(bots.BOSS_BOT[k].toString())),'A/B/C 모두 동일한 공용 회피 함수(evade) 사용');
t(bots.BOSS_BOT.B.toString().includes('nextEchoBossHit'),'(대조) B는 nextEchoBossHit 사용');
// 2) 동적 검사: 실제로 플레이시키며 ECHO 예측 API 호출 횟수를 센다
function run(kind,seed){
  const o=load({seed});const E=o.E;E().debugStartBoss({picks:5});const G0=E().G;G0.p.hp=6;G0.spawnT=1e9;
  const calls={next:0,hits:0};
  const n0=E().nextEchoBossHit,h0=E().echoBossHits;
  E().nextEchoBossHit=(...a)=>{calls.next++;return n0(...a)};E().echoBossHits=(...a)=>{calls.hits++;return h0(...a)};
  for(let bt=0;bt<14400;bt++){const G=E().G;if(G.phase!=='play')break;bots.BOSS_BOT[kind](E,G,bt,{});E().step()}
  const G=E().G,tb=G.stats.tel.boss;return{calls,contact:tb.takenBy.contact||0,win:G.phase==='win'};
}
{let ca=0,cb=0,contact=0,n=40;for(let i=0;i<n;i++){const a=run('A',i);ca+=a.calls.next+a.calls.hits;contact+=a.contact;cb+=run('B',i).calls.next}
 t(ca===0,'동적: A 40판 동안 ECHO 예측 API 호출 0회 (B는 '+cb+'회로 대조)');t(cb>0,'(스파이 정상 동작: B 호출 >0)');
 const avg=contact/n;t(avg<2.26,'A 접촉 피해 평균 '+avg.toFixed(2)+' (v2.3: 4.52 → 절반 미만)');}
process.exit(summary(S,'unit_bots')?0:1);
