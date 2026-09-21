// v2.3 보스(PARADOX CORE) + v2.2 후속 수정 테스트 (요청 목록 1~17 + 추가)
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const PI=Math.PI,TAU=PI*2;
const idle=(x,y,n=240)=>Array.from({length:n},()=>({x,y,a:0,atk:false,dash:false}));
const echoObj=(id,clip,x,y)=>({id,clip,i:0,loop:0,x,y,a:0,dashing:false,dashAng:0,dashHit:new Set(),r:11});
function fight(opts){
  opts=opts||{};const o=load({record:opts.record});const E=o.E;
  E().debugStartBoss({});const G=E().G;E().BOSS.speed=0;          // 기본: 정지한 보스, 패턴 없음 (필요한 테스트만 켠다)
  G.spawnT=1e9;G.p.hp=1e6;G.p.x=480;G.p.y=540;G.p.inv=0;
  const b=G.boss;b.x=480;b.y=200;b.gap=1e9;
  return{...o,G,b};
}
const hit=(o,src,dmg)=>o.E().hitBoss(o.b,dmg||1,src,0);
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-9);

// ---- 0. v2.2 후속 수정 ----
{const o=load();o.E().startGame();const G=o.E().G;G.spawnT=1e9;
 const mk=(ty,x)=>{const e=o.E().makeEnemy(ty,x,10);e.spawn=0;return e};
 G.enemies=[];for(let i=0;i<8;i++)G.enemies.push(mk('shooter',10+i*20));
 let bad=0;for(let i=0;i<400;i++)if(o.E().pickType(50)==='shooter')bad++;
 t(bad===0,'0a. SHOOTER 상한 8: 8기면 더 뽑히지 않음');
 G.enemies.pop();let got=0;for(let i=0;i<600;i++)if(o.E().pickType(50)==='shooter')got++;
 t(got>0,'0b. SHOOTER 7기면 아직 뽑힘 (상한은 8, 완전 제거 아님)');
 t(o.E().CFG.caps.shooter===8&&o.E().CFG.caps.warden===3&&o.E().CFG.caps.phase===5&&o.E().RUN.phases.map(p=>p.max).join()==='20,26,30','0c. 종류별 상한 8/3/5 유지, 전체 상한은 구간별 20/26/30 (v2.6)');}
{const mkH=(o,hx,hy)=>{const G=o.E().G;const h=o.E().makeEnemy('phase',hx,hy);h.spawn=0;h.face=0;G.enemies=[h];return h};
 const fresh=()=>{const o=load();o.E().startGame();const G=o.E().G;G.spawnT=1e9;G.enemies=[];G.echoes=[];G.p.x=480;G.p.y=300;return o};
 let o=fresh(),h=mkH(o,100,300);o.E().G.echoes=[echoObj(1,idle(100,50),100,50)];steps(o.E,20);   // 거리 250 → ECHO 추적
 t(h.tgt&&h.tgt.id===1&&h.y<290,'0d. ECHO가 320px 안이면 ECHO 추적 (거리 250)');
 o=fresh();h=mkH(o,100,300);o.E().G.echoes=[echoObj(1,idle(700,300),700,300)];steps(o.E,20);      // 거리 600 → 플레이어 추적
 t(h.tgt===null&&h.x>100+30&&Math.abs(h.y-300)<1,'0e. ECHO가 320px 밖이면 플레이어 추적 (거리 600)');
 o=fresh();h=mkH(o,100,300);o.E().G.echoes=[echoObj(1,idle(100,-10+300-330+10),100,-30)];steps(o.E,5);   // 대략 330~ 밖
 const e2={x:100,y:300-330};o.E().G.echoes=[echoObj(2,idle(e2.x,e2.y),e2.x,e2.y)];h.x=100;h.y=300;steps(o.E,2);
 t(h.tgt===null,'0f. 경계(330px) 바깥은 플레이어 추적');
 // 범위를 넘나들 때 전환
 o=fresh();h=mkH(o,300,300);o.E().G.p.x=900;o.E().G.p.y=300;
 const far=echoObj(3,idle(300,300+400),300,700);o.E().G.echoes=[far];steps(o.E,1);const a=h.tgt===null;
 far.clip=idle(300,300+250);steps(o.E,2);const b2=h.tgt&&h.tgt.id===3;
 t(a&&b2,'0g. 범위 밖→안으로 들어오면 ECHO로 전환');
 t(true,'   (충돌 규칙: 기존 v2.2 테스트 unit_enemies에서 검증 — 자신 피해1/기절0.9초/쿨다운1.5초/ECHO 무피해)');}

