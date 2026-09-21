// v2.4: PHASE TRAIL / RESONANCE / PHASE MARK / FEEDBACK LOOP / 피해 이벤트 추적 / 조정된 업그레이드 / 보스 연동
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-9);
const idle=(x,y,n=240)=>Array.from({length:n},()=>({x,y,a:0,atk:false,dash:false}));
const echoObj=(clip,x,y)=>({id:9,clip,i:0,loop:0,x,y,a:0,dashing:false,dashAng:0,dashHit:new Set(),r:11,trail:null});
function fresh(){const o=load();const E=o.E;E().startGame();const G=E().G;G.spawnT=1e9;G.enemies=[];G.echoes=[];G.p.hp=1e6;G.p.x=100;G.p.y=550;E().CFG.chaser.speed=0;return{...o,G}}
function pick(o,id,n=1){for(let i=0;i<n;i++){const u=o.E().UPGRADES.find(x=>x.id===id);o.G.phase='levelup';o.G.levelChoices=[u];o.G.exp.pending=1;o.E().chooseUpgrade(0)}}
const dummy=(o,x,y,hp=1000)=>{const e=o.E().makeEnemy('chaser',x,y);e.spawn=0;e.hp=e.maxHp=hp;e.ox=x;e.oy=y;o.G.enemies.push(e);return e};
const reset=o=>{for(const e of o.G.enemies){if(e.ox!==undefined){e.x=e.ox;e.y=e.oy;e.kx=e.ky=0}}};   // 넉백으로 사거리를 벗어나지 않게 제자리 복귀
const P=(o,x,y)=>{reset(o);return o.E().slash({x:x-40,y},0,'player')},EC=(o,x,y)=>{reset(o);return o.E().slash({x:x-40,y},0,'echo')};
const dashActor=(x,y)=>({x,y,r:11,dashAng:0,dashHit:new Set()});
const PD=(o)=>{reset(o);o.E().dashDamage(dashActor(290,300),'player')},ED=(o)=>{reset(o);o.E().dashDamage(dashActor(290,300),'echo')};

// ================= 정리된 기존 업그레이드 =================
{const o=fresh();pick(o,'reach',4);const b=o.G.build;const av=o.E().UPGRADES.filter(u=>(b.stacks[u.id]||0)<u.max).map(u=>u.id);
 t(near(b.atkRangeMul,1.4)&&!av.includes('reach')&&o.E().UPGRADES.find(u=>u.id==='reach').max===4,'LONG REACH: 스택당 +10%, 최대 4스택 (사거리 70 → 98)');
 const o2=fresh();const e=dummy(o2,300+70+11+25,300);t(o2.E().slash({x:300,y:300},0,'player')===0,'   LONG REACH 0스택: 사거리 밖 (106+)');pick(o2,'reach',4);t(o2.E().slash({x:300,y:300},0,'player')===1,'   4스택 사거리 98 → 명중 (플레이어/ECHO 공통 함수)');}
{const o=fresh();pick(o,'rapid',5);const b=o.G.build;t(near(b.atkCd,0.3*Math.pow(0.9,5))&&!o.E().UPGRADES.filter(u=>(b.stacks[u.id]||0)<u.max).some(u=>u.id==='rapid')&&b.atkCd>=0.15,'RAPID CUT: 최대 5스택, 효과 ×0.9 유지, 최소 0.15초 이상');
 const o1=fresh();pick(o1,'rapid',1);t(near(o1.G.build.atkCd,0.27),'   RAPID CUT 1스택 효과 그대로 (0.30 → 0.27)');}
{const o=fresh();const U=o.E().UPGRADES;const cats={};for(const u of U)(cats[u.cat]=cats[u.cat]||[]).push(u.id);
 t(U.length===11&&cats['공격'].join()==='sharp,rapid,reach'&&cats['ECHO'].join()==='deep,power,resonance'&&cats['대시'].join()==='phase,impact,trail'&&cats['HYBRID'].join()==='mark,feedback'&&!U.some(u=>u.id==='longshift'),'업그레이드 풀 11개 (공격3/ECHO3/대시3/HYBRID2), LONG SHIFT 제거');
 let dup=false,bad=false;for(let i=0;i<400;i++){if(i%40===0){o.G.build.stacks={};}o.G.exp.pending=1;o.E().openLevelUp();const ch=o.G.levelChoices;o.G.phase='play';if(!ch)continue;if(new Set(ch.map(c=>c.id)).size!==ch.length||ch.length!==3)dup=true;
   if(ch.some(c=>(o.G.build.stacks[c.id]||0)>=c.max))bad=true}
 t(!dup&&!bad,'선택지 3개, 중복 없음 (400회)');
 o.G.build.stacks={trail:3,mark:3,reach:4};let leak=false;for(let i=0;i<200;i++){o.G.exp.pending=1;o.E().openLevelUp();if(o.G.levelChoices.some(c=>['trail','mark','reach'].includes(c.id)))leak=true;o.G.phase='play'}
 t(!leak,'최대 스택 업그레이드는 선택지에서 제외');}

