/* ================= SPAWN TABLE ================= */
// v2.6: 구간별 스폰 표. 난도 상승 우선순위는 (1)조합 다양화 (2)ELITE 빈도 (3)PHASE HUNTER/WARDEN 비중 (4)스폰 속도.
const SPAWN_BANDS=[
  {chaser:72,shooter:28},                              //   0~45초  PHASE 1 전반: 기본 조작/첫 ECHO
  {chaser:58,shooter:30,phase:12},                     //  45~90초  PHASE 1 후반: PHASE HUNTER 소량
  {chaser:42,shooter:28,phase:20,warden:10},           //  90~150초 PHASE 2 전반: 전 종류 등장
  {chaser:35,shooter:28,phase:23,warden:14},           // 150~210초 PHASE 2 후반 (v2.6.1: WARDEN 18→14, 압박을 SHOOTER/PHASE로 이동)
  {chaser:29,shooter:27,phase:28,warden:16},           // 210~255초 PHASE 3 (v2.6.1: WARDEN 22→16)
  {chaser:25,shooter:27,phase:30,warden:18}            // 255~300초 PHASE 3 후반 (v2.6.1: WARDEN 26→18, PHASE HUNTER 30)
];
const bandOf=tSec=>tSec<45?0:tSec<90?1:tSec<150?2:tSec<210?3:tSec<255?4:5;
const phaseOf=tSec=>RUN.phases.find(p=>tSec>=p.from&&tSec<p.to)||RUN.phases[RUN.phases.length-1];
const runSec=()=>G.runT/60;                             // 런 타이머(구간 전환 중에는 멈춘다)
const NAMES={chaser:'추격자',shooter:'사격 적',phase:'PHASE HUNTER',warden:'WARDEN'};
const KILL_COLOR={chaser:'#ff6b6b',shooter:'#ffb547',phase:'#6ee7a8',warden:'#ff7ad0'};
function countType(type){let n=0;for(const e of G.enemies)if(e.type===type&&e.hp>0)n++;return n}
function pickType(tSec){                               // 동시 상한에 걸린 종류는 빼고 남은 가중치로 다시 뽑는다
  const w=SPAWN_BANDS[bandOf(tSec)],list=[];let sum=0;
  for(const ty of Object.keys(w)){
    if(CFG.caps[ty]!==undefined&&countType(ty)>=CFG.caps[ty])continue;
    list.push([ty,w[ty]]);sum+=w[ty];
  }
  let r=Math.random()*sum;
  for(const[ty,wt]of list){r-=wt;if(r<0)return ty}
  return 'chaser';
}