// ---- 1~3. 일반 구간(300초) 종료 후 흐름 ----
{const o=load();const E=o.E;E().startGame();const G=E().G;G.p.hp=1e6;
 let maxNormal=0;for(let i=0;i<3599;i++){if(G.phase==='levelup')E().chooseUpgrade(0);E().step();maxNormal=Math.max(maxNormal,G.enemies.length)}
 t(G.stage!=='intro'&&G.stage!=='boss'&&maxNormal>0,'1a. 일반 구간 동안 스폰 진행 (적 최대 '+maxNormal+')');
 G.runT=299.9*60;G.phaseIdx=2;                      // v2.6: 300초 직전으로 이동
 G.shots.push({x:100,y:100,vx:1,vy:0,r:5,life:3});
 const spawnT=G.spawnT;
 while(G.stage!=='intro'){if(G.phase==='levelup')E().chooseUpgrade(0);E().step()}
 t(G.stage==='intro','1b. 300초 도달 → 보스 등장 연출(intro)');
 t(G.enemies.length===1&&G.enemies[0].type==='boss','2a. 남은 일반 적 전부 제거 (적 목록 = 보스 1기)');
 t(G.shots.length===0,'2b. 적 투사체 전부 제거');
 const st0=G.spawnT;for(let i=0;i<600;i++){if(G.phase==='levelup')E().chooseUpgrade(0);E().step()}
 t(G.enemies.every(e=>e.type==='boss')&&G.spawnT===st0,'1c. 보스전 중 일반 스폰 완전 중단 (600틱 동안 일반 적 0, 스폰 타이머 정지)');
 const b=G.boss;t(b.hp>0&&b.maxHp===E().BOSS.hp&&b.type==='boss','3a. 보스 정상 생성 (HP '+b.maxHp+')');
 t(G.stage==='boss'&&G.bossT>0,'3b. 등장 연출 후 보스전 시작');}
{const o=load();const E=o.E;E().startGame();const G=E().G;G.p.hp=1e6;G.spawnT=1e9;
 G.enemies=Array.from({length:6},(_,i)=>{const e=E().makeEnemy('chaser',50+i*30,50);e.spawn=0;return e});G.shots=[{x:1,y:1,vx:0,vy:0,r:5,life:3}];
 G.runT=300*60-1;G.phaseIdx=2;E().step();
 t(G.stage==='intro'&&G.enemies.length===1&&G.enemies[0].type==='boss'&&G.shots.length===0,'2c. 정확히 300초(18000틱)째에 정리+보스 생성');
 const b=G.boss;const r=E().hitBoss(b,5,'player',0);t(r===false&&b.hp===b.maxHp,'3c. 등장 연출 중 보스는 피해를 받지 않음');
 let n=0;while(G.stage==='intro'&&n<500){E().step();n++}t(n===179||n===180,'3d. 등장 연출 3초 ('+n+'틱)');
 t(G.stats.tel.boss.hits.player===0,'   (연출 중 타격은 집계되지 않음)');}

// ---- 4. SYNC SHIELD 피해 감소 ----
{const o=fight();hit(o,'player',1);t(near(o.b.hp,o.b.maxHp-0.2),'4a. 방패: 플레이어 피해 1 → 0.2 (HP '+o.b.hp.toFixed(2)+')');
 hit(o,'echo',1);t(near(o.b.hp,o.b.maxHp-0.4),'4b. 방패: ECHO 피해도 동일하게 80% 감소');
 const o2=fight();hit(o2,'player',5);t(near(o2.b.hp,o2.b.maxHp-1),'4c. 큰 피해도 80% 감소 (5 → 1)');}

