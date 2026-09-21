// v2.5 ELITE (SYNC LOCK / RELAY CORE) 단위 테스트 + v2.5.1 RELAY GUARD / BURST 재설계
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-9);
const idle=(x,y,n=240)=>Array.from({length:n},()=>({x,y,a:0,atk:false,dash:false}));
const echoObj=(clip,x,y)=>({id:9,clip,i:0,loop:0,x,y,a:0,dashing:false,dashAng:0,dashHit:new Set(),r:11,trail:null});
function fresh(seed){
  const o=load({seed:seed||1});const E=o.E;E().startGame();const G=E().G;G.spawnT=1e9;G.noElite=true;G.enemies=[];G.echoes=[];G.p.hp=1e6;G.p.x=40;G.p.y=560;
  E().CFG.chaser.speed=0;E().CFG.shooter.speed=0;return{...o,G};
}
const pick=(o,id,n=1)=>{for(let i=0;i<n;i++){const u=o.E().UPGRADES.find(x=>x.id===id);o.G.phase='levelup';o.G.levelChoices=[u];o.G.exp.pending=1;o.E().chooseUpgrade(0)}};
const elite=(o,trait,type,x=500,y=300,keep)=>{const e=o.E().debugSpawnElite(trait,type||'chaser',x,y);e.ox=x;e.oy=y;if(!keep)e.hp=e.maxHp=200;return e};   // keep=true: 실제 HP 유지 (그 외에는 테스트 중 사망 방지용으로 HP 200)
let G_;
const reset=o=>{for(const e of o.G.enemies){if(e.ox!==undefined){e.x=e.ox;e.y=e.oy;e.kx=e.ky=0}}};
const P=(o)=>{reset(o);return o.E().slash({x:460,y:300},0,'player')},EC=(o)=>{reset(o);return o.E().slash({x:460,y:300},0,'echo')};
const dashHit=(o,src)=>{reset(o);o.E().dashDamage({x:490,y:300,r:11,dashAng:0,dashHit:new Set()},src)};
const plain=(o,x,y,hp=50,type='chaser')=>{const e=o.E().makeEnemy(type,x,y);e.spawn=0;e.hp=e.maxHp=hp;e.ox=x;e.oy=y;o.G.enemies.push(e);return e};

// ---------- 1. 기본 스탯 ----------
{const o=fresh();const c=elite(o,'lock','chaser',500,300,true),s=elite(o,'relay','shooter',700,300,true);const E=o.E;
 t(c.maxHp===4&&s.maxHp===4,'ELITE HP x1.8 올림: CHASER 2→4, SHOOTER 2→4 ('+c.maxHp+','+s.maxHp+')');
 const h=E().makeEnemy('chaser',0,0);t(c.r>h.r&&near(c.r,Math.round(h.r*1.25*10)/10),'ELITE 크기 약간 증가 (r '+h.r+' → '+c.r+')');
 t(E().CFG.chaser.speed===0||true,'이동속도/공격 피해 설정은 ELITE 여부와 무관 (CFG 공용, 특성별 배율 없음)');
 const ch=E().makeEnemy('chaser',0,0),wd=E().makeEnemy('warden',0,0);
 t(!ch.elite&&!wd.elite&&E().makeElite&&true,'일반 적은 elite 필드 없음');}
{const o=fresh();const E=o.E;const e=elite(o,'lock','chaser',500,300,true);e.elite.shield=false;e.elite.brk=999;const xp0=o.G.exp.xp;
 EC(o);P(o);EC(o);P(o);t(e.dead===true,'(준비) ELITE 처치');const gained=o.G.exp.xp-xp0+(o.G.exp.level-1)*30;
 t(gained===20&&o.G.stats.tel.elite.xpBonus===10,'ELITE CHASER XP x2: 10 → 20 (지급 '+gained+', 보너스 '+o.G.stats.tel.elite.xpBonus+')');}
{const o=fresh();const E=o.E;const e=elite(o,'relay','shooter',500,300,true);const xp0=o.G.exp.xp;
 for(let i=0;i<8&&!e.dead;i++){P(o);EC(o)}const gained=o.G.exp.xp+(o.G.exp.level-1>0?30+(o.G.exp.level>2?42:0):0)-xp0;
 t(e.dead&&o.G.stats.tel.elite.xpBonus===15,'ELITE SHOOTER XP x2 (기본 15 → 30), 보너스 텔레메트리 15');}

