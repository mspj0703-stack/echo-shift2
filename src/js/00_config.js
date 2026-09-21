const CFG={
  W:960,H:600,
  pSpeed:250,pR:11,pHp:6,invSec:0.9,
  atkCd:0.30,atkRange:70,atkArc:Math.PI*0.75,atkKnock:170,atkDmg:1,
  dashDur:0.16,dashSpeed:850,dashCd:1.0,dashDmg:1,
  echoTicks:240,echoLoops:3,echoMax:3,xpFirst:30,xpGrowth:1.4,          // 4초 구간을 3번 반복(총 12초) 후 소멸
  gameSec:300,                                                         // v2.6: 한 판 = 일반 구간 300초 + PARADOX CORE
  maxEnemies:30,caps:{shooter:8,phase:5,warden:3},
  chaser:{hp:2,speed:88,r:11},
  shooter:{hp:2,speed:62,r:12,cd:3.0,wind:0.7,shotSpeed:210,shotR:5},
  phase:{hp:3,speed:105,r:12,collideR:22,collideCd:1.5,stun:0.9,track:320},      // PHASE HUNTER: ECHO를 쫓고, ECHO에 닿으면 자폭성 충돌(피해 1 + 기절)
  warden:{hp:5,speed:54,r:15,turn:Math.PI,shield:Math.PI/3}            // WARDEN: 전면 ±60° 방패, 회전 180°/초 (v2.6.1: 이동 62→54, 정체성은 방패·위치 선정)
};
// 보스: PARADOX CORE (시간 값은 전부 '틱', 60틱 = 1초)
const BOSS={
  hp:180,speed:55,r:34,shieldMul:0.2,                // v2.6.1: 150 → 180 (5분 빌드 완성 상태에서도 마지막 시험 역할)                // HP: 기획 초기값 60 → 150 (60이면 어떤 봇이든 ~11초에 끝나 ECHO 활용 차이가 통계에 안 나타남)
  syncT:75,staggerT:36,vulnT:300,protectT:90,        // SYNC 창 1.25초 / 경직 0.6초 / 취약 5초 / 재생 후 보호 1.5초
  introT:180,gapT:105,fastMul:0.85,                  // 등장 연출 3초 (v2.6) / 패턴 간격 1.75초 (HP 50% 이하 x0.85)
  pulse:{teleT:54,radius:150,knock:520},             // RADIAL PULSE: 예고 0.9초, 반경 150
  line:{teleT:48,width:44,backT:90},                 // MEMORY LINE: 예고 0.8초, 1.5초(90틱) 전 위치 기준
  zone:{teleT:60,activeT:180,tickT:30,count:3,radius:70}  // PARADOX ZONE: 예고 1초, 3초 유지, 0.5초마다 판정
};
// v2.6 RUN 구조: 3구간 + 구간 전환(스폰 정지 · 투사체 제거 · 런 타이머 정지 · HP 회복)
const RUN={
  shiftT:240,heal:2,                                                   // 전환 4초 / 회복 HP 2 (최대 HP 초과 불가)
  phases:[
    {id:1,name:'INITIALIZATION',from:0,to:90,max:20,spawn:[1.7,1.15],double:0},
    {id:2,name:'DESYNC',from:90,to:210,max:26,spawn:[1.55,1.10],double:0.09},     // 초기 작업값 1.3→0.9에서 +12% (자동 시뮬 결과 반영)
    {id:3,name:'COLLAPSE',from:210,to:300,max:30,spawn:[1.25,0.95],double:0.22}   // 1.0→0.78에서 +14% / double = 한 번에 2기 생성 확률
  ]
};
const DT=1/60,W=CFG.W,H=CFG.H,GAME_TICKS=CFG.gameSec*60;
const TAU=Math.PI*2;