// ---- 5~8. SYNC BREAK 조건 ----
{const o=fight();for(let i=0;i<30;i++){hit(o,'player',1);steps(o.E,7)}
 t(o.b.breaks===0&&o.b.shield,'5. PLAYER 단독으로는 아무리 때려도 방패가 깨지지 않음 (30회, 210틱)');
 const o2=fight();for(let i=0;i<30;i++){hit(o2,'echo',1);steps(o2.E,7)}
 t(o2.b.breaks===0&&o2.b.shield,'6. ECHO 단독으로도 방패가 깨지지 않음');}
{let o=fight();hit(o,'player');steps(o.E,60);hit(o,'echo');t(o.b.breaks===1&&!o.b.shield,'7a. PLAYER → 60틱 뒤 ECHO → SYNC BREAK');
 o=fight();hit(o,'echo');steps(o.E,60);hit(o,'player');t(o.b.breaks===1&&!o.b.shield,'7b. ECHO → 60틱 뒤 PLAYER → SYNC BREAK (순서 무관)');
 o=fight();hit(o,'player');steps(o.E,75);hit(o,'echo');t(o.b.breaks===1,'7c. 경계: 정확히 75틱(1.25초) 차이 → 성립');
 o=fight();hit(o,'player');steps(o.E,76);hit(o,'echo');t(o.b.breaks===0,'8a. 76틱 차이 → 성립하지 않음 (시간 초과)');
 o=fight();hit(o,'player');steps(o.E,40);hit(o,'player');steps(o.E,40);hit(o,'echo');t(o.b.breaks===1,'7d. PLAYER 재타격으로 창이 갱신되면 그 시점부터 1.25초 (40+40틱)');}
// 실제 공격 경로: 플레이어 slash + ECHO slash
{const o=fight();const{E,G,b}=o;G.p.x=480;G.p.y=270;E().input.aimAngle=-PI/2;E().input.atk=true;
 const clip=idle(400,200);clip[30].atk=true;clip[30].a=0;G.echoes=[echoObj(1,clip,400,200)];
 steps(E,30);const before=b.breaks;steps(E,1);
 t(before===0&&b.breaks===1&&G.stats.tel.boss.hits.player>=1&&G.stats.tel.boss.hits.echo===1,'7e. 실제 플레이어 slash + ECHO 재생 공격(31틱째) → SYNC BREAK');}
{const o=fight();const{E,G,b}=o;G.p.x=480;G.p.y=270;E().input.aimAngle=-PI/2;E().input.atk=true;steps(E,230);   // 첫 ECHO가 생기는 240틱 이전
 t(b.breaks===0&&G.stats.tel.boss.hits.player>=10,'5b. 실제 플레이어 연속 공격만으로는 깨지지 않음 (타격 '+G.stats.tel.boss.hits.player+', ECHO 생성 전)');}
// 8. 상태 표시 초기화
{const o=fight();const{E,b}=o;const S0=E().syncStatus(b).text;hit(o,'player');const S1=E().syncStatus(b).text;steps(E,74);const S2=E().syncStatus(b).text;steps(E,2);const S3=E().syncStatus(b).text;
 t(S0==='SYNC SHIELD'&&S1==='PLAYER ✓ / ECHO ○'&&S2==='PLAYER ✓ / ECHO ○'&&S3==='SYNC SHIELD','8b. UI: SYNC SHIELD → PLAYER ✓ / ECHO ○ → (1.25초 후) 초기화 ['+[S0,S1,S3]+']');
 hit(o,'echo');t(E().syncStatus(b).text==='PLAYER ○ / ECHO ✓','8c. ECHO가 먼저 맞으면 PLAYER ○ / ECHO ✓');}