// ================= PHASE TRAIL =================
{const o=fresh();const{E,G}=o;pick(o,'trail');G.p.x=200;G.p.y=300;E().keys.add('KeyD');E().input.dash=true;steps(E,4);
 t(G.trails.length===1&&G.trails[0].src==='player'&&G.trails[0].segs.length>=2,'TRAIL: 플레이어 대시 → 트레일 생성 (조각 '+(G.trails[0]&&G.trails[0].segs.length)+')');
 E().keys.delete('KeyD');steps(E,10);const trailsAfterDash=G.trails.length;
 t(trailsAfterDash===1&&G.p.hp===1e6,'   트레일은 플레이어에게 피해 없음, 대시 후에도 유지');
 // 대시가 끝난 뒤 트레일 위에 나타난 적: 정확히 1회 피해
 const xs=G.trails[0].segs.map(s=>s.x2);const mid=(Math.min(...xs)+Math.max(...xs))/2;
 const e=dummy(o,mid,300,100);steps(E,1);const d1=100-e.hp;steps(E,40);t(near(d1,1)&&near(100-e.hp,1),'   같은 트레일에서 같은 적은 1회만 피해 (1스택 1.0, 이후 추가 없음)');
 t(G.dmgLog.some(l=>l.kind==='trail'&&l.src==='player'&&l.id===e.id&&near(l.dmg,1)),'   피해 이벤트에 source=PLAYER, kind=trail, 적 id 기록');}
{const o=fresh();const{E,G}=o;pick(o,'trail');G.p.x=100;G.p.y=550;
 const clip=idle(300,300);for(let i=1;i<=10;i++)clip[i]={x:300+i*14,y:300,a:0,atk:false,dash:true};for(let i=11;i<240;i++)clip[i]={x:440,y:300,a:0,atk:false,dash:false};
 G.echoes.push(echoObj(clip,300,300));steps(E,6);
 t(G.trails.length===1&&G.trails[0].src==='echo','TRAIL: ECHO 대시도 트레일 생성 (src=ECHO)');
 steps(E,8);const e=dummy(o,370,300,100);steps(E,1);t(near(100-e.hp,1)&&G.dmgLog.some(l=>l.kind==='trail'&&l.src==='echo'),'   ECHO 트레일 위 적: 1 피해, source=ECHO');}
{const o=fresh();const{E,G}=o;pick(o,'trail');G.p.x=200;G.p.y=300;E().keys.add('KeyD');E().input.dash=true;steps(E,11);E().keys.delete('KeyD');
 // v2.5: 트레일 지속시간 1.2초 → 0.8초 (마지막 조각 생성 후 48틱 뒤 소멸)
 let alive=-1;for(let i=1;i<=100;i++){steps(E,1);if(G.trails.length===0){alive=i;break}}
 const last=null;t(alive>=46&&alive<=50&&E().SYN.trailTtl===48,'TRAIL: 지속시간 0.8초(≈48틱) 후 소멸 ('+alive+'틱 후)');
 const e=dummy(o,300,300,100);steps(E,5);t(e.hp===100,'   소멸 후에는 피해 없음');}
{const res=[];for(const n of[1,2,3]){const o=fresh();const{E,G}=o;pick(o,'trail',n);G.p.x=200;G.p.y=300;E().keys.add('KeyD');E().input.dash=true;steps(E,12);E().keys.delete('KeyD');
   const xs=G.trails[0].segs.map(s=>s.x2);const e=dummy(o,(Math.min(...xs)+Math.max(...xs))/2,300,100);steps(E,1);res.push(100-e.hp)}
 t(near(res[0],1)&&near(res[1],1.5)&&near(res[2],2),'TRAIL: 스택별 피해 1 / 1.5 / 2 ('+res+')');
 const o=fresh();const{E,G}=o;pick(o,'trail');const clip=idle(300,300);for(let i=1;i<=10;i++)clip[i]={x:300+i*14,y:300,a:0,atk:false,dash:true};for(let i=11;i<240;i++)clip[i]={x:440,y:300,a:0,atk:false,dash:false};
 G.echoes.push(echoObj(clip,300,300));steps(E,12);pick(o,'trail',2);const e=dummy(o,370,300,100);steps(E,1);
 t(near(100-e.hp,2),'   이미 존재하는 ECHO의 트레일에도 현재 스택 즉시 적용 (3스택 → 2.0)');}