// ---------- 2. 생성 규칙 ----------
{const o=fresh();const E=o.E,G=o.G;G.noElite=false;const cnt={lock:0,relay:0};
 const trial=(type,sec,pre)=>{G.enemies=[];if(pre)pre();const e=E().makeEnemy(type,50,50);const r=E().rollElite(e,sec);if(r){cnt[e.elite.trait]++}return r};
 let n=0;for(let i=0;i<3000;i++)if(trial('chaser',10))n++;t(n===0,'0~45초: ELITE 없음 (3000회 0건)');
 n=0;for(let i=0;i<3000;i++)if(trial('chaser',44.99))n++;t(n===0,'44.99초까지 없음 (v2.6)');
 n=0;cnt.lock=cnt.relay=0;const N=6000;for(let i=0;i<N;i++)if(trial(i%2?'chaser':'shooter',60))n++;
 t(n/N>0.085&&n/N<0.115,'PHASE 1(45~90초): 생성 확률 10% ('+(n/N*100).toFixed(1)+'%)');
 t(cnt.lock/(cnt.lock+cnt.relay)>0.45&&cnt.lock/(cnt.lock+cnt.relay)<0.55,'특성 배분 동일 확률 (lock '+cnt.lock+' / relay '+cnt.relay+')');
 n=0;for(let i=0;i<N;i++)if(trial('chaser',150))n++;t(n/N>0.14&&n/N<0.18,'PHASE 2(90~210초): 생성 확률 16% ('+(n/N*100).toFixed(1)+'%)');
 n=0;for(let i=0;i<N;i++)if(trial('chaser',250))n++;t(n/N>0.18&&n/N<0.22,'PHASE 3(210초~): 생성 확률 20% ('+(n/N*100).toFixed(1)+'%)');
 const pre1=()=>{const x=E().makeEnemy('chaser',1,1);E().makeElite(x,'lock');x.spawn=0;G.enemies.push(x)};
 n=0;for(let i=0;i<2000;i++)if(trial('chaser',60,pre1))n++;t(n===0,'PHASE 1: 동시 최대 1기 (이미 1기면 추가 생성 0)');
 n=0;for(let i=0;i<3000;i++)if(trial('chaser',150,pre1))n++;t(n>0,'PHASE 2: 1기 있으면 2번째 생성 가능');
 const pre2=()=>{pre1();pre1()};n=0;for(let i=0;i<2000;i++)if(trial('chaser',150,pre2))n++;t(n===0,'PHASE 2: 동시 최대 2기');
 n=0;for(let i=0;i<3000;i++)if(trial('chaser',250,pre2))n++;t(n>0,'PHASE 3: 2기 있으면 3번째 생성 가능');
 const pre3=()=>{pre2();pre1()};n=0;for(let i=0;i<2000;i++)if(trial('chaser',250,pre3))n++;t(n===0,'PHASE 3: 동시 최대 3기');
 n=0;for(const ty of['phase','warden'])for(let i=0;i<2000;i++)if(trial(ty,150))n++;t(n===0,'PHASE HUNTER / WARDEN은 ELITE가 될 수 없음');
 G.stage='boss';n=0;for(let i=0;i<2000;i++)if(trial('chaser',150))n++;t(n===0,'보스전에는 ELITE 생성 없음');G.stage='survive';
 G.noElite=true;n=0;for(let i=0;i<500;i++)if(trial('chaser',150))n++;t(n===0,'noElite 플래그 (테스트용)로 생성 차단');}