// ---- 9~11. VULNERABLE / 재생 / 보호 ----
{const o=fight();const{E,b}=o;hit(o,'player');hit(o,'echo');
 t(!b.shield&&b.vuln===300&&b.stagger===36&&E().syncStatus(b).text.startsWith('VULNERABLE'),'9a. SYNC BREAK → VULNERABLE 5초(300틱) + 경직 0.6초(36틱)');
 const hp0=b.hp;hit(o,'player');t(near(hp0-b.hp,1),'9b. 취약 중 피해 감소 없음 (1 → 1)');
 let n=0;while(!b.shield&&n<1000){E().step();n++}
 t(n===300,'9c. VULNERABLE 정확히 5.00초 (300틱, 실제 '+n+')');
 t(b.shield&&b.protect===90&&b.lastHit.player<0,'10. 취약 종료 후 방패 재생 + 보호 시간 1.5초(90틱) 시작');
 hit(o,'player');hit(o,'echo');t(b.breaks===1&&b.shield&&E().syncStatus(b).kind==='protect','11a. 보호 시간 중 PLAYER+ECHO → SYNC BREAK 발생하지 않음');
 steps(E,88);hit(o,'player');hit(o,'echo');t(b.breaks===1,'11b. 보호 89틱째까지 여전히 무효');
 steps(E,2);t(b.protect===0,'11c. 90틱째 보호 해제');
 hit(o,'player');hit(o,'echo');t(b.breaks===2,'11d. 보호 해제 후에는 다시 SYNC BREAK 가능');}
{const o=fight();hit(o,'player');hit(o,'echo');const s=o.b;
 // 경직 0.6초 동안은 이동/패턴 정지, 취약은 계속 흐름
 o.E().BOSS.speed=100;o.b.gap=1;const x0=s.x;const py=o.G.p.y;steps(o.E,30);t(s.x===x0&&s.pat===null,'9d. 경직(0.6초) 동안 이동/패턴 정지');
 steps(o.E,10);t(s.stagger===0,'9e. 36틱 후 경직 해제 (실제 '+s.stagger+')');}

// ---- 12. 세 패턴 예고/발동 ----
{const o=fight();const{E,G,b}=o;E().BOSS.speed=0;b.gap=60;G.p.x=100;G.p.y=560;
 const rec=[];let prev=null,cur=null;
 for(let i=0;i<1600&&rec.length<7;i++){
   E().step();
   const pat=b.pat;
   if(pat!==prev){
     if(prev&&cur){cur.end=i}
     if(pat){cur={kind:pat.kind,start:i,tele:0,active:0,zoneDmg:0};rec.push(cur)}else cur=null;
     prev=pat;
   }
   if(pat&&cur){if(pat.ph==='tele')cur.tele++;else cur.active++}
 }
 const kinds=rec.map(r=>r.kind).join();
 t(kinds.startsWith('pulse,line,zone,pulse,line,zone'),'12a. 패턴 순환: RADIAL PULSE → MEMORY LINE → PARADOX ZONE 반복 ['+kinds+']');
 t(rec[0].tele===54,'12b. RADIAL PULSE 예고 0.9초(54틱) ('+rec[0].tele+')');
 t(rec[1].tele===48,'12c. MEMORY LINE 예고 0.8초(48틱) ('+rec[1].tele+')');
 t(rec[2].tele===60&&rec[2].active===180,'12d. PARADOX ZONE 예고 1초(60틱) + 유지 3초(180틱) ('+rec[2].tele+'/'+rec[2].active+')');
 const gaps=[];for(let i=1;i<rec.length;i++)gaps.push(rec[i].start-rec[i-1].end);
 t(gaps.every(g=>g>=100&&g<=110),'12e. 패턴 사이 간격 약 1.75초 ('+gaps+'틱), 패턴이 겹치지 않음');}
// 12f. 간격 15% 감소 (HP 50% 이하), 예고 시간은 그대로
{const E0=()=>load().E();const _E=load();const E0f=()=>_E.E();
 const run=(hp)=>{const o=fight();const{E,G,b}=o;b.hp=hp;b.gap=1;G.p.x=100;G.p.y=560;let start=-1,end=-1,prev=null,tele=0;let i=0;
   for(;i<1200;i++){E().step();const pat=b.pat;if(pat&&start<0)start=i;if(pat&&pat.kind==='pulse'&&pat.ph==='tele')tele++;if(!pat&&prev&&end<0){end=i;break}prev=pat}
   return{gap:b.gap,tele}};
 const HPB=_E.E().BOSS.hp;const hi=run(0.6*HPB),lo=run(0.4*HPB);
 t(hi.gap===105&&lo.gap===89,'12f. HP 50% 이하: 패턴 간격 105 → 89틱 (약 15% 감소) ['+hi.gap+' → '+lo.gap+']');
 t(hi.tele===lo.tele,'12g. 예고 시간은 HP와 무관하게 동일 ('+hi.tele+'='+lo.tele+')');}