// 트레일이 없는 빌드는 생성 안 함
{const o=fresh();const{E,G}=o;G.p.x=200;G.p.y=300;E().keys.add('KeyD');E().input.dash=true;steps(E,14);t(G.trails.length===0,'TRAIL 미보유 시 트레일 없음');}

// ================= RESONANCE =================
function reson(order,gap,stacks){
  const o=fresh();pick(o,'resonance',stacks||1);const e=dummy(o,500,300);
  const f={P:()=>P(o,500,300),E:()=>EC(o,500,300)};
  f[order[0]]();steps(o.E,gap);f[order[1]]();
  return{o,e,loss:1000-e.hp,syn:o.G.stats.tel.syn.resonance};
}
{let r=reson('PE',30);t(near(r.loss,3)&&r.syn===1,'RESONANCE: PLAYER → ECHO 0.5초: 기본 1+1 + 추가 피해 1 발동 (총 '+r.loss+')');
 t(r.o.G.dmgLog.some(l=>l.kind==='resonance'&&l.src==='echo'&&near(l.dmg,1)),'   추가 피해 이벤트(kind=resonance) 기록');
 r=reson('EP',30);t(near(r.loss,3)&&r.syn===1,'RESONANCE: ECHO → PLAYER 발동');
 r=reson('PP',20);t(near(r.loss,2)&&r.syn===0,'RESONANCE: PLAYER → PLAYER 미발동 (기본 피해 2만)');
 r=reson('EE',20);t(near(r.loss,2)&&r.syn===0,'RESONANCE: ECHO → ECHO 미발동');
 r=reson('PE',48);t(r.syn===1,'RESONANCE: 정확히 0.8초(48틱) → 발동');
 r=reson('PE',49);t(r.syn===0&&near(r.loss,2),'RESONANCE: 0.8초 초과(49틱) → 미발동');
 const rs=[1,2,3].map(n=>reson('PE',10,n).loss-2);t(near(rs[0],1)&&near(rs[1],1.5)&&near(rs[2],2),'RESONANCE: 스택별 추가 피해 1 / 1.5 / 2 ('+rs+')');}
{// 내부 쿨다운 0.8초
 const o=fresh();pick(o,'resonance',1);const e=dummy(o,500,300);const{E,G}=o;
 P(o,500,300);steps(E,5);EC(o,500,300);const n1=G.stats.tel.syn.resonance;         // 발동 #1
 steps(E,5);P(o,500,300);const n2=G.stats.tel.syn.resonance;                       // 쿨다운 중 (반대 주체가 다시 맞혀도 X)
 steps(E,20);EC(o,500,300);const n3=G.stats.tel.syn.resonance;                     // 여전히 쿨 (발동 후 30틱)
 steps(E,30);P(o,500,300);const n4=G.stats.tel.syn.resonance;                      // 발동 후 60틱: 쿨 종료 + 반대 주체(echo) 마지막 타격이 30틱 전 → 발동
 t(n1===1&&n2===1&&n3===1&&n4===2,'RESONANCE: 적별 내부 쿨다운 0.8초 ('+[n1,n2,n3,n4]+')');
 // 적별 독립
 const o2=fresh();pick(o2,'resonance',1);const a=dummy(o2,500,300),b=dummy(o2,520,300);P(o2,510,300);EC(o2,510,300);
 t(o2.G.stats.tel.syn.resonance===2,'   쿨다운은 적별 (두 적 각각 발동)');}
{// 추가 피해로 처치해도 XP는 1회
 const o=fresh();pick(o,'resonance',1);const e=dummy(o,500,300,2.5);const x0=o.G.exp.xp;P(o,500,300);EC(o,500,300);
 t(e.dead&&o.G.exp.xp-x0===10&&o.G.stats.kills===1,'RESONANCE 추가 피해로 처치: 처치/XP 정확히 1회');}

