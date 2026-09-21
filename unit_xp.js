const {JSDOM}=require('jsdom');const fs=require('fs');
const html=require('fs').readFileSync(process.env.ES_HTML||require('path').join(__dirname,'..','..','dist','echo_shift_2_6_1.html'),'utf8');
function load(){
  const errs=[];const store={};const ctx=new Proxy(store,{get:(t,k)=>k in t?t[k]:()=>undefined,set:(t,k,v)=>{t[k]=v;return true}});
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.addEventListener('error',e=>errs.push(e.message))}});
  const w=dom.window;return{w,errs,E:()=>w.__ES2,doc:w.document};
}
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const steps=(E,n)=>{for(let i=0;i<n;i++)E().step()};
const quiet=E=>{E().G.spawnT=1e9};
const mk=(type,x,y,hp)=>({type,x,y,r:type==='chaser'?11:12,hp,maxHp:hp,kx:0,ky:0,flash:0,spawn:0,cd:99,wind:0,aim:0,touchCd:0});
const echoObj=(clip,x,y)=>({id:99,clip,i:0,loop:0,x,y,a:0,dashing:false,dashAng:0,dashHit:new Set(),r:11});
const idle=(x,y,n=240)=>Array.from({length:n},()=>({x,y,a:0,atk:false,dash:false}));
function pick(E,id){const G=E().G;const u=E().UPGRADES.find(u=>u.id===id);G.phase='levelup';G.levelChoices=[u];G.exp.pending=Math.max(1,G.exp.pending);E().chooseUpgrade(0)}
const key=(w,code,extra={})=>w.dispatchEvent(new w.KeyboardEvent('keydown',{code,key:code,bubbles:true,cancelable:true,...extra}));