// ---- 13. 위험 영역 = 실제 피해 영역 ----
function sampleDamage(kind,make,indep){
  const o=fight();const{E,G,b}=o;const N=kind==='line'?900:240;let mism=0,inside=0;
  b.x=40;b.y=40;                                    // 접촉 피해가 섞이지 않게 구석에 둔다
  for(let i=0;i<N;i++){
    const x=60+Math.random()*840,y=90+Math.random()*470;
    if(Math.hypot(x-b.x,y-b.y)<80)continue;
    const pat=make(b);b.pat=pat;pat.t=1;G.p.x=x;G.p.y=y;G.p.inv=0;G.p.kx=0;G.p.ky=0;const hp0=G.p.hp;
    if(pat.kind==='zone'){pat.ph='active';pat.t=100;pat.tick=1}
    E().step();
    const hurt=G.p.hp<hp0;
    const pred=indep(pat,x,y);
    if(pred)inside++;
    if(hurt!==pred)mism++;
    b.pat=null;
  }
  return{mism,inside};
}
{const cx=520,cy=300;
 let r=sampleDamage('pulse',b=>({kind:'pulse',ph:'tele',t:54,cx,cy,r:150}),(pat,x,y)=>Math.hypot(x-cx,y-cy)<=150);
 t(r.mism===0&&r.inside>10,'13a. RADIAL PULSE: 반경 150 안에서만 피해 (불일치 '+r.mism+', 안쪽 샘플 '+r.inside+')');
 const ox=300,oy=200,ang=0.6,dx=Math.cos(ang),dy=Math.sin(ang);
 r=sampleDamage('line',b=>({kind:'line',ph:'tele',t:48,ox,oy,dx,dy,w:44,tx:0,ty:0}),(pat,x,y)=>{const rx=x-ox,ry=y-oy;return rx*dx+ry*dy>=0&&Math.abs(rx*dy-ry*dx)<=22});
 t(r.mism===0&&r.inside>10,'13b. MEMORY LINE: 선(폭 44) 위에서만 피해 (불일치 '+r.mism+', 선 위 샘플 '+r.inside+')');
 const zones=[{x:200,y:200,r:70},{x:520,y:380,r:70},{x:760,y:180,r:70}];
 r=sampleDamage('zone',b=>({kind:'zone',ph:'tele',t:60,zones,tick:0}),(pat,x,y)=>zones.some(z=>Math.hypot(x-z.x,y-z.y)<=z.r));
 t(r.mism===0&&r.inside>10,'13c. PARADOX ZONE: 원 3곳 안에서만 피해 (불일치 '+r.mism+', 안쪽 샘플 '+r.inside+')');}
// 13d. 화면에 그려지는 도형 = 판정 도형 (캔버스 호출 기록으로 확인)
{const o=fight({record:true});const{E,G,b,calls}=o;
 const draw=()=>{calls.length=0;E().render();return calls.slice()};
 b.pat={kind:'pulse',ph:'tele',t:30,cx:500,cy:310,r:150};let c=draw();
 t(c.some(x=>x[0]==='arc'&&x[1]===500&&x[2]===310&&x[3]===150),'13d. PULSE: 그려지는 원 = (중심, 반경 150)');
 b.pat={kind:'line',ph:'tele',t:30,ox:300,oy:200,dx:Math.cos(.6),dy:Math.sin(.6),w:44,tx:10,ty:10};c=draw();
 t(c.some(x=>x[0]==='fillRect'&&x[1]===0&&x[2]===-22&&x[3]===1700&&x[4]===44)&&c.some(x=>x[0]==='rotate'&&Math.abs(x[1]-.6)<1e-9),'13e. LINE: 그려지는 띠 = (폭 44, 방향 일치)');
 b.pat={kind:'zone',ph:'tele',t:30,zones:[{x:200,y:200,r:70},{x:520,y:380,r:70},{x:760,y:180,r:70}],tick:0};c=draw();
 t([[200,200],[520,380],[760,180]].every(([x,y])=>c.some(k=>k[0]==='arc'&&k[1]===x&&k[2]===y&&k[3]===70)),'13f. ZONE: 그려지는 원 3개 = 판정 원 (반경 70)');}