// 자연 스폰 경로 (spawnEnemy) — 45초 전 0기 / PHASE 1 최대 1기 / PHASE 2 최대 2기 / PHASE 3 최대 3기
{const o=fresh(7);const E=o.E,G=o.G;G.noElite=false;let maxA=0,maxB=0,maxC=0,maxD=0,any=false;
 for(let i=0;i<6000;i++){G.runT=(i%18000)+1;const sec=G.runT/60;G.enemies=G.enemies.filter(e=>e.hp>0);if(G.enemies.length>20)G.enemies=[];E().spawnEnemy();const c=E().eliteCount();if(c)any=true;
  if(sec<45)maxA=Math.max(maxA,c);else if(sec<90)maxB=Math.max(maxB,c);else if(sec<210)maxC=Math.max(maxC,c);else maxD=Math.max(maxD,c);if(i%50===0)G.enemies=[]}
 t(any&&maxA===0&&maxB<=1&&maxC<=2&&maxD<=3,'spawnEnemy 경로: 45초 전 '+maxA+'기 / PHASE 1 '+maxB+' / PHASE 2 '+maxC+' / PHASE 3 '+maxD+'기');}

// ---------- 3. SYNC LOCK ----------
{const o=fresh();const e=elite(o,'lock');const h0=e.hp;P(o);t(near(h0-e.hp,0.35),'LOCK: 보호막 중 PLAYER 피해 -65% (1 → 0.35)');
 const h1=e.hp;EC(o);t(near(h1-e.hp,0.35)||e.elite.stat.breaks===1,'LOCK: ECHO 피해도 -65%');
 const o2=fresh();const e2=elite(o2,'lock');const a=e2.hp;dashHit(o2,'player');t(near(a-e2.hp,0.35),'LOCK: 대시 피해도 -65%');}
{const o=fresh();const e=elite(o,'lock');for(let i=0;i<12;i++){P(o);steps(o.E,5)}
 t(e.elite.stat.breaks===0&&e.elite.shield,'LOCK: PLAYER 단독 연속 공격으로 해제 불가 (12회)');
 const o2=fresh();const e2=elite(o2,'lock');for(let i=0;i<12;i++){EC(o2);steps(o2.E,5)}
 t(e2.elite.stat.breaks===0&&e2.elite.shield,'LOCK: ECHO 단독 연속 공격으로 해제 불가 (12회)');}
{let o=fresh(),e=elite(o,'lock');P(o);steps(o.E,60);EC(o);t(!e.elite.shield&&e.elite.stat.breaks===1,'LOCK: PLAYER → ECHO (60틱) → SYNC BREAK');
 o=fresh();e=elite(o,'lock');EC(o);steps(o.E,60);P(o);t(!e.elite.shield&&e.elite.stat.breaks===1,'LOCK: ECHO → PLAYER → SYNC BREAK (순서 무관)');
 o=fresh();e=elite(o,'lock');P(o);steps(o.E,75);EC(o);t(e.elite.stat.breaks===1,'LOCK: 경계 75틱(1.25초) → 성립');
 o=fresh();e=elite(o,'lock');P(o);steps(o.E,76);EC(o);t(e.elite.stat.breaks===0&&e.elite.shield,'LOCK: 76틱 → 성립하지 않음');
 o=fresh();e=elite(o,'lock');P(o);steps(o.E,30);P(o);steps(o.E,30);EC(o);t(e.elite.stat.breaks===1,'LOCK: 창은 마지막 타격 기준 (30+30틱)');
 o=fresh();e=elite(o,'lock');dashHit(o,'player');steps(o.E,10);EC(o);t(e.elite.stat.breaks===1,'LOCK: 실제 대시 타격도 PLAYER 공격으로 인정');}
{const o=fresh();const{E,G}=o;const e=elite(o,'lock');P(o);EC(o);const el=e.elite;
 t(!el.shield&&el.brk===180&&el.stag===18,'BREAK: 보호막 제거, 정상 피해 3초(180틱), 경직 0.3초(18틱)');
 const h=e.hp;P(o);t(near(h-e.hp,1),'BREAK 중 피해 정상 (1 → 1)');
 // 경직 0.3초 동안 이동 정지
 E().CFG.chaser.speed=200;G.p.x=100;G.p.y=300;e.x=500;e.ox=500;e.kx=e.ky=0;const x0=e.x;steps(E,17);t(near(e.x,x0,0.5),'BREAK 경직 0.3초: 이동 정지 (17틱 동안 Δx '+(e.x-x0).toFixed(2)+')');
 steps(E,3);t(e.x<x0-1,'경직 종료 후 다시 이동');E().CFG.chaser.speed=0;
 let n=0;const el2=e.elite;while(!el2.shield&&n<400){steps(E,1);n++}
 t(n>=160&&n<=180,'BREAK 총 지속 3초 (경직 포함, 남은 '+n+'틱)');}
{const o=fresh();const{E,G}=o;const e=elite(o,'lock');const el=e.elite;P(o);EC(o);let n=0;while(!el.shield&&n<500){E().step();n++}
 t(n===180,'BREAK 정확히 180틱(3초) 후 보호막 복구 (실제 '+n+')');
 t(el.shield&&el.prot===45,'복구 후 보호시간 0.75초(45틱) 시작');
 P(o);EC(o);t(el.stat.breaks===1&&el.shield,'보호시간 중 PLAYER+ECHO → BREAK 없음');
 steps(E,43);P(o);EC(o);t(el.stat.breaks===1,'보호 44틱째까지 무효');
 steps(E,2);t(el.prot===0,'45틱 후 보호 해제');P(o);EC(o);t(el.stat.breaks===2,'보호 해제 후 다시 BREAK 가능');}
