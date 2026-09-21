// 일반 구간 자동 시뮬레이션 (크래시/NaN/상한/XP 정합성 + 적 조합/PHASE 전환 통계). v2.6: 런 앞 120초 구간을 반복 검사한다. 사용: node sim/sim_survive.js [N=100]
const {load}=require('../harness');const {SURVIVE,pickRandom}=require('../bots');
const N=+(process.argv[2]||process.env.N||150);      // N쌍 = 2N판 (무적/사망 가능 각 N판)
const o=load();const E=o.E;const names=Object.keys(SURVIVE);
const XPV={chaser:10,shooter:15,phase:18,warden:25};
const agg={games:0,reachBoss:0,dead:0,nan:0,bad:[],peak:{total:0,warden:0,phase:0,shooter:0},xpMismatch:0,levelups:0,
  spawn:[{},{},{},{}],killBy:{},phaseSwitch:0,phaseTrackTicks:{echo:0,player:0},shieldBlocked:{player:0,echo:0},wardenHit:{player:0,echo:0},phaseCollisions:0,byPolicy:{},elite:{spawned:{lock:0,relay:0},kills:{chaser:0,shooter:0},syncBreaks:0,relayBursts:0,relayKills:0,xpBonus:0,capBad:0,stateBad:0,leftover:0,gamesWithElite:0}};