// 13g. 존 판정 주기 (0.5초마다, 피격 무적 정상 적용)
{const o=fight();const{E,G,b}=o;G.p.x=300;G.p.y=300;b.x=40;b.y=40;
 b.pat={kind:'zone',ph:'active',t:180,zones:[{x:300,y:300,r:70},{x:600,y:300,r:70},{x:800,y:500,r:70}],tick:30};
 const hp0=G.p.hp;let hits=[];let last=hp0;for(let i=1;i<=180;i++){E().step();if(G.p.hp<last){hits.push(i);last=G.p.hp}}
 t(hits[0]===30&&hits.length>=3&&hits.length<=4&&hp0-G.p.hp===hits.length,'13g. ZONE: 30틱마다 판정, 피격 무적(0.9초)으로 서 있으면 약 1.5초마다 피해 (피격 틱 '+hits+')');}
// 13h. PULSE 넉백(바깥쪽), MEMORY LINE 방향 = 1.5초(90틱) 전 위치
{const o=fight();const{E,G,b}=o;b.x=40;b.y=40;G.p.x=560;G.p.y=300;G.p.inv=0;b.pat={kind:'pulse',ph:'tele',t:1,cx:500,cy:300,r:150};E().step();
 const kx0=G.p.kx;steps(E,3);t(kx0>100&&Math.abs(G.p.ky)<1&&G.p.x>560,'13h. PULSE 넉백은 중심에서 바깥쪽 (kx '+kx0.toFixed(0)+', x '+G.p.x.toFixed(0)+')');}
{const o=fight();const{E,G,b}=o;b.x=300;b.y=100;b.gap=1;G.p.x=700;G.p.y=500;
 G.posHist=Array.from({length:150},(_,i)=>({x:100+i,y:200}));b.patIdx=1;       // 다음 패턴 = line
 E().step();
 const expected=G.posHist[G.posHist.length-90];
 t(b.pat&&b.pat.kind==='line'&&Math.abs(b.pat.tx-expected.x)<2&&Math.abs(b.pat.ty-expected.y)<2,'13i. MEMORY LINE 목표 = 약 1.5초(90틱) 전 플레이어 위치 ('+(b.pat&&[b.pat.tx.toFixed(0),b.pat.ty.toFixed(0)])+')');}
// ECHO는 보스 패턴에 피해를 받지 않음 (상태 변화 없음)
{const o=fight();const{E,G,b}=o;const ec=echoObj(1,idle(500,300),500,300);G.echoes=[ec];b.x=40;b.y=40;b.pat={kind:'pulse',ph:'tele',t:1,cx:500,cy:300,r:150};G.p.x=900;G.p.y=580;E().step();
 t(G.echoes.length===1&&ec.loop===0&&G.p.hp===1e6,'13j. ECHO는 보스 패턴 영향 없음 (플레이어만 판정)');}

// ---- 14. 레벨업 일시정지 중 보스 완전 정지 ----
{const o=fight({speed:55});const{E,G,b}=o;E().BOSS.speed=55;b.gap=20;G.p.x=200;G.p.y=500;for(let i=0;i<200&&!(b.pat&&b.pat.t>20&&b.pat.t<40);i++)E().step();
 const snap=()=>JSON.stringify([G.t,G.bossT,b.clock,b.x,b.y,b.gap,b.pat&&b.pat.t,b.pat&&b.pat.kind,b.vuln,b.protect,b.stagger,b.hp,G.p.hp,G.posHist.length,G.fx.map(f=>f.t)]);
 G.exp.pending=1;E().openLevelUp();t(G.phase==='levelup'&&b.pat!==null,'14a. 보스 패턴 진행 중 레벨업 선택창');
 const s0=snap();steps(E,400);t(snap()===s0,'14b. step 400회에도 보스/패턴/타이머/이펙트 전부 정지');

 const done=()=>{E().chooseUpgrade(0);const t0=G.bossT;steps(E,20);return G.bossT===t0+20};
 t(done(),'14c. 선택 후 보스 진행 재개');}