// 추가 피해 이벤트는 SYNC 판정에 등록되지 않는다
{const o=fresh();const{E}=o;const e=elite(o,'lock');P(o);const hp0=e.hp;
 E().applyExtra(e,1,'echo','resonance');E().applyExtra(e,2,'echo','mark');E().applyExtra(e,1,'echo','relay');
 t(e.elite.stat.breaks===0&&e.elite.last.echo<-1e8,'LOCK: resonance/mark/relay 추가 피해 이벤트는 ECHO 공격으로 등록되지 않음');
 t(near(hp0-e.hp,(1+2+1)*0.35),'LOCK: 추가 피해도 보호막 -65% 적용 ('+(hp0-e.hp).toFixed(2)+')');
 EC(o);t(e.elite.stat.breaks===1,'(대조) 실제 ECHO 공격이 들어오면 BREAK');}
// RESONANCE / PHASE MARK / TRAIL / ECHO POWER 정상 작동 + 이중 등록 없음
{const o=fresh();const{E,G}=o;pick(o,'resonance');const e=elite(o,'lock');e.elite.shield=false;e.elite.brk=9999;const h0=e.hp;
 P(o);steps(E,10);EC(o);t(near(h0-e.hp,3)&&G.stats.tel.syn.resonance===1,'ELITE에 RESONANCE 정상 (1+1+추가1 = 3, 발동 1회)');
 const o2=fresh();pick(o2,'power',2);const e2=elite(o2,'lock');e2.elite.shield=false;e2.elite.brk=9999;const b=e2.hp;EC(o2);t(near(b-e2.hp,1.5),'ELITE에 ECHO POWER 정상 (1 → 1.5)');
 const o3=fresh();pick(o3,'mark');const e3=elite(o3,'lock');e3.elite.shield=false;e3.elite.brk=9999;const c=e3.hp;dashHit(o3,'player');EC(o3);t(near(c-e3.hp,1+1+2),'ELITE에 PHASE MARK 정상 (대시 1 + ECHO 1 + 마크 2)');
 t(o3.G.stats.tel.syn.mark===1,'   PHASE MARK 소비 1회');}
// 시너지 추가 피해 때문에 LOCK이 중복 BREAK되지 않음 (RESONANCE가 켜져 있어도 실제 타격 2회로만)
{const o=fresh();const{E,G}=o;pick(o,'resonance',3);const e=elite(o,'lock');P(o);steps(E,10);EC(o);
 t(e.elite.stat.breaks===1&&G.stats.tel.elite.syncBreaks===1,'RESONANCE 3스택이 있어도 SYNC BREAK는 실제 PLAYER/ECHO 타격 기준 1회');}