/* ================= ENEMIES ================= */
let NEXT_EID=1;
function makeEnemy(type,x,y){
  const c=CFG[type];
  return{id:NEXT_EID++,type,x,y,r:c.r,hp:c.hp,maxHp:c.hp,kx:0,ky:0,flash:0,spawn:.55,cd:rand(1,2),wind:0,aim:0,touchCd:0,stun:0,collideCd:0,face:0,tgt:null,dead:false};
}
function spawnEnemy(){
  const p=G.p,tSec=runSec();
  if(G.enemies.length>=phaseOf(tSec).max)return;
  let x,y,tries=0;
  do{
    const side=Math.floor(rand(0,4));
    if(side===0){x=rand(24,W-24);y=24}else if(side===1){x=rand(24,W-24);y=H-24}else if(side===2){x=24;y=rand(24,H-24)}else{x=W-24;y=rand(24,H-24)}
    tries++;
  }while(Math.hypot(x-p.x,y-p.y)<200&&tries<12);
  const type=pickType(tSec),e=makeEnemy(type,x,y);
  e.face=Math.atan2(p.y-y,p.x-x);
  if(rollElite(e,tSec))eliteNotice(e);            // ELITE (SYNC LOCK / RELAY CORE)
  G.enemies.push(e);
  const sp=G.stats.tel.spawn[bandOf(tSec)];sp[type]=(sp[type]||0)+1;
  if((type==='phase'||type==='warden')&&!G.seen[type]){         // 첫 등장 시 이름/특징 안내
    G.seen[type]=true;
    G.notice=type==='phase'?{text:'PHASE HUNTER — ECHO를 쫓는다. ECHO 쪽으로 유인하면 충돌로 무력화된다',c:'#6ee7a8',t:0}
                          :{text:'WARDEN — 정면 방패는 모든 공격을 막는다. 옆·뒤를 노려라 (ECHO를 돌려라)',c:'#ff7ad0',t:0};
  }
  return e;
}
function updateEnemies(){
  const p=G.p,tSec=runSec();
  // 스폰 (구간 전환 중 / 보스전에는 정지)
  if(G.stage==='survive')G.spawnT-=DT;
  if(G.stage==='survive'&&G.spawnT<=0){
    const ph=phaseOf(tSec),k=Math.min(1,Math.max(0,(tSec-ph.from)/(ph.to-ph.from)));
    spawnEnemy();
    if(Math.random()<ph.double)spawnEnemy();        // 간헐적 2기 동시 생성
    G.spawnT=ph.spawn[0]+(ph.spawn[1]-ph.spawn[0])*k;
  }
  const ramp=1+0.25*Math.min(1,tSec/CFG.gameSec);
  for(const e of G.enemies){
    if(e.hp<=0)continue;
    e.flash=Math.max(0,e.flash-DT);
    if(e.type==='boss')continue;                     // 보스는 updateBoss()가 담당
    e.kx*=0.86;e.ky*=0.86;
    if(e.spawn>0){e.spawn-=DT;continue}
    if(e.elite){
      tickElite(e);
      if(e.elite.stag>0){e.elite.stag--;e.x=clamp(e.x+e.kx*DT,e.r,W-e.r);e.y=clamp(e.y+e.ky*DT,e.r,H-e.r);continue}   // SYNC BREAK 경직 0.3초: 이동/공격/접촉 정지
    }
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
    const c=CFG[e.type];
    let vx=0,vy=0;
    e.collideCd=Math.max(0,(e.collideCd||0)-DT);
    if(e.type==='chaser'){
      vx=dx/d*c.speed*ramp;vy=dy/d*c.speed*ramp;
    }else if(e.type==='phase'){
      // 활성 ECHO가 있으면 플레이어 대신 '가장 가까운 ECHO'의 현재 위치를 추적
      if(e.stun>0){e.stun-=DT;e.tgt=null}
      else{
        let tgt=null,bd=Infinity;
        for(const ec of G.echoes){const dd=Math.hypot(ec.x-e.x,ec.y-e.y);if(dd<bd){bd=dd;tgt=ec}}
        if(tgt&&bd>c.track)tgt=null;                // 추적 범위(320px) 밖의 ECHO는 무시 → 플레이어 추적
        e.tgt=tgt;
        if(tgt)G.stats.tel.phaseEchoTicks++;else G.stats.tel.phasePlayerTicks++;
        const tx=tgt?tgt.x:p.x,ty=tgt?tgt.y:p.y,ddx=tx-e.x,ddy=ty-e.y,dd=Math.hypot(ddx,ddy)||1;
        vx=ddx/dd*c.speed;vy=ddy/dd*c.speed;
      }
    }else if(e.type==='warden'){
      // 플레이어 쪽으로 천천히 회전(최대 180°/초). 즉시 돌지 않으므로 옆/뒤가 열린다.
      const diff=angDiff(Math.atan2(dy,dx),e.face),mt=c.turn*DT;
      e.face+=clamp(diff,-mt,mt);
      vx=dx/d*c.speed;vy=dy/d*c.speed;
    }else{
      const dir=d>290?1:(d<210?-1:0);
      vx=dx/d*c.speed*dir+(-dy/d)*c.speed*.35;vy=dy/d*c.speed*dir+(dx/d)*c.speed*.35;
      if(e.wind>0){
        e.wind-=DT;vx*=.2;vy*=.2;
        if(e.wind<=0){
          G.shots.push({x:e.x,y:e.y,vx:Math.cos(e.aim)*c.shotSpeed,vy:Math.sin(e.aim)*c.shotSpeed,r:c.shotR,life:3.2,from:(e.elite?'ELITE '+e.elite.trait+' ':'')+'shooter'});
          e.cd=c.cd+rand(0,.8);
        }
      }else{
        e.cd-=DT;
        if(e.cd<=0){e.wind=c.wind;e.aim=Math.atan2(dy,dx)}
      }
    }
    e.x+=(vx+e.kx)*DT;e.y+=(vy+e.ky)*DT;
    e.x=clamp(e.x,e.r,W-e.r);e.y=clamp(e.y,e.r,H-e.r);
    // PHASE COLLISION: ECHO 반경 22px 안 → 자신에게 피해 1 + 기절 0.9초 + 약한 넉백 (ECHO는 피해 없음, 내부 쿨다운 1.5초)
    if(e.type==='phase'&&e.collideCd<=0&&!(e.stun>0)){
      for(const ec of G.echoes){
        if(Math.hypot(ec.x-e.x,ec.y-e.y)<=c.collideR){
          e.collideCd=c.collideCd;e.stun=c.stun;
          const a=Math.atan2(e.y-ec.y,e.x-ec.x);
          G.stats.tel.phaseCollisions++;
          G.fx.push({k:'ring',x:ec.x,y:ec.y,t:0,life:.45,c:'#6ee7a8',r:44});
          G.fx.push({k:'text',x:e.x,y:e.y-e.r-8,txt:'PHASE',t:0,life:.6,c:'#6ee7a8'});
          sfx('phase');
          hitEnemy(e,1,'echo',a,.5,undefined,'collision');            // origin 없음 → 방패와 무관한 고정 피해 1 (시너지 대상 아님)
          if(e.dead)G.stats.tel.phaseCollisionKills++;
          break;
        }
      }
    }
    // 접촉 피해 (기절 중에는 없음)
    if(e.type!=='shooter'&&e.hp>0&&!(e.stun>0)&&d<p.r+e.r&&p.inv<=0&&p.dashT<=0){
      G.lastDmgSrc=(e.elite?'ELITE '+e.elite.trait+' ':'')+e.type;hurtPlayer(1,e.x,e.y,'contact');
      const a=Math.atan2(e.y-p.y,e.x-p.x);e.kx+=Math.cos(a)*260;e.ky+=Math.sin(a)*260;
    }
  }
  // 적끼리 겹침 완화
  const L=G.enemies;
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const a=L[i],b=L[j];if(a.hp<=0||b.hp<=0)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),m=a.r+b.r;
    if(d>0&&d<m){const push=(m-d)/2,ux=dx/d,uy=dy/d;a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push}
  }
  G.enemies=G.enemies.filter(e=>e.hp>0);
  // 투사체
  for(const s of G.shots){
    s.x+=s.vx*DT;s.y+=s.vy*DT;s.life-=DT;
    if(s.x<-10||s.x>W+10||s.y<-10||s.y>H+10)s.life=0;
    if(s.life>0&&Math.hypot(s.x-p.x,s.y-p.y)<p.r+s.r&&p.inv<=0&&p.dashT<=0){G.lastDmgSrc=s.from||'shooter';hurtPlayer(1,s.x,s.y,'shot');s.life=0}
  }
  G.shots=G.shots.filter(s=>s.life>0);
}

