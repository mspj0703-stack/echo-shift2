const {JSDOM}=require('jsdom');const fs=require('fs');
const html=require('fs').readFileSync(process.env.ES_HTML||require('path').join(__dirname,'..','..','dist','echo_shift_2_6_1.html'),'utf8');
function load(){
  const errs=[];const store={};const ctx=new Proxy(store,{get:(t,k)=>k in t?t[k]:()=>undefined,set:(t,k,v)=>{t[k]=v;return true}});
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.addEventListener('error',e=>errs.push(e.message))}});
  return{w:dom.window,errs,E:()=>dom.window.__ES2};
}
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const steps=(E,n)=>{for(let i=0;i<n;i++)E().step()};
const idle=(x,y,n=240)=>Array.from({length:n},()=>({x,y,a:0,atk:false,dash:false}));
const echoObj=(id,clip,x,y)=>({id,clip,i:0,loop:0,x,y,a:0,dashing:false,dashAng:0,dashHit:new Set(),r:11});
function fresh(){const o=load();o.E().startGame();o.E().G.spawnT=1e9;const G=o.E().G;G.enemies=[];G.echoes=[];G.p.x=480;G.p.y=300;return o}
function mkE(E,type,x,y){const e=E().makeEnemy(type,x,y);e.spawn=0;e.face=0;return e}
const PI=Math.PI;

// ============ PHASE HUNTER ============
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',100,300);G.enemies=[h];steps(E,30);
 ok(h.x>140&&Math.abs(h.y-300)<1&&h.tgt===null,'1. ECHO 없음 → 플레이어 추적 (x '+h.x.toFixed(1)+')');}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',100,300);G.enemies=[h];G.echoes=[echoObj(1,idle(100,50),100,50)];steps(E,30);
 ok(h.y<260&&Math.abs(h.x-100)<1&&h.tgt&&h.tgt.id===1,'2. ECHO 있음 → 플레이어(오른쪽)가 아니라 ECHO(위쪽) 추적 (y '+h.y.toFixed(1)+')');}
{const{E}=fresh();const G=E().G;let h=mkE(E,'phase',100,300);G.enemies=[h];
 G.echoes=[echoObj(1,idle(100,120),100,120),echoObj(2,idle(300,300),300,300)];steps(E,30);
 const a=h.y<260&&Math.abs(h.x-100)<1&&h.tgt.id===1;
 const o2=fresh();const G2=o2.E().G;const h2=mkE(o2.E,'phase',100,300);G2.enemies=[h2];
 G2.echoes=[echoObj(1,idle(100,20),100,20),echoObj(2,idle(250,300),250,300)];steps(o2.E,30);
 ok(a&&h2.x>140&&h2.tgt.id===2,'3. 여러 ECHO → 가장 가까운 ECHO 선택 (위쪽 근접→위, 오른쪽 근접→오른쪽)');}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',180,300);G.enemies=[h];const ec=echoObj(1,idle(100,300),100,300);G.echoes=[ec];
 let n=0;while(G.stats.tel.phaseCollisions===0&&n<120){E().step();n++}
 ok(G.stats.tel.phaseCollisions===1&&h.hp===2,'4a. 접촉 → PHASE COLLISION, 피해 1 (hp '+h.hp+', '+n+'틱 후)');
 ok(Math.abs(h.stun-0.9)<0.03&&Math.abs(h.collideCd-1.5)<0.03,'4b. 기절 0.9초 / 내부 쿨다운 1.5초 (stun '+h.stun.toFixed(2)+', cd '+h.collideCd.toFixed(2)+')');
 ok(ec.x===100&&ec.y===300&&ec.loop===0,'4c. ECHO는 영향 없음');
 const x0=h.x;steps(E,30);ok(Math.abs(h.x-x0)<20&&h.stun>0,'4d. 기절 중에는 이동하지 않음(약한 넉백만) Δx '+(h.x-x0).toFixed(1));}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',100,300);G.enemies=[h];G.echoes=[echoObj(1,idle(100,300),100,300)];
 steps(E,1);const c1=G.stats.tel.phaseCollisions;steps(E,80);const c2=G.stats.tel.phaseCollisions,hp2=h.hp;
 steps(E,20);const c3=G.stats.tel.phaseCollisions;
 ok(c1===1&&c2===1&&hp2===2,'5a. 1.5초(90틱) 이내 중복 접촉 피해 없음 (충돌 '+c1+'→'+c2+', hp '+hp2+')');
 ok(c3===2&&h.hp===1,'5b. 쿨다운 후에는 다시 충돌 (충돌 '+c3+', hp '+h.hp+')');}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',100,300);G.enemies=[h];G.echoes=[echoObj(1,idle(100,50),100,50)];steps(E,10);
 const chasing=h.tgt&&h.tgt.id===1;G.echoes=[];const x0=h.x;steps(E,30);
 ok(chasing&&h.tgt===null&&h.x>x0+30,'6. ECHO 소멸 시 새 목표(플레이어)로 전환 (Δx '+(h.x-x0).toFixed(1)+')');}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',480,300);h.stun=0.9;G.enemies=[h];const hp0=G.p.hp;steps(E,10);
 ok(G.p.hp===hp0,'(추가) 기절한 PHASE HUNTER는 접촉 피해를 주지 않음');
 const h2=mkE(E,'phase',480,300);G.enemies=[h2];G.p.inv=0;steps(E,2);ok(G.p.hp===hp0-1,'(추가) 정상 상태의 접촉 피해 1');}
{const{E}=fresh();const G=E().G;const h=mkE(E,'phase',100,300);h.hp=1;G.enemies=[h];G.echoes=[echoObj(1,idle(100,300),100,300)];steps(E,2);
 ok(h.dead&&G.exp.xp===18&&G.stats.echo===1&&G.stats.tel.phaseCollisionKills===1,'(추가) 충돌로 처치 → ECHO 처치 + XP 18 1회 (xp '+G.exp.xp+')');}