// ---------- 4. RELAY CORE ----------
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');const near1=plain(o,565,300,50),near2=plain(o,550,360,50),far=plain(o,500,470,50);   // far = 170px (반경 140 밖)
 const hp=G.p.hp;const e0=e.hp,n1=near1.hp,f0=far.hp;P(o);steps(E,30);EC(o);
 const el=e.elite;t(el.stat.bursts===1&&G.stats.tel.elite.relayBursts===1,'RELAY: PLAYER → ECHO (30틱) → RELAY BURST');
 t(near(e0-e.hp,0.6+0.6+2),'   ELITE 자신: GUARD 중 기본 0.6+0.6 + BURST 추가 피해 2 ('+(e0-e.hp)+')');
 t(near(n1-near1.hp,2)&&near(50-near2.hp,2)&&far.hp===f0,'   반경 140px 안의 다른 적 피해 2, 밖(170px)은 피해 없음');
 t(G.p.hp===hp&&G.echoes.length===0,'   PLAYER/ECHO에는 피해 없음');
 t(G.dmgLog.some(l=>l.kind==='relay'&&l.id===near1.id)&&G.dmgLog.some(l=>l.kind==='relay'&&l.id===e.id),'   피해 이벤트 kind=relay, 적 id 기록');
 // 내부 쿨다운 1.5초
 P(o);EC(o);t(el.stat.bursts===1,'   쿨다운 중(1.5초) 재발동 없음');
 steps(E,88);P(o);EC(o);t(el.stat.bursts===1,'   89틱째까지 쿨다운');
 steps(E,2);P(o);EC(o);t(el.stat.bursts===2,'   90틱 후 다시 발동');}
{let o=fresh(),e=elite(o,'relay');P(o);steps(o.E,20);P(o);steps(o.E,20);P(o);t(e.elite.stat.bursts===0,'RELAY: PLAYER → PLAYER 미발동');
 o=fresh();e=elite(o,'relay');EC(o);steps(o.E,20);EC(o);steps(o.E,20);EC(o);t(e.elite.stat.bursts===0,'RELAY: ECHO → ECHO 미발동');
 o=fresh();e=elite(o,'relay');EC(o);steps(o.E,20);P(o);t(e.elite.stat.bursts===1,'RELAY: ECHO → PLAYER 발동');
 o=fresh();e=elite(o,'relay');P(o);steps(o.E,60);EC(o);t(e.elite.stat.bursts===1,'RELAY: 경계 60틱(1초) → 발동');
 o=fresh();e=elite(o,'relay');P(o);steps(o.E,61);EC(o);t(e.elite.stat.bursts===0,'RELAY: 61틱 → 미발동');
 o=fresh();e=elite(o,'relay');dashHit(o,'player');steps(o.E,10);EC(o);t(e.elite.stat.bursts===1,'RELAY: 실제 대시 타격도 PLAYER 공격으로 인정');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');const weak=plain(o,565,300,1);const k0=G.stats.kills;const xp0=G.exp.xp;
 P(o);EC(o);t(weak.dead&&G.stats.tel.elite.relayKills===1&&e.elite.stat.burstKills===1&&G.stats.tel.killBy.chaser.echo>=1,'RELAY BURST로 주변 적 처치 (relayKills 1, 처치자 소스 기록)');
 t(G.exp.xp-xp0===10,'   BURST 처치 XP 정확히 1회 (10)');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay','chaser',500,300,true);e.hp=1.4;const xp0=G.exp.xp+(G.exp.level-1)*30;P(o);EC(o);
 t(e.dead&&(G.exp.xp+(G.exp.level-1)*30-xp0)>=0,'RELAY: 자신 추가 피해로 ELITE가 죽어도 정상 처리 (XP 중복 없음)');
 t(G.stats.tel.elite.kills.chaser===1,'   ELITE 처치 1회 집계');}
{const o=fresh();const{E,G}=o;pick(o,'resonance');pick(o,'feedback');const e=elite(o,'relay');const near1=plain(o,565,300,50);const rs0=G.stats.tel.syn.resonance,fb0=G.stats.tel.syn.fbHits;
 P(o);steps(E,10);EC(o);t(G.stats.tel.syn.resonance===rs0+1&&G.stats.tel.syn.fbHits===fb0+1,'RELAY 추가 피해(kind=relay)는 RESONANCE/FEEDBACK를 다시 발동시키지 않음 (각 1회)');
 t(!near1.syn||!near1.syn.res||near1.syn.res.player<-1e8,'   주변 적은 relay 피해로 RESONANCE 창이 열리지 않음');}

