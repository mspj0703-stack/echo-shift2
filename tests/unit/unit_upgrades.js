// v2.3.1 SHARP EDGE 재설계 검증: 스택당 기본 공격 피해 +20%, 플레이어/ECHO 모두, 대시 제외, 최대 4스택
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const near=(a,b)=>Math.abs(a-b)<1e-9;
function fresh(){const o=load();o.E().startGame();const G=o.E().G;G.spawnT=1e9;G.enemies=[];G.echoes=[];return{...o,G}}
function pick(o,id){const u=o.E().UPGRADES.find(x=>x.id===id);o.G.phase='levelup';o.G.levelChoices=[u];o.G.exp.pending=1;o.E().chooseUpgrade(0)}
const dummy=(o,x,y)=>{const e=o.E().makeEnemy('chaser',x,y);e.spawn=0;e.hp=e.maxHp=1000;o.G.enemies=[e];return e};
const slashDmg=(o,src)=>{const e=dummy(o,500,300);const before=e.hp;o.E().slash({x:460,y:300},0,src);return before-e.hp};
{const o=fresh();const exp=[1,1.2,1.4,1.6,1.8];     // v2.5.1: 최대 4스택
 t(near(slashDmg(o,'player'),1),'SHARP 0스택: 기본 공격 피해 1');
 for(let n=1;n<=4;n++){pick(o,'sharp');const d=slashDmg(o,'player');t(near(d,exp[n]),'SHARP '+n+'스택: 플레이어 기본 공격 '+exp[n]+' (실측 '+d+')')}
 t(o.E().G.build.stacks.sharp===4&&!o.E().UPGRADES.filter(u=>(o.G.build.stacks[u.id]||0)<u.max).some(u=>u.id==='sharp'),'SHARP 최대 4스택 (이후 후보에서 제외)');}
{const o=fresh();for(let n=1;n<=4;n++){pick(o,'sharp');const d=slashDmg(o,'echo');t(near(d,1+0.2*n),'SHARP '+n+'스택: ECHO 기본 공격도 동일 '+(1+0.2*n)+' (실측 '+d+')')}
 pick(o,'power');t(near(slashDmg(o,'echo'),1.8*1.25),'SHARP 4스택 + ECHO POWER 1: ECHO 피해 1.8×1.25 (배율은 곱)');
 t(near(slashDmg(o,'player'),1.8),'ECHO POWER는 플레이어 공격에 영향 없음');}
{const o=fresh();const dash=src=>{const e=dummy(o,500,300);const a={x:490,y:300,r:11,dashAng:0,dashHit:new Set()};const b=e.hp;o.E().dashDamage(a,src);return b-e.hp};
 const d0=dash('player');for(let n=1;n<=4;n++)pick(o,'sharp');
 t(near(d0,1)&&near(dash('player'),1)&&near(dash('echo'),1),'SHARP는 대시 피해에 영향 없음 (플레이어/ECHO 대시 모두 1)');
 pick(o,'impact');t(near(dash('player'),2),'대시 피해는 IMPACT만 영향 (1→2)');}
{const o=fresh();const u=o.E().UPGRADES.find(x=>x.id==='sharp');const d0=u.desc(o.G.build);pick(o,'sharp');
 t(d0.includes('+20%')&&u.max===4,'UI 설명에 "+20%" 표시, max 4 ('+d0+')');}
// 실제 게임 경로: 플레이어 공격 + 재생 ECHO 공격 (내부 피해는 소수)
{const o=fresh();const{E,G}=o;pick(o,'sharp');pick(o,'sharp');pick(o,'sharp');
 const e=dummy(o,G.p.x+45,G.p.y);E().input.aimAngle=0;E().input.atk=true;steps(E,1);E().input.atk=false;
 t(near(1000-e.hp,1.6),'실제 플레이어 slash 경로: 3스택 1.6 ('+(1000-e.hp)+')');
 t(E().G.stats.tel.dmgDealt.player>1.59&&E().G.stats.tel.dmgDealt.player<1.61,'피해 텔레메트리(dmgDealt) 정확');}
process.exit(summary(S,'unit_upgrades')?0:1);