// ============ WARDEN ============
const setup=(px,py,wx,wy,face)=>{const o=fresh();const G=o.E().G;G.p.x=px;G.p.y=py;const w=mkE(o.E,'warden',wx,wy);w.face=face;G.enemies=[w];o.w0=w;return o};
const atk=(o,aim)=>{o.E().input.aimAngle=aim;o.E().input.atk=true};
{const o=setup(440,300,500,300,PI);atk(o,0);steps(o.E,1);ok(o.w0.hp===5&&o.E().G.stats.tel.shieldBlocked.player===1,'7. 정면 기본 공격 차단 (hp '+o.w0.hp+')');}
{const o=setup(560,300,500,300,PI);atk(o,PI);steps(o.E,1);ok(o.w0.hp===4,'8. 후방 기본 공격 정상 피해 (hp '+o.w0.hp+')');}
{const o=setup(500,240,500,300,PI);atk(o,PI/2);steps(o.E,1);ok(o.w0.hp===4,'8b. 측면(90°) 기본 공격 정상 피해');}
{const o=setup(100,300,500,300,PI);const G=o.E().G;const clip=idle(440,300);clip[0].atk=true;G.echoes=[echoObj(1,clip,440,300)];steps(o.E,1);
 ok(o.w0.hp===5&&G.stats.tel.shieldBlocked.echo===1,'9. ECHO 정면 공격 차단 (hp '+o.w0.hp+')');}
{const o=setup(100,300,500,300,PI);const G=o.E().G;const clip=idle(560,300);clip[0].atk=true;clip[0].a=PI;G.echoes=[echoObj(1,clip,560,300)];steps(o.E,1);
 ok(o.w0.hp===4&&G.stats.tel.wardenHit.echo===1,'10. ECHO 후방 공격 정상 피해 (hp '+o.w0.hp+')');}
{const o=setup(100,300,500,300,PI);const G=o.E().G;const clip=idle(560,300);clip[0].atk=true;clip[0].a=PI;G.echoes=[echoObj(1,clip,560,300)];
 G.p.x=100;   // 플레이어는 정면(왼쪽)에서 시선을 끌고, ECHO는 뒤에서 공격 — 시나리오 (플레이어 공격 없음)
 steps(o.E,1);ok(o.w0.hp===4&&o.E().input.atk===false,'10b. 플레이어가 시선을 끄는 동안 ECHO가 후방을 침');}
// 11. 대시
{const o=setup(440,300,500,300,PI);o.E().input.aimAngle=0;o.E().input.dash=true;steps(o.E,6);ok(o.w0.hp===5&&o.E().G.stats.tel.shieldBlocked.player>=1,'11a. 플레이어 대시(정면) 차단 (hp '+o.w0.hp+')');}
{const o=setup(560,300,500,300,PI);o.E().input.aimAngle=PI;o.E().input.dash=true;steps(o.E,6);ok(o.w0.hp===4,'11b. 플레이어 대시(후방) 정상 피해 (hp '+o.w0.hp+')');}
{const mkClip=(x0,dir)=>{const c=idle(x0,300);for(let i=1;i<=10;i++)c[i]={x:x0+dir*i*14,y:300,a:0,atk:false,dash:true};for(let i=11;i<240;i++)c[i]={x:x0+dir*140,y:300,a:0,atk:false,dash:false};return c};
 const o=setup(100,300,500,300,PI);o.E().G.echoes=[echoObj(1,mkClip(400,1),400,300)];steps(o.E,14);
 ok(o.w0.hp===5&&o.E().G.stats.tel.shieldBlocked.echo>=1,'11c. ECHO 대시(정면) 차단 (hp '+o.w0.hp+')');
 const o2=setup(100,300,500,300,PI);o2.E().G.echoes=[echoObj(1,mkClip(640,-1),640,300)];steps(o2.E,14);
 ok(o2.w0.hp===4,'11d. ECHO 대시(후방) 정상 피해 (hp '+o2.w0.hp+')');}