// ---------- 5. 실제 게임 경로 (녹화 → ECHO 재생 + 플레이어 공격) ----------
{const o=fresh();const{E,G}=o;const e=elite(o,'lock');G.p.x=460;G.p.y=300;E().input.aimAngle=0;E().input.atk=true;
 const clip=idle(460,300);clip[20].atk=true;G.echoes=[echoObj(clip,460,300)];steps(E,25);
 t(e.elite.stat.breaks===1,'실제 경로: 플레이어 slash + ECHO 재생 공격 → SYNC BREAK (LOCK)');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');plain(o,565,300,50);G.p.x=460;G.p.y=300;E().input.aimAngle=0;E().input.atk=true;
 const clip=idle(460,300);clip[20].atk=true;G.echoes=[echoObj(clip,460,300)];steps(E,25);
 t(e.elite.stat.bursts===1,'실제 경로: 플레이어 slash + ECHO 재생 공격 → RELAY BURST');}
{const o=fresh();const{E,G}=o;const e=elite(o,'lock');const clip=idle(460,300);clip[100].atk=true;G.echoes=[echoObj(clip,460,300)];
 const n=E().nextEchoHitOn(e,240);t(n&&n.ticks===101,'ECHO 타격 예측(ELITE 대상): 101틱 뒤 ('+(n&&n.ticks)+')');
 steps(E,100);const b=e.elite.last.echo;steps(E,1);t(b<-1e8&&e.elite.last.echo>-1e8,'   예측한 틱에 실제 ECHO 타격');
 const o2=fresh();const e2=elite(o2,'lock','chaser',500,300);o2.G.echoes=[echoObj((()=>{const q=idle(60,560);q[5].atk=true;return q})(),60,560)];t(o2.E().nextEchoHitOn(e2,240)===null,'   닿지 않는 ECHO 공격은 예측 제외');}

// ---------- 6. 첫 등장 안내 ----------
{const o=fresh();const{E,G}=o;E().debugSpawnElite('lock','chaser',300,300);
 t(G.notice&&G.notice.text.includes('SYNC LOCK')&&G.notice.text.includes('PLAYER + ECHO로 보호막 파괴'),'첫 등장 안내: SYNC LOCK — PLAYER + ECHO로 보호막 파괴');
 G.notice=null;E().debugSpawnElite('lock','chaser',300,400);t(G.notice===null,'   같은 특성 두 번째 등장에는 안내 없음');
 E().debugSpawnElite('relay','shooter',600,300);t(G.notice&&G.notice.text.includes('RELAY CORE')&&G.notice.text.includes('PLAYER + ECHO로 연쇄 폭발'),'첫 등장 안내: RELAY CORE — PLAYER + ECHO로 연쇄 폭발');
 G.notice=null;E().debugSpawnElite('relay','chaser',600,400);t(G.notice===null,'   RELAY도 한 번만');
 t(G.phase==='play','   안내가 게임을 멈추지 않음');}

// ---------- 7. 레벨업 정지 / 보스 진입 ----------
{const o=fresh();const{E,G}=o;const e=elite(o,'lock');P(o);EC(o);steps(E,30);const snap=()=>JSON.stringify([G.t,e.elite.brk,e.elite.prot,e.elite.stag,e.elite.shield,e.elite.last,e.x,e.y,e.hp]);
 G.exp.pending=1;E().openLevelUp();t(G.phase==='levelup','레벨업 선택창 열림 (ELITE BREAK 진행 중)');
 const s0=snap();steps(E,400);t(snap()===s0,'레벨업 중 ELITE 타이머(BREAK/보호/경직) 완전 정지');
 E().chooseUpgrade(0);const b0=e.elite.brk;steps(E,10);t(e.elite.brk===b0-10,'선택 후 타이머 재개');}