// 14d. 실제 rAF 루프 (비동기)
(async()=>{
 const o=fight();const{E,G,b}=o;E().BOSS.speed=55;b.gap=20;G.p.x=200;G.p.y=500;steps(E,60);
 G.exp.pending=1;E().openLevelUp();const s0=JSON.stringify([G.t,G.bossT,b.x,b.y,b.pat&&b.pat.t,b.vuln]);
 await new Promise(r=>setTimeout(r,400));
 ok(S,JSON.stringify([G.t,G.bossT,b.x,b.y,b.pat&&b.pat.t,b.vuln])===s0,'14d. 실제 rAF 루프 400ms 동안에도 보스 정지');S.total;
 finishAsync();
})();

// ---- 15. 공격 소스 구분 ----
function runSrc(mode){
  const o=fight();const{E,G,b}=o;const bt=G.stats.tel.boss;
  if(mode==='player-slash'){G.p.x=480;G.p.y=270;E().input.aimAngle=-PI/2;E().input.atk=true;steps(E,2)}
  if(mode==='echo-slash'){const c=idle(400,200);c[0].atk=true;c[0].a=0;G.echoes=[echoObj(1,c,400,200)];steps(E,2)}
  if(mode==='player-dash'){G.p.x=480;G.p.y=350;E().input.aimAngle=-PI/2;E().input.dash=true;steps(E,20)}
  if(mode==='echo-dash'){const c=idle(480,330);for(let i=1;i<=10;i++)c[i]={x:480,y:330-i*14,a:-PI/2,atk:false,dash:true};for(let i=11;i<240;i++)c[i]={x:480,y:190,a:0,atk:false,dash:false};G.echoes=[echoObj(1,c,480,330)];steps(E,16)}
  return{p:bt.hits.player,e:bt.hits.echo};
}
{const a=runSrc('player-slash'),b2=runSrc('echo-slash'),c=runSrc('player-dash'),d=runSrc('echo-dash');
 t(a.p>=1&&a.e===0,'15a. 플레이어 slash → 소스 PLAYER ('+JSON.stringify(a)+')');
 t(b2.e===1&&b2.p===0,'15b. ECHO 재생 slash → 소스 ECHO ('+JSON.stringify(b2)+')');
 t(c.p===1&&c.e===0,'15c. 플레이어 대시 → 소스 PLAYER, 1회 ('+JSON.stringify(c)+')');
 t(d.e===1&&d.p===0,'15d. ECHO 재생 대시 → 소스 ECHO, 1회 ('+JSON.stringify(d)+')');}
// 15e. 대시 + ECHO 공격도 SYNC BREAK 성립
{const o=fight();const{E,G,b}=o;G.p.x=480;G.p.y=350;E().input.aimAngle=-PI/2;E().input.dash=true;
 const c=idle(400,200);c[6].atk=true;c[6].a=0;G.echoes=[echoObj(1,c,400,200)];steps(E,20);
 t(b.breaks===1,'15e. 플레이어 대시 + ECHO 공격 → SYNC BREAK (대시도 해당 소스의 공격)');}

// ---- 16. 보스 사망 후 종료 ----
{const o=fight();const{E,G,b}=o;b.shield=false;b.vuln=300;b.hp=0.5;const xp0=G.exp.xp,lv0=G.exp.level;
 hit(o,'player',1);t(b.dead&&b.hp===0,'16a. 보스 HP 0 → 사망 처리');
 E().step();t(G.phase==='win','16b. 사망 다음 틱에 게임 종료(승리)');
 steps(E,30);for(let i=0;i<5;i++)E().render();
 t(G.phase==='win'&&o.errs.length===0&&G.exp.xp===xp0&&G.exp.level===lv0,'16c. 종료 후 크래시 없음, 보스 처치 XP 없음');
 t(o.doc.getElementById('endTitle').textContent.includes('PARADOX CORE'),'16d. 결과 문구 (PARADOX CORE 격파)');}
{const o=fight();const{E,G,b}=o;G.p.hp=1;G.p.x=b.x;G.p.y=b.y+40;G.p.inv=0;steps(E,2);
 t(G.phase==='dead'&&o.doc.getElementById('endTitle').textContent.includes('보스전'),'16e. 보스전 중 플레이어 사망 → 종료 (접촉 피해 포함)');}