// ================= PHASE MARK =================
{const stacks=[1,2,3];const res=[];
 for(const n of stacks){const o=fresh();pick(o,'mark',n);const e=dummy(o,290,300);PD(o);const l1=1000-e.hp;EC(o,290,300);res.push(1000-e.hp-l1-1)}
 t(near(res[0],2)&&near(res[1],3)&&near(res[2],4),'MARK: PLAYER DASH → ECHO 공격, 스택별 추가 피해 2 / 3 / 4 ('+res+')');}
{const o=fresh();pick(o,'mark',1);const e=dummy(o,290,300);ED(o);const l1=1000-e.hp;P(o,290,300);
 t(near(1000-e.hp-l1,1+2)&&o.G.dmgLog.some(l=>l.kind==='mark'&&l.src==='player'&&near(l.dmg,2)),'MARK: ECHO DASH → PLAYER 공격: 추가 피해 2 (소스=PLAYER)');}
{const o=fresh();pick(o,'mark',1);const e=dummy(o,290,300);PD(o);const l1=1000-e.hp;P(o,290,300);const same=1000-e.hp-l1;
 t(near(same,1)&&!!o.E().G.enemies[0].syn.mark,'MARK: 같은 소스(PLAYER→PLAYER)는 자신의 마크를 소비 못 함 (마크 유지)');
 EC(o,290,300);t(near(1000-e.hp-l1-same,1+2),'   이후 반대 주체(ECHO)가 소비 → +2');
 const before=1000-e.hp;EC(o,290,300);t(near(1000-e.hp-before,1),'   소비 후 재소비 불가');}
{const o=fresh();pick(o,'mark',1);const e=dummy(o,290,300);PD(o);steps(o.E,119);const l=1000-e.hp;EC(o,290,300);const a=1000-e.hp-l;
 const o2=fresh();pick(o2,'mark',1);const e2=dummy(o2,290,300);PD(o2);steps(o2.E,120);const l2=1000-e2.hp;EC(o2,290,300);const b=1000-e2.hp-l2;
 t(near(a,3)&&near(b,1),'MARK: 2초(120틱) 후 만료 (119틱 → 소비 +2 / 120틱 → 소비 불가)');}
{const o=fresh();pick(o,'mark',1);const e=dummy(o,290,300);EC(o,290,300);const b=1000-e.hp;P(o,290,300);
 t(near(1000-e.hp-b,1),'MARK: 일반 공격은 마크를 만들지 않음 (DASH만 부여)');}

// ================= FEEDBACK LOOP =================
{const res=[];for(const n of[1,2,3]){const o=fresh();pick(o,'feedback',n);dummy(o,500,300);o.G.p.dashCd=1.0;EC(o,500,300);res.push(1.0-o.G.p.dashCd)}
 t(near(res[0],.08)&&near(res[1],.12)&&near(res[2],.16),'FEEDBACK: ECHO 피해 시 대시 쿨 감소 스택별 0.08 / 0.12 / 0.16 ('+res.map(x=>x.toFixed(2))+')');}
{const o=fresh();pick(o,'feedback',3);dummy(o,500,300);o.G.p.dashCd=1.0;P(o,500,300);t(o.G.p.dashCd===1.0,'FEEDBACK: PLAYER 피해로는 감소하지 않음');}
{const o=fresh();pick(o,'feedback',3);for(let i=0;i<10;i++)dummy(o,500+i*2,300);o.G.p.dashCd=1.0;EC(o,510,300);
 t(near(1.0-o.G.p.dashCd,0.32),'FEEDBACK: 한 프레임에 10기를 맞혀도 최대 0.32초 ('+(1-o.G.p.dashCd).toFixed(2)+')');
 EC(o,510,300);t(near(1.0-o.G.p.dashCd,0.32),'   같은 프레임 추가 타격은 더 감소하지 않음');
 o.G.p.dashCd=1;steps(o.E,1);const cd=o.G.p.dashCd;EC(o,510,300);t(cd-o.G.p.dashCd>0.15,'   다음 프레임에는 다시 감소 가능');}
{const o=fresh();pick(o,'feedback',3);dummy(o,500,300);o.G.p.dashCd=0.05;EC(o,500,300);t(o.G.p.dashCd===0,'FEEDBACK: 대시 쿨다운은 0 미만으로 내려가지 않음');}
{const o=fresh();pick(o,'feedback',3);pick(o,'resonance',1);dummy(o,500,300);P(o,500,300);o.G.p.dashCd=1;const h0=o.G.stats.tel.syn.fbHits;EC(o,500,300);
 t(o.G.stats.tel.syn.fbHits-h0===1&&near(1-o.G.p.dashCd,0.16),'FEEDBACK: 시너지 추가 피해(RESONANCE)는 재발동하지 않음 (실제 타격 1회만)');}
{const o=fresh();pick(o,'feedback',3);const e=dummy(o,500,300);o.G.p.dashCd=1;o.E().hitEnemy(e,1,'echo',0,.5,undefined,'collision');t(o.G.p.dashCd===1,'FEEDBACK/시너지: PHASE COLLISION(collision)은 대상 아님');}