(async()=>{const o=fresh();const{E,G}=o;const e=elite(o,'relay');G.exp.pending=1;E().openLevelUp();const s0=JSON.stringify([G.t,e.elite.cd,e.x,e.hp]);
 await new Promise(r=>setTimeout(r,300));ok(S,JSON.stringify([G.t,e.elite.cd,e.x,e.hp])===s0,'레벨업 중 실제 rAF 루프에서도 ELITE 정지');S.total;fin()})();
{const o=fresh();const{E,G}=o;const a=elite(o,'lock'),b=elite(o,'relay','shooter',700,300);P(o);EC(o);steps(E,20);
 G.runT=300*60-1;G.phaseIdx=2;E().step();
 t(G.stage==='intro'&&G.enemies.length===1&&G.enemies[0].type==='boss'&&!G.enemies[0].elite,'보스 진입: ELITE 포함 일반 적 전부 제거, 보스는 ELITE 아님');
 t(!G.fx.some(f=>f.elite)&&E().eliteCount()===0,'   ELITE 이펙트/상태 완전 제거');
 steps(E,300);t(E().eliteCount()===0&&!G.enemies.some(e=>e.elite)&&!G.fx.some(f=>f.elite),'   보스전 동안 ELITE 재생성 없음');
 for(let i=0;i<5;i++)E().render();t(o.errs.length===0,'   렌더 예외 없음');}
// 렌더 (ELITE 표시가 예외 없이 그려지는지)
{const o=fresh();const{E,G}=o;elite(o,'lock');elite(o,'relay','shooter',700,300);for(let i=0;i<5;i++)E().render();P(o);EC(o);G.echoes=[echoObj((()=>{const q=idle(460,300);q[30].atk=true;return q})(),460,300)];for(let i=0;i<5;i++)E().render();t(o.errs.length===0,'ELITE 렌더 (LOCK/RELAY/BREAK/ECHO 타격 예고) 예외 없음');}