// 접촉 피해 1 + 무적
{const o=fight();const{E,G,b}=o;G.p.x=b.x;G.p.y=b.y+40;G.p.inv=0;const hp0=G.p.hp;steps(E,2);const hp1=G.p.hp;steps(E,20);
 t(hp0-hp1===1&&G.p.hp===hp1,'   보스 접촉 피해 1, 이후 피격 무적 동안 추가 피해 없음');}

// ---- ECHO 타격 예측 정확도 ----
{const o=fight();const{E,G,b}=o;const c=idle(400,200);c[100].atk=true;c[100].a=0;G.echoes=[echoObj(1,c,400,200)];
 const n=E().nextEchoBossHit(240);t(n&&n.ticks===101,'   ECHO 타격 예측: 101틱 뒤로 표시 ('+(n&&n.ticks)+')');
 steps(E,100);const before=G.stats.tel.boss.hits.echo;steps(E,1);t(before===0&&G.stats.tel.boss.hits.echo===1,'   예측한 틱(101)에 실제 ECHO 타격 발생');
 const o2=fight();o2.G.echoes=[echoObj(1,(()=>{const q=idle(100,500);q[50].atk=true;return q})(),100,500)];
 t(o2.E().nextEchoBossHit(240)===null,'   보스에 닿지 않는 ECHO 공격은 예측에서 제외');}

// ---- UI 문구/렌더 커버리지 (캔버스 fillText 기록) ----
{const o=fight({record:true});const{E,G,b,calls}=o;const texts=()=>{calls.length=0;E().render();return calls.filter(c=>c[0]==='fillText').map(c=>String(c[1]))};
 let x=texts();t(x.includes('PARADOX CORE')&&x.includes('SYNC SHIELD')&&x.some(s=>/^\d+ \/ \d+$/.test(s)),'UI-1. 보스 이름/HP 바 수치/SYNC SHIELD 표시');
 const echoClip=idle(400,200);echoClip[60].atk=true;G.echoes=[echoObj(1,echoClip,400,200)];x=texts();
 t(x.some(s=>s.startsWith('ECHO 타격까지')),'UI-2. ECHO 타격 예정 시간 표시 ("ECHO 타격까지 x.x초")')&&t(x.some(s=>/^\d\.\ds$/.test(s)),'UI-3. ECHO 타격 예정 지점 옆 남은 시간 라벨');
 hit(o,'player');x=texts();t(x.includes('PLAYER ✓ / ECHO ○'),'UI-4. PLAYER ✓ / ECHO ○ 표시');
 b.lastHit={player:-9999,echo:-9999};hit(o,'echo');x=texts();t(x.includes('PLAYER ○ / ECHO ✓'),'UI-5. PLAYER ○ / ECHO ✓ 표시');
 hit(o,'player');x=texts();t(x.includes('SYNC BREAK')&&x.some(s=>s.startsWith('VULNERABLE — ')),'UI-6. SYNC BREAK 연출 문구 + VULNERABLE — X.Xs');
 steps(E,300);x=texts();t(x.some(s=>s.startsWith('SYNC SHIELD — 안정화')),'UI-7. 방패 재생 후 안정화(보호) 표시');
 t(o.errs.length===0,'UI-8. 모든 보스 상태 렌더 중 예외 없음');}
{const o=load({record:true});const E=o.E;E().startGame();const G=E().G;G.p.hp=1e6;G.spawnT=1e9;G.runT=300*60-1;G.phaseIdx=2;E().step();o.calls.length=0;for(let i=0;i<60;i++)E().step();E().render();
 t(o.calls.some(c=>c[0]==='fillText'&&c[1]==='PARADOX CORE')&&o.errs.length===0,'UI-9. 등장 연출 중 PARADOX CORE 문구, 예외 없음');}

let finished=false;function finishAsync(){if(finished)return;finished=true;const okAll=summary(S,'unit_boss');process.exit(okAll?0:1)}
