// v2.6 RUN 구조 단위 테스트: 3구간 / 구간 전환 / HP 회복 / 300초 보스 전환 / 새 런 초기화
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-9);
function fresh(){const o=load({seed:3});const E=o.E;E().startGame();const G=E().G;G.spawnT=1e9;G.p.hp=1e6;return{...o,G}}
const setRun=(o,sec)=>{o.G.runT=Math.round(sec*60);o.G.phaseIdx=o.E().RUN.phases.findIndex(p=>sec>=p.from&&sec<p.to)};
// 1. 구간 정의
{const o=fresh();const R=o.E().RUN;
 t(R.phases.length===3&&R.phases[0].to===90&&R.phases[1].from===90&&R.phases[1].to===210&&R.phases[2].to===300,'구간 3개: 0~90 / 90~210 / 210~300초');
 t(o.E().CFG.gameSec===300,'일반 구간 300초');
 t(R.shiftT===240&&R.heal===2,'구간 전환 4초 · HP 회복 2');
 t(o.E().BOSS.introT===180,'보스 등장 연출 3초');}
// 2. 90초 / 210초 전환
{const o=fresh();const{E,G}=o;setRun(o,89.9);G.shots.push({x:10,y:10,vx:0,vy:0,r:5,life:3});
 const e=E().makeEnemy('chaser',300,300);e.spawn=0;G.enemies=[e];
 const hp0=G.p.hp=3;
 while(G.stage==='survive'&&G.runT<90*60+5)E().step();
 t(G.stage==='shift','90초 → 구간 전환 시작');
 t(G.shots.length===0,'전환: 적 투사체 제거');
 t(G.enemies.length===1&&G.enemies[0]===e,'전환: 기존 일반 적은 유지');
 t(G.p.hp===hp0+2,'전환: HP +2 회복 ('+hp0+' → '+G.p.hp+')');
 const r0=G.runT,sp=G.spawnT;steps(E,200);
 t(G.runT===r0,'전환 중 런 타이머 정지 (200틱)');
 t(G.enemies.length===1,'전환 중 신규 스폰 없음');
 let n=0;while(G.stage==='shift'&&n<400){E().step();n++}
 t(n===40&&G.stage==='survive','전환 총 4초(240틱) 후 재개 (남은 '+n+'틱)');
 const r1=G.runT;steps(E,60);t(G.runT===r1+60,'재개 후 런 타이머 정상 진행');}
{const o=fresh();const{E,G}=o;G.p.hp=6;setRun(o,89.9);
 while(G.stage==='survive')E().step();
 t(G.p.hp===6,'회복은 최대 HP를 넘지 않는다 (6 → 6)');}
{const o=fresh();const{E,G}=o;setRun(o,209.9);G.p.hp=2;
 while(G.stage==='survive'&&G.runT<210*60+5)E().step();
 t(G.stage==='shift'&&G.p.hp===4,'210초 → PHASE 3 전환 + 회복');
 t(G.phaseIdx===2,'구간 인덱스 갱신');}
// 3. 300초 → 보스
{const o=fresh();const{E,G}=o;setRun(o,299.9);G.p.hp=3;
 const e=E().makeEnemy('chaser',300,300);e.spawn=0;E().makeElite?0:0;G.enemies=[e];
 const el=E().debugSpawnElite('lock','shooter',400,200);
 G.shots.push({x:10,y:10,vx:0,vy:0,r:5,life:3});
 while(G.stage==='survive')E().step();
 t(G.stage==='intro','300초 → 보스 등장');
 t(G.p.hp===5,'보스 진입 시 HP +2 회복 (3 → '+G.p.hp+')');
 t(G.enemies.length===1&&G.enemies[0].type==='boss','일반 적/ELITE 전부 제거 (보스만)');
 t(G.shots.length===0,'적 투사체 제거');
 t(!G.fx.some(f=>f.elite),'ELITE 이펙트 제거');
 t(G.stats.tel.run.bossEntry&&G.stats.tel.run.bossEntry.level===G.exp.level,'보스 진입 상태 기록(레벨/HP)');
 let n=0;while(G.stage==='intro'&&n<400){E().step();n++}
 t(n===179||n===180,'등장 연출 3초(180틱) ('+n+')');
 const lv=G.exp.level,st=JSON.stringify(G.build.stacks);
 t(G.stage==='boss'&&G.exp.level===lv&&JSON.stringify(G.build.stacks)===st,'보스전에서 레벨/업그레이드 유지');}