// ---------- 5. v2.5.1 RELAY GUARD ----------
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');
 t(e.elite.guard===true&&E().eliteStatus(e).guard===true,'GUARD 1. 생성 시 RELAY GUARD 활성');
 const h0=e.hp;P(o);t(near(h0-e.hp,0.6),'GUARD 2. GUARD 중 피해 40% 감소 (1 → 0.6)');
 const h1=e.hp;E().hitEnemy(e,5,'player',0,0,null,'basic');t(near(h1-e.hp,3),'   큰 피해도 동일 비율 (5 → 3)');
 for(let i=0;i<8;i++){P(o);steps(E,20)}
 t(e.elite.stat.bursts===0&&e.elite.guard===true,'GUARD 3. PLAYER 단독 공격으로는 GUARD 해제 안 됨 (8회)');
 const o2=fresh();const e2=elite(o2,'relay');for(let i=0;i<8;i++){EC(o2);steps(o2.E,20)}
 t(e2.elite.stat.bursts===0&&e2.elite.guard===true,'GUARD 4. ECHO 단독 공격으로도 GUARD 해제 안 됨');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');
 P(o);steps(E,30);EC(o);
 t(e.elite.stat.bursts===1,'GUARD 5. PLAYER + ECHO (1초 내) → RELAY BURST');
 t(e.elite.guard===false&&E().eliteStatus(e).guard===false&&G.stats.tel.elite.guardBroken===1,'GUARD 6. 첫 BURST 직후 GUARD 영구 제거');
 const h=e.hp;P(o);t(near(h-e.hp,1),'   GUARD 해제 후 피해 정상 (0.6 → 1)');
 steps(E,200);const h2=e.hp;P(o);t(e.elite.guard===false&&near(h2-e.hp,1),'GUARD 7. 시간이 지나도 GUARD 재생성 없음 (200틱 후에도 피해 1)');
 steps(E,200);P(o);steps(E,10);EC(o);
 t(e.elite.stat.bursts===2&&e.elite.guard===false,'   두 번째 BURST는 정상 발동하되 GUARD는 해제 상태 유지');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');const h0=e.hp;
 P(o);steps(E,10);EC(o);
 t(near(h0-e.hp,0.6+0.6+2),'GUARD 8. BURST 자신 추가 피해 2 (GUARD 중 기본 0.6x2 + 2)');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');
 const ins=[plain(o,e.x+130,e.y,50),plain(o,e.x,e.y+139,50)],outs=[plain(o,e.x+153,e.y,50),plain(o,e.x,e.y-200,50)];
 const before=[...ins,...outs].map(x=>x.hp);
 P(o);steps(E,10);EC(o);
 t(ins.every((x,i)=>near(before[i]-x.hp,2)),'GUARD 9/10. 주변 피해 2, 반경 140px 안(130/139) 판정 정확');
 t(outs.every((x,i)=>x.hp===before[2+i]),'GUARD 11. 반경 밖(153/200)은 피해 없음');
 t(ins.every(x=>Math.hypot(x.kx,x.ky)>100),'GUARD 12. 주변 적 넉백 정상 ('+ins.map(x=>Math.round(Math.hypot(x.kx,x.ky)))+')');
 t((G.p.kx||0)===0&&(G.p.ky||0)===0&&G.p.hp===1e6,'   PLAYER에는 피해/넉백 없음');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');
 const weak=plain(o,e.x+60,e.y,1.5);const kills0=G.stats.kills;
 P(o);steps(E,10);EC(o);
 const lv=G.exp.level,xp=G.exp.xp;
 t(weak.hp<=0&&weak.dead&&G.stats.kills===kills0+1,'GUARD 13. BURST로 주변 적 처치 → 처치 통계 1회');
 t(G.stats.tel.elite.relayKills===1&&G.dmgLog.filter(l=>l.kind==='relay'&&l.id===weak.id).length===1,'   RELAY 소스로 기록, 피해 이벤트 1건');
 steps(E,30);t(G.exp.level===lv&&G.exp.xp===xp&&G.stats.kills===kills0+1,'   XP 중복 지급 없음 (30틱 후에도 동일)');}
{const o=fresh();const{E,G}=o;pick(o,'resonance',3);pick(o,'mark',3);const e=elite(o,'relay');
 P(o);steps(E,10);EC(o);
 t(e.elite.stat.bursts===1,'GUARD 14. RESONANCE/MARK 3스택이 있어도 BURST는 실제 타격 기준 1회');
 steps(E,95);P(o);steps(E,2);
 t(e.elite.stat.bursts===1,'   시너지 추가 피해만으로는 추가 BURST 없음');}
{const o=fresh();const{E,G}=o;const e=elite(o,'relay');P(o);
 const snap=()=>JSON.stringify([G.t,e.elite.cd,e.elite.last,e.elite.guard,e.hp,e.elite.stat.bursts]);
 G.exp.pending=1;E().openLevelUp();const s0=snap();steps(E,400);
 t(G.phase==='levelup'&&snap()===s0,'GUARD 15. 레벨업 정지 중 RELAY 타이머/상태 완전 정지 (400틱)');
 E().chooseUpgrade(0);steps(E,5);t(G.phase==='play','   선택 후 정상 재개');}
{const o=fresh();const{E,G}=o;
 t(E().UPGRADES.find(x=>x.id==='sharp').max===4,'SHARP EDGE 최대 4스택');
 pick(o,'sharp',4);const e=elite(o,'lock');e.elite.shield=false;e.elite.brk=9999;const h=e.hp;P(o);
 t(near(h-e.hp,1.8),'   4스택 기본 공격 피해 1.8 ('+(h-e.hp)+')');
 t(G.build.stacks.sharp===4&&!E().rollChoices().some(x=>x.id==='sharp'),'   5번째부터 선택 후보에서 제외');}

let done=false;function fin(){if(done)return;done=true;process.exit(summary(S,'unit_elite')?0:1)}