(async()=>{
// 1) 플레이어 처치 → XP (종류별)
{const{E}=load();E().startGame();quiet(E);const G=E().G;
 G.enemies=[mk('chaser',G.p.x+40,G.p.y,1)];E().input.aimAngle=0;E().input.atk=true;steps(E,1);
 ok(G.exp.xp===10&&G.stats.you===1,'플레이어 처치: 추격자 XP 10 → '+G.exp.xp);
 E().input.atk=false;G.p.atkCd=0;G.enemies=[mk('shooter',G.p.x+40,G.p.y,1)];E().input.atk=true;steps(E,1);
 ok(G.exp.xp===25,'사격 적 XP 15 → 누적 '+G.exp.xp);}

// 2) ECHO 처치 → XP
{const{E}=load();E().startGame();quiet(E);const G=E().G;
 const clip=idle(G.p.x,G.p.y);clip[0].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 G.enemies=[mk('chaser',G.p.x+40,G.p.y,1)];steps(E,1);
 ok(G.exp.xp===10&&G.stats.echo===1&&G.stats.you===0,'ECHO 처치도 XP 10 (ECHO '+G.stats.echo+')');}

// 3) 여러 공격이 동시에 맞아도 XP 1회
{const{E}=load();E().startGame();quiet(E);const G=E().G;
 const clip=idle(G.p.x,G.p.y);clip[0].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 G.enemies=[mk('chaser',G.p.x+40,G.p.y,1)];E().input.aimAngle=0;E().input.atk=true;steps(E,1);
 ok(G.exp.xp===10&&G.stats.kills===1,'플레이어+ECHO 동시 타격, hp1 → XP 1회 ('+G.exp.xp+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;
 const clip=idle(G.p.x,G.p.y);clip[0].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 G.enemies=[mk('chaser',G.p.x+40,G.p.y,2)];E().input.aimAngle=0;E().input.atk=true;steps(E,1);   // 1+1로 사망
 ok(G.exp.xp===10&&G.stats.kills===1,'hp2를 두 공격이 동시에 → XP 1회 ('+G.exp.xp+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;
 const e=mk('chaser',300,300,1);G.enemies=[e];
 E().hitEnemy(e,5,'player',0,1);E().hitEnemy(e,5,'echo',0,1);E().hitEnemy(e,5,'player',0,1);
 ok(G.exp.xp===10&&G.stats.kills===1,'같은 적에 hitEnemy 3회 호출해도 XP 1회 ('+G.exp.xp+')');}

// 4) 이월 / 필요 XP 공식
{const{E}=load();E().startGame();const G=E().G;
 E().gainXp(40);ok(G.exp.level===2&&G.exp.xp===10&&G.exp.need===42&&G.exp.pending===1,'초과 XP 이월: Lv2, 10/42');}
{const{E}=load();E().startGame();const G=E().G;const needs=[G.exp.need];
 for(let i=0;i<5;i++){E().gainXp(G.exp.need);needs.push(G.exp.need)}
 ok(needs.join()==='30,42,59,83,116,162','필요 XP 30→42→59→83→116→162 ('+needs+')');}
{const{E}=load();E().startGame();const G=E().G;E().gainXp(100);
 ok(G.exp.level===3&&G.exp.xp===28&&G.exp.need===59&&G.exp.pending===2,'한 번에 100XP: Lv3 28/59, 선택 2회 대기');}

// 5) 다중 레벨업 순차 선택창 (실제 처치)
{const{E,doc}=load();E().startGame();quiet(E);const G=E().G;
 G.enemies=Array.from({length:10},(_,i)=>mk('chaser',G.p.x+40,G.p.y+(i-5)*3,1));
 E().input.aimAngle=0;E().input.atk=true;steps(E,1);
 ok(G.stats.kills===10&&G.exp.pending===2&&G.phase==='levelup','10기 동시 처치 → 100XP, 선택창 발생, 대기 2');
 ok(doc.getElementById('lvTitle').textContent.includes('LV 2'),'첫 선택창 = LV 2 ('+doc.getElementById('lvTitle').textContent+')');
 E().chooseUpgrade(0);
 ok(G.phase==='levelup'&&doc.getElementById('lvTitle').textContent.includes('LV 3'),'두 번째 선택창 즉시 이어짐 = LV 3');
 E().chooseUpgrade(1);
 ok(G.phase==='play'&&G.exp.pending===0,'모두 선택 후 재개');}

// 6) 선택창 중 완전 정지 + 7) 재개
{const{E,doc}=load();E().startGame();quiet(E);const G=E().G;
 G.enemies=[mk('chaser',100,100,2),mk('shooter',800,500,2)];G.shots=[{x:200,y:200,vx:100,vy:0,r:5,life:3}];
 E().input.aimAngle=0;
 // 살아 있는 ECHO
 const clip=Array.from({length:240},(_,i)=>({x:300+i,y:300,a:0,atk:false,dash:false}));G.echoes.push(echoObj(clip,300,300));
 G.rec=Array.from({length:50},()=>({x:1,y:1,a:0,atk:false,dash:false}));
 E().gainXp(30);E().openLevelUp();
 ok(G.phase==='levelup','레벨업 → 일시정지 상태');
 const snap=()=>JSON.stringify([G.t,G.enemies.map(e=>[e.x,e.y,e.cd,e.wind]),G.shots.map(s=>[s.x,s.y,s.life]),G.echoes.map(e=>[e.i,e.x,e.loop]),G.rec.length,G.spawnT,G.p.x,G.p.hp,G.fx.map(f=>f.t)]);
 const s0=snap();steps(E,300);
 ok(snap()===s0,'step 300회에도 적/투사체/ECHO/녹화/타이머/이펙트 전부 정지');
 await new Promise(r=>setTimeout(r,400));           // 실제 rAF 루프가 도는 동안에도
 ok(snap()===s0,'rAF 루프 400ms 동안에도 정지');
 E().chooseUpgrade(0);
 const t0=G.t;steps(E,10);
 ok(G.phase==='play'&&G.t===t0+10&&G.echoes[0].i>0,'선택 후 정상 재개');}

// 8) ECHO 업그레이드가 살아 있는 ECHO에 즉시 적용
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // ECHO POWER
 const clip=idle(G.p.x,G.p.y);clip[0].atk=true;clip[10].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 const e=mk('chaser',G.p.x+40,G.p.y,100);G.enemies=[e];steps(E,1);const h1=e.hp;
 pick(E,'power');steps(E,10);
 ok(h1===99&&Math.abs(e.hp-(99-1.25))<1e-9,'ECHO POWER: 살아 있는 ECHO가 1 → 1.25 피해 ('+(99-e.hp)+')');
 ok(E().G.build.echoPow===1.25,'플레이어 피해는 그대로 (내 공격 1)');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // LONG REACH
 const clip=idle(G.p.x,G.p.y);for(const i of[0,10])clip[i].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 const e=mk('chaser',G.p.x+90,G.p.y,100);G.enemies=[e];e.spawn=0;
 steps(E,1);const miss=e.hp===100;pick(E,'reach');steps(E,10);
 ok(miss&&e.hp<100,'LONG REACH: 기존 ECHO 공격 사거리 증가 (전 '+miss+' / 후 hp '+e.hp+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // SHARP EDGE → ECHO 기본 공격에도
 const clip=idle(G.p.x,G.p.y);clip[0].atk=true;clip[10].atk=true;G.echoes.push(echoObj(clip,G.p.x,G.p.y));
 const e=mk('chaser',G.p.x+40,G.p.y,100);G.enemies=[e];steps(E,1);pick(E,'sharp');steps(E,10);
 ok(Math.abs(e.hp-(99-1.2))<1e-9,'SHARP EDGE: 기존 ECHO 공격 1 → 1.2 ('+(99-e.hp)+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // IMPACT → ECHO 대시 피해
 const clip=idle(100,300);for(let i=1;i<=10;i++)clip[i]={x:100+i*14,y:300,a:0,atk:false,dash:true};for(let i=11;i<240;i++)clip[i]={x:240,y:300,a:0,atk:false,dash:false};
 G.echoes.push(echoObj(clip,100,300));
 const e=mk('chaser',150,300,100);e.spawn=0;G.enemies=[e];steps(E,12);const d1=100-e.hp;
 const{E:E2}=load();E2().startGame();E2().G.spawnT=1e9;const G2=E2().G;G2.echoes.push(echoObj(clip,100,300));
 const e2=mk('chaser',150,300,100);G2.enemies=[e2];pick(E2,'impact');steps(E2,12);const d2=100-e2.hp;
 ok(d1===1&&d2===2,'IMPACT: ECHO 대시 피해 1 → 2 ('+d1+' → '+d2+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // DEEP RECORD: 살아 있는 ECHO 수명 연장
 steps(E,240);const id=G.echoes[0].id;steps(E,300);pick(E,'deep');
 steps(E,419);const alive720=G.echoes.some(e=>e.id===id);
 steps(E,240);const alive960=G.echoes.some(e=>e.id===id);
 steps(E,1);const alive961=G.echoes.some(e=>e.id===id);
 ok(alive720&&alive960===true&&alive961===false,'DEEP RECORD: 살아 있는 ECHO 반복 3→4회 (12s→16s) '+[alive720,alive960,alive961]);}
{const mkRun=(deep)=>{const{E}=load();E().startGame();quiet(E);if(deep){pick(E,'deep');pick(E,'deep')}
   E().G.p.hp=1e6;steps(E,240*5);return E().G.echoes.length};
 const a=mkRun(false),b=mkRun(true);
 ok(a===3&&b===5,'DEEP RECORD가 동시 ECHO 상한도 함께 증가: 3 → 5 (전 '+a+' / 후 '+b+')');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;                  // 상한 도달 시 가장 오래된 ECHO 교체
 G.build.echoLoops=5;G.p.hp=1e6;steps(E,240*4);
 ok(G.echoes.length===3&&!G.echoes.some(e=>e.id===1)&&G.echoes.some(e=>e.id===4),'상한 3에서 4번째 생성 시 가장 오래된 ECHO 소멸');}

// 9) 최대 중첩
{const{E}=load();E().startGame();const G=E().G;
 pick(E,'deep');pick(E,'deep');
 const avail=()=>G.build&&E().UPGRADES.filter(u=>(G.build.stacks[u.id]||0)<u.max).map(u=>u.id);
 ok(G.build.echoLoops===5&&!avail().includes('deep'),'DEEP RECORD 최대 2단계(반복 5회), 이후 선택지에서 제외');
 ok(G.build.echoMax===5,'동시 ECHO 상한도 함께 최대 5개');
 for(let i=0;i<5;i++)pick(E,'rapid');ok(Math.abs(G.build.atkCd-0.3*Math.pow(0.9,5))<1e-9&&!avail().includes('rapid'),'RAPID CUT 최대 5단계 (쿨 ×0.9씩, '+G.build.atkCd.toFixed(3)+'), 제외');
 for(let i=0;i<5;i++)pick(E,'phase');ok(Math.abs(G.build.dashCd-0.45)<1e-9&&!avail().includes('phase'),'PHASE DRIVE 최소 0.45초 ('+G.build.dashCd.toFixed(3)+'), 제외');
 for(let i=0;i<5;i++)pick(E,'sharp');ok(G.build.atkPct===100&&!avail().includes('sharp'),'SHARP EDGE 최대 5단계');
 // 선택지: 서로 다른 3개, 최대치 제외
 let dup=false,cnt=true;for(let i=0;i<200;i++){const c=E().G.exp&&(()=>{E().openLevelUp();const ch=G.levelChoices;const r=ch;G.phase='play';G.levelChoices=null;return r})();if(!c)continue;if(new Set(c.map(x=>x.id)).size!==c.length)dup=true;if(c.length!==3)cnt=false;if(c.some(x=>['deep','rapid','phase','sharp'].includes(x.id)))dup=true}
 ok(!dup&&cnt,'선택지 3개, 중복 없음, 최대치 항목 미등장 (200회)');}

// 10) 새 런 초기화
{const{E}=load();E().startGame();pick(E,'sharp');pick(E,'deep');E().gainXp(500);E().startGame();const G=E().G;
 ok(G.exp.level===1&&G.exp.xp===0&&G.exp.need===30&&G.exp.pending===0&&G.build.atkPct===0&&G.build.echoLoops===3&&Object.keys(G.build.stacks).length===0&&G.phase==='play','새 런: 레벨/XP/업그레이드 초기화');}

// 11) UI: 카드 3개, 숫자키 선택, ESC/Enter/Space로 못 닫음
{const{E,w,doc}=load();E().startGame();quiet(E);const G=E().G;E().gainXp(30);E().openLevelUp();
 ok(doc.querySelectorAll('#lvChoices .card').length===3&&!doc.getElementById('ovLevel').classList.contains('hidden'),'카드 3개 표시');
 key(w,'Escape');key(w,'Enter');key(w,'Space');key(w,'KeyW');
 ok(G.phase==='levelup'&&!doc.getElementById('ovLevel').classList.contains('hidden'),'ESC/Enter/Space/이동키로 닫히지 않음');
 const first=G.levelChoices[1].id;key(w,'Digit2');
 ok(G.phase==='play'&&G.build.stacks[first]===1&&doc.getElementById('ovLevel').classList.contains('hidden'),'2번 키 → 두 번째 업그레이드 적용 + 닫힘');
 ok(E().input.dash===false,'일시정지 중 눌린 Space 대시 입력이 남지 않음');}
{const{E,doc}=load();E().startGame();E().gainXp(30);E().openLevelUp();       // 클릭 선택
 const first=E().G.levelChoices[0].id;doc.querySelector('#lvChoices .card').click();
 ok(E().G.phase==='play'&&E().G.build.stacks[first]===1,'카드 클릭으로 선택');}

// 12) HUD 렌더 예외 없음 + 랜덤 시뮬 (XP 정합성)
{const{E,errs}=load();let bad=0,levelups=0,maxLv=0;
 for(let run=0;run<25;run++){
  E().startGame();const G0=E().G;G0.p.hp=1e6;
  const keys=['KeyW','KeyA','KeyS','KeyD'];
  for(let t=0;t<3600;t++){
    if(t%30===0){for(const k of keys)E().keys.delete(k);E().keys.add(keys[Math.floor(Math.random()*4)])}
    E().input.atk=true;E().input.aimAngle=(t/40)%6.28;if(t%97===0)E().input.dash=true;
    E().step();
    const G=E().G;
    if(G.phase==='levelup'){levelups++;E().chooseUpgrade(Math.floor(Math.random()*G.levelChoices.length))}
    if(t%50===0)E().render();
    const total=(()=>{let x=G.exp.xp,n=30;for(let l=1;l<G.exp.level;l++){x+=n;n=Math.round(n*1.4)}return x})();
    if(total<10*G.stats.kills||total>25*G.stats.kills)bad++;
    if(G.phase!=='play')break;
  }
  maxLv=Math.max(maxLv,E().G.exp.level);
 }
 ok(errs.length===0,'랜덤 시뮬 25판 예외 없음 '+errs.slice(0,2));
 ok(bad===0,'누적 XP가 (처치×10 ~ 처치×15) 범위 안 = 중복 지급 없음 (위반 '+bad+')');
 console.log('   레벨업 총 '+levelups+'회, 최고 레벨 LV '+maxLv);}
console.log(fails?('FAILS: '+fails):'ALL PASS 2.1');
process.exit(fails?1:0);
})();