// 4. 스폰 규칙 (구간별 상한 / ELITE 등장 규칙)
{const o=fresh();const{E,G}=o;
 const cap=s=>{setRun(o,s);return E().RUN.phases.find(p=>s>=p.from&&s<p.to).max};
 t(cap(30)===20&&cap(150)===26&&cap(250)===30,'구간별 전체 적 상한 20 / 26 / 30');
 t(E().CFG.caps.shooter===8&&E().CFG.caps.warden===3&&E().CFG.caps.phase===5,'종류별 상한 유지 (SHOOTER 8 · WARDEN 3 · PHASE HUNTER 5)');
 const bands=E().ELITE.bands;
 t(bands[0].from===45&&bands[0].max===1&&bands[1].max===2&&bands[2].max===3,'ELITE: 45초부터 등장, 동시 최대 1 / 2 / 3');
 let elite=0;setRun(o,20);G.noElite=false;
 for(let i=0;i<300;i++){const e=E().makeEnemy('chaser',10,10);if(E().rollElite(e,20))elite++}
 t(elite===0,'45초 이전에는 ELITE 없음 (300회 시도)');
 let got=0;for(let i=0;i<400;i++){const e=E().makeEnemy('chaser',10,10);if(E().rollElite(e,60))got++;G.enemies=[]}
 t(got>0,'45초 이후에는 ELITE 등장 (400회 중 '+got+'회)');}
// 5. 레벨업 정지 중 런 타이머/전환 정지
{const o=fresh();const{E,G}=o;setRun(o,50);
 G.exp.pending=1;E().openLevelUp();
 const snap=JSON.stringify([G.runT,G.stage,G.shiftT,G.t]);steps(E,300);
 t(G.phase==='levelup'&&JSON.stringify([G.runT,G.stage,G.shiftT,G.t])===snap,'레벨업 정지 중 런 타이머/전환 완전 정지 (300틱)');
 E().chooseUpgrade(0);steps(E,30);t(G.runT>50*60,'선택 후 정상 재개');}
{const o=fresh();const{E,G}=o;setRun(o,89.9);while(G.stage==='survive')E().step();
 G.exp.pending=1;E().openLevelUp();const s0=G.shiftT;steps(E,120);
 t(G.shiftT===s0,'전환 중 레벨업이 뜨면 전환 타이머도 정지');}
// 6. 새 런 초기화
{const o=fresh();const{E,G}=o;setRun(o,250);G.p.hp=1;E().chooseUpgrade;
 E().startGame();const N=E().G;
 t(N.runT===0&&N.phaseIdx===0&&N.stage==='survive'&&N.shiftT===0,'새 런: 런 타이머/구간/전환 초기화');
 t(N.p.hp===E().CFG.pHp&&N.exp.level===1&&Object.keys(N.build.stacks).length===0&&N.boss===null&&N.death===null,'새 런: HP/레벨/업그레이드/보스/사망 기록 초기화');
 t(N.stats.tel.run.heal===0&&N.stats.tel.run.phaseEnd.length===0&&N.enemies.length===0&&N.echoes.length===0,'새 런: 텔레메트리/적/ECHO 초기화');}
// 7. 사망 기록 (DEATH REPORT 입력)
{const o=fresh();const{E,G}=o;setRun(o,150);G.p.hp=1;G.p.inv=0;
 const e=E().makeEnemy('chaser',G.p.x,G.p.y);e.spawn=0;G.enemies=[e];
 steps(E,3);
 t(G.phase==='dead'&&G.death&&G.death.phase===2,'사망 시 구간(PHASE 2) 기록');
 t(G.death.src==='chaser'&&G.death.kind==='contact'&&G.death.level===G.exp.level,'사망 원인 적/피해 종류/레벨 기록 ('+G.death.src+'/'+G.death.kind+')');
 t(Number.isFinite(G.death.t)&&G.death.enemies>=1,'사망 시각/당시 적 수 기록');}
// 8. 결과 화면
{const o=fresh();const{E,G}=o;setRun(o,120);G.p.hp=1;G.p.inv=0;
 const e=E().makeEnemy('chaser',G.p.x,G.p.y);e.spawn=0;e.touchCd=0;G.enemies=[e];let n=0;while(G.phase==='play'&&n<200){E().step();n++}
 const title=o.doc.getElementById('endTitle').textContent,stat=o.doc.getElementById('endStat').innerHTML;
 t(/PHASE/.test(title)&&/생존/.test(title),'결과: 생존 시간 + 구간 표시');
 t(/최종 <em>LV/.test(stat)&&/총 처치/.test(stat)&&/PLAYER/.test(stat)&&/ECHO/.test(stat)&&/DASH·TRAIL/.test(stat)&&/시너지/.test(stat),'결과: 레벨/처치/피해 구성 표시');
 t(/업그레이드 —/.test(stat)&&/PARADOX CORE/.test(stat),'결과: 업그레이드 목록 + 보스 결과 표시');
 t(!!o.doc.getElementById('btnRetry'),'RESTART 버튼 존재');}
process.exit(summary(S,'unit_run')?0:1);