const fin=(...a)=>a.every(Number.isFinite);
const prev=new WeakMap();
function run(pol,immortal,noise){
  E().startGame();const G0=E().G;if(immortal)G0.p.hp=1e6;
  for(let t=0;t<7200;t++){
    const G=E().G;if(G.phase==='dead'||G.phase==='win'||G.stage==='boss'||G.stage==='intro')break;
    if(G.stage==='shift'){E().step();continue}
    if(G.phase==='levelup'){agg.levelups++;pickRandom(E,G);t--;continue}
    if(Math.random()<noise){SURVIVE.stand(E,G,t)}else SURVIVE[pol](E,G,t);
    E().step();const g=E().G;
    const c={total:g.enemies.length,warden:0,phase:0,shooter:0};
    for(const e of g.enemies){
      if(e.type in c)c[e.type]++;
      if(!fin(e.x,e.y,e.hp,e.face,e.kx,e.ky,e.stun||0,e.collideCd||0))agg.nan++;
      if(e.type==='phase'){const pt=prev.get(e);const cur=e.tgt?1:0;if(pt!==undefined&&pt!==cur)agg.phaseSwitch++;prev.set(e,cur)}
    }
    if(!fin(g.p.x,g.p.y,g.p.hp,g.exp.xp,g.exp.need))agg.nan++;
    for(const k of Object.keys(agg.peak))agg.peak[k]=Math.max(agg.peak[k],c[k]);
    if(c.total>30||c.warden>3||c.phase>5||c.shooter>8)agg.bad.push(JSON.stringify(c)+' t='+t);
    // ELITE 상한/상태: 20초 전 0기, 20~40초 최대 1기, 40초~ 최대 2기 / 특성 배타 / 보호막 상태 일관성 / 종류 제한
    const ne=E().eliteCount(),sec=g.t/60;
    if((sec<20&&ne>0)||(sec<40&&ne>1)||ne>2)agg.elite.capBad++;
    for(const e of g.enemies){if(!e.elite)continue;const el=e.elite;
      const badState=!(el.trait==='lock'||el.trait==='relay')||(e.type!=='chaser'&&e.type!=='shooter')||!fin(el.brk,el.prot,el.stag,e.hp,e.x,e.y)||el.brk<0||el.prot<0||el.stag<0||e.hp>e.maxHp+1e-9
        ||(el.trait==='lock'?(el.shield?el.brk!==0:(el.brk<=0||el.prot>0)):(!el.shield&&false));
      if(badState)agg.elite.stateBad++}
    if(t%120===0)E().render();
  }
  const G=E().G,tel=G.stats.tel;agg.games++;
  if((G.stage==='boss'||G.stage==='intro')&&(G.enemies.some(e=>e.elite)||G.fx.some(f=>f.elite)||E().eliteCount()>0))agg.elite.leftover++;   // 보스 진입 후 ELITE 잔존 검사
  {const te=tel.elite;agg.elite.spawned.lock+=te.spawned.lock;agg.elite.spawned.relay+=te.spawned.relay;agg.elite.kills.chaser+=te.kills.chaser;agg.elite.kills.shooter+=te.kills.shooter;agg.elite.syncBreaks+=te.syncBreaks;agg.elite.relayBursts+=te.relayBursts;agg.elite.relayKills+=te.relayKills;agg.elite.xpBonus+=te.xpBonus;if(te.spawned.lock+te.spawned.relay>0)agg.elite.gamesWithElite++}if(G.stage==='boss'||G.stage==='intro')agg.reachBoss++;if(G.phase==='dead')agg.dead++;
  for(let b=0;b<4;b++)for(const k of Object.keys(tel.spawn[b]))agg.spawn[b][k]=(agg.spawn[b][k]||0)+tel.spawn[b][k];
  let xp=0;for(const ty of Object.keys(tel.killBy)){agg.killBy[ty]=agg.killBy[ty]||{player:0,echo:0};for(const s of['player','echo']){agg.killBy[ty][s]+=tel.killBy[ty][s];xp+=tel.killBy[ty][s]*XPV[ty]}}
  agg.phaseTrackTicks.echo+=tel.phaseEchoTicks;agg.phaseTrackTicks.player+=tel.phasePlayerTicks;agg.phaseCollisions+=tel.phaseCollisions;
  for(const s of['player','echo']){agg.shieldBlocked[s]+=tel.shieldBlocked[s];agg.wardenHit[s]+=tel.wardenHit[s]}
  let total=G.exp.xp,n=30;for(let l=1;l<G.exp.level;l++){total+=n;n=Math.round(n*1.4)}
  xp+=tel.elite.xpBonus;                          // ELITE XP x2 (추가분)
  if(total!==xp)agg.xpMismatch++;
}
for(let i=0;i<N;i++){const pol=names[i%names.length];run(pol,true,0.05);run(pol,false,0.05)}
const pc=(x,y)=>y?(100*x/y).toFixed(0)+'%':'-';
const ae=agg.elite;console.log('ELITE: 생성 lock '+ae.spawned.lock+' / relay '+ae.spawned.relay+' (ELITE가 나온 판 '+ae.gamesWithElite+'/'+agg.games+', 판당 '+((ae.spawned.lock+ae.spawned.relay)/agg.games).toFixed(2)+'기), 처치 chaser '+ae.kills.chaser+' / shooter '+ae.kills.shooter+', SYNC BREAK '+ae.syncBreaks+', RELAY BURST '+ae.relayBursts+' (주변 처치 '+ae.relayKills+'), XP 보너스 '+ae.xpBonus+' | 상한위반 '+ae.capBad+' 상태오류 '+ae.stateBad+' 보스진입후 잔존 '+ae.leftover);
console.log('게임',agg.games,'| 120초 생존(무적+일반 합)',agg.games-agg.dead,'사망',agg.dead,'| 예외',o.errs.length,'NaN',agg.nan,'상한위반',agg.bad.length,'XP불일치',agg.xpMismatch);
console.log('동시 최대(관측)',JSON.stringify(agg.peak),'레벨업',agg.levelups);
agg.spawn.forEach((b,i)=>{const s=Object.values(b).reduce((x,y)=>x+y,0);console.log(['0~45','45~90','90~150','150~210','210~255','255~300'][i]+'초 스폰 '+Object.entries(b).map(([k,v])=>k+' '+pc(v,s)).join(' / '))});
console.log('PHASE HUNTER: 추적 틱 ECHO '+agg.phaseTrackTicks.echo+' / 플레이어 '+agg.phaseTrackTicks.player+' (ECHO 비율 '+pc(agg.phaseTrackTicks.echo,agg.phaseTrackTicks.echo+agg.phaseTrackTicks.player)+'), 대상 전환 '+agg.phaseSwitch+'회 (판당 '+(agg.phaseSwitch/agg.games).toFixed(1)+'), 충돌 판당 '+(agg.phaseCollisions/agg.games).toFixed(1));
for(const [k,v] of Object.entries(agg.killBy))console.log(k.padEnd(8),'처치 플레이어/ECHO',v.player+'/'+v.echo,'ECHO '+pc(v.echo,v.player+v.echo));
require('fs').mkdirSync(require('path').join(__dirname,'out'),{recursive:true});
require('fs').writeFileSync(require('path').join(__dirname,'out','survive_report.json'),JSON.stringify(agg,null,1));
process.exit(o.errs.length||agg.nan||agg.bad.length||agg.xpMismatch||agg.elite.capBad||agg.elite.stateBad||agg.elite.leftover?1:0);