// ================= 피해 이벤트 =================
{const o=fresh();pick(o,'resonance',1);pick(o,'mark',1);const e=dummy(o,290,300);PD(o);EC(o,290,300);P(o,290,300);
 const tel=o.G.stats.tel;const sum=Object.values(tel.dmg.player).reduce((a,b)=>a+b,0)+Object.values(tel.dmg.echo).reduce((a,b)=>a+b,0);
 t(near(sum,tel.dmgDealt.player+tel.dmgDealt.echo)&&near(sum,1000-e.hp),'피해 이벤트: source×kind 합계 = 총 피해 = 적 HP 감소 ('+sum.toFixed(1)+')');
 t(o.G.dmgLog.every(l=>('t'in l)&&('src'in l)&&('kind'in l)&&('id'in l)&&('dmg'in l))&&o.G.dmgLog.some(l=>l.kind==='dash')&&o.G.dmgLog.some(l=>l.kind==='basic'),'   이벤트 필드: t / src / kind / id / dmg');}

// ================= 보스 연동 =================
function bossFight(){const o=load();const E=o.E;E().debugStartBoss({});const G=E().G;E().BOSS.speed=0;G.spawnT=1e9;G.p.hp=1e6;G.p.x=480;G.p.y=540;const b=G.boss;b.x=480;b.y=200;b.gap=1e9;return{...o,G,b}}
{const o=bossFight();const{E,G,b}=o;pick(o,'resonance',1);
 E().hitBoss(b,1,'player',0);E().hitBoss(b,1,'echo',0,'resonance');
 t(b.breaks===0&&G.stats.tel.boss.hits.echo===0,'보스: 시너지 추가 피해(kind=resonance)는 SYNC 적중으로 세지 않음 (breaks 0, ECHO hits 0)');
 E().hitBoss(b,1,'echo',0);t(b.breaks===1&&G.stats.tel.boss.hits.echo===1,'   실제 ECHO 공격이 들어오면 SYNC BREAK (기존 규칙 그대로)');}
{const o=bossFight();const{E,G,b}=o;pick(o,'resonance',1);
 E().hitBoss(b,1,'player',0);steps(E,10);const hp0=b.hp;E().hitBoss(b,1,'echo',0);
 // 이 ECHO 타격이 SYNC BREAK를 일으킨 뒤, 같은 타격의 RESONANCE 추가 피해는 이미 취약/방패 상태와 무관하게 별도 계산
 const bt=G.stats.tel.boss;
 t(b.breaks===1&&bt.hits.player===1&&bt.hits.echo===1&&(bt.dmgBoss?true:true)&&G.stats.tel.dmgBoss.echo.resonance>0,'보스: RESONANCE 정상 적용 + SYNC는 실제 타격 2회만 계산');
 t(b.hp<hp0-0.19,'   보스 HP에 추가 피해 반영 ('+(hp0-b.hp).toFixed(2)+')');}
{const o=bossFight();const{E,G,b}=o;pick(o,'resonance',1);
 // 방패 상태에서는 추가 피해도 80% 감소
 E().hitBoss(b,1,'player',0);steps(E,80);const h=b.hp;E().hitBoss(b,1,'echo',0);   // 80틱 → RESONANCE 창(48) 밖 & SYNC 창(75) 밖
 t(near(h-b.hp,0.2)&&G.stats.tel.syn.resonance===0,'보스: 창 밖이면 RESONANCE/SYNC 모두 미발동 (방패 피해 0.2)');}
{const o=bossFight();const{E,G,b}=o;pick(o,'feedback',2);G.p.dashCd=1;E().hitBoss(b,1,'echo',0);t(near(1-G.p.dashCd,0.12),'보스: FEEDBACK LOOP 보스 타격에도 적용');}
{const o=bossFight();const{E,G,b}=o;pick(o,'mark',1);b.shield=false;b.vuln=300;
 E().hitBoss(b,1,'player',0,'dash');const h=b.hp;E().hitBoss(b,1,'echo',0);t(near(h-b.hp,1+2),'보스: PHASE MARK 마크 소비 (취약 중 1 + 2)');}
{const o=bossFight();const{E,G,b}=o;pick(o,'trail');G.p.x=480;G.p.y=330;E().keys.add('KeyW');E().input.dash=true;steps(E,14);E().keys.delete('KeyW');
 t(G.stats.tel.dmgBoss.player.trail>0||G.stats.tel.dmgBoss.player.dash>0,'보스: 대시/트레일 피해 적용 (dash '+(G.stats.tel.dmgBoss.player.dash||0).toFixed(2)+', trail '+(G.stats.tel.dmgBoss.player.trail||0).toFixed(2)+')');}
process.exit(summary(S,'unit_synergy')?0:1);