// 12. PULSE는 이 버전에 없음 → 비방향성 피해(origin 없음)는 방패 무시
{const o=setup(100,300,500,300,PI);o.E().hitEnemy(o.w0,1,'player',0,1);ok(o.w0.hp===4,'12. 비방향성 피해(PULSE 해당, 방향 정보 없음)는 방패 무시 — ※ 2.x에는 PULSE 자체가 없음');}
// 13. 회전 속도 제한
{const o=setup(100,300,500,300,0);const w=o.w0;let maxStep=0,prev=w.face;
 for(let i=0;i<60;i++){o.E().step();maxStep=Math.max(maxStep,Math.abs(w.face-prev));if(i===14)var f15=w.face;prev=w.face}
 ok(maxStep<=PI/60+1e-9,'13a. 틱당 회전 ≤ 180°/초 (최대 '+(maxStep*60*180/PI).toFixed(1)+'°/초)');
 ok(Math.abs(f15-PI/4)<0.02,'13b. 0.25초에 45° 회전 ('+(f15*180/PI).toFixed(1)+'°)');
 ok(Math.abs(Math.abs(w.face)-PI)<0.03,'13c. 1초 후 180° 도달');}
// 방패 경계: 60° 안 차단 / 밖 통과
{const o=setup(500+Math.cos(PI-0.9)*60,300+Math.sin(PI-0.9)*60,500,300,PI);const G=o.E().G;   // 정면에서 51.6° 벗어남 → 차단
 atk(o,0);steps(o.E,1);ok(o.w0.hp===5,'(추가) 정면 ±60° 안쪽(약 52°)은 차단');}
{const o=setup(500+Math.cos(PI-1.2)*60,300+Math.sin(PI-1.2)*60,500,300,PI);   // 68.8° 벗어남 → 통과
 atk(o,PI-1.2+PI);steps(o.E,1);ok(o.w0.hp===4,'(추가) ±60° 바깥쪽(약 69°)은 정상 피해');}

// ============ 스폰 테이블 ============
{const{E}=fresh();const G=E().G;const cnt=(tSec,n)=>{G.t=tSec*60;const c={};for(let i=0;i<n;i++){G.enemies=[];const t=E().pickType(tSec);c[t]=(c[t]||0)+1}return c};
 const b0=cnt(20,4000),b1=cnt(60,4000),b2=cnt(120,4000),b3=cnt(180,4000),b4=cnt(230,4000),b5=cnt(280,4000);   // v2.6 구간별 밴드
 const near=(c,ty,pct)=>Math.abs((c[ty]||0)/40-pct)<3;
 ok(!b0.phase&&!b0.warden&&near(b0,'chaser',72)&&near(b0,'shooter',28),'0~45초(PHASE 1 전반): 추격자 72 / 사격 28 ('+JSON.stringify(b0)+')');
 ok(!b1.warden&&near(b1,'chaser',58)&&near(b1,'shooter',30)&&near(b1,'phase',12),'45~90초(PHASE 1 후반): 58/30/PHASE 12, WARDEN 없음');
 ok(near(b2,'chaser',42)&&near(b2,'shooter',28)&&near(b2,'phase',20)&&near(b2,'warden',10),'90~150초(PHASE 2 전반): 42/28/20/WARDEN 10');
 ok(near(b3,'chaser',35)&&near(b3,'shooter',28)&&near(b3,'phase',23)&&near(b3,'warden',14),'150~210초(PHASE 2 후반): 35/28/23/WARDEN 14 (v2.6.1)');
 ok(near(b4,'chaser',29)&&near(b4,'shooter',27)&&near(b4,'phase',28)&&near(b4,'warden',16),'210~255초(PHASE 3): 29/27/28/WARDEN 16');
 ok(near(b5,'chaser',25)&&near(b5,'shooter',27)&&near(b5,'phase',30)&&near(b5,'warden',18),'255~300초(PHASE 3 후반): 25/27/PHASE 30/WARDEN 18');
 // 상한: WARDEN 3, PHASE 5 → 꽉 차면 다른 종류로
 G.enemies=[];for(let i=0;i<3;i++)G.enemies.push(mkE(E,'warden',10+i,10));for(let i=0;i<5;i++)G.enemies.push(mkE(E,'phase',10+i,50));
 let bad=0;for(let i=0;i<500;i++){const t=E().pickType(50);if(t==='warden'||t==='phase')bad++}
 ok(bad===0,'상한(WARDEN 3 / PHASE HUNTER 5)이 차면 뽑히지 않음');}

// ============ XP 중복 없음 (신규 적) ============
{const{E}=fresh();const G=E().G;const w=mkE(E,'warden',300,300);const p=mkE(E,'phase',400,400);w.hp=1;p.hp=1;G.enemies=[w,p];
 E().hitEnemy(w,5,'player',0,1);E().hitEnemy(w,5,'echo',0,1);E().hitEnemy(p,5,'echo',0,1);E().hitEnemy(p,5,'player',0,1);
 ok(G.exp.level===2&&G.exp.xp===13&&G.stats.kills===2,'WARDEN 25 + PHASE HUNTER 18 = 43 XP (Lv2, 13 이월), 중복 호출에도 1회씩 → 레벨 '+G.exp.level+' xp '+G.exp.xp);}
console.log(fails?('FAILS: '+fails):'ALL PASS v2.2 단위');
process.exit(fails?1:0);
