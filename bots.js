// 자동 플레이 봇 (재사용용). 게임 내부 상태(G)와 화면에 표시되는 예고 정보(bossDanger 등)만 사용한다.
//  · SURVIVE: 일반 적 구간(60초) 정책
//  · BOSS_BOT A/B/C: 세 봇은 '기본 조작(이동/공격/위험 회피/대시 회피)'을 완전히 같은 공용 함수로 수행하고,
//    ECHO/SYNC 관련 판단만 다르다.  → 클리어율·피해 차이를 ECHO 활용 효과로 해석할 수 있다.
//      A: ECHO/SYNC 정보 전혀 사용 안 함 (nextEchoBossHit·ECHO 목록·SYNC 타이머 참조 금지 — unit_bots.js가 검사)
//      B: 현재 존재하는 ECHO의 다음 보스 타격 시점을 보고 플레이어 공격을 맞춘다
//      C: B + 녹화 구간을 계획 (보스 주위를 일정한 반경으로 돌며 매 구간 공격을 채우고, 항상 같은 궤도를 유지)
const PI=Math.PI,TAU=PI*2;
const KEYS=['KeyW','KeyA','KeyS','KeyD'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setMove(E,dx,dy){const k=E().keys;for(const c of KEYS)k.delete(c);if(dx>.3)k.add('KeyD');if(dx<-.3)k.add('KeyA');if(dy>.3)k.add('KeyS');if(dy<-.3)k.add('KeyW')}
function nearest(G){let b=null,bd=1e9;for(const e of G.enemies){if(e.hp<=0||e.spawn>0)continue;const d=Math.hypot(e.x-G.p.x,e.y-G.p.y);if(d<bd){bd=d;b=e}}return{e:b,d:bd}}

/* ---------- 일반 구간 ---------- */
const SURVIVE={
 sweeper(E,G,t,opt){const a=t/60*0.9,tx=480+Math.cos(a)*170,ty=300+Math.sin(a)*120;setMove(E,tx-G.p.x,ty-G.p.y);const n=nearest(G);if(n.e){E().input.aimAngle=Math.atan2(n.e.y-G.p.y,n.e.x-G.p.x);E().input.atk=n.d<95}else E().input.atk=false;if(n.e&&n.d<32&&t%20===0)E().input.dash=true;
   // dashAssist: 대시 계열(TRAIL/MARK/IMPACT/FEEDBACK) 빌드를 든 플레이어처럼, 쿨이 돌면 가장 가까운 적 쪽으로 공격 대시
   if(opt&&opt.dashAssist&&n.e&&G.p.dashCd<=0&&n.d>36&&n.d<180){setMove(E,n.e.x-G.p.x,n.e.y-G.p.y);E().input.dash=true}},
 kiter(E,G,t){const n=nearest(G);let dx=480-G.p.x,dy=300-G.p.y;if(n.e&&n.d<170){dx=G.p.x-n.e.x;dy=G.p.y-n.e.y}setMove(E,dx,dy);if(n.e){E().input.aimAngle=Math.atan2(n.e.y-G.p.y,n.e.x-G.p.x);E().input.atk=n.d<90}else E().input.atk=false;if(n.e&&n.d<30&&t%25===0)E().input.dash=true},
 stand(E,G,t){setMove(E,0,0);const n=nearest(G);if(n.e){E().input.aimAngle=Math.atan2(n.e.y-G.p.y,n.e.x-G.p.x);E().input.atk=n.d<95}else E().input.atk=false},
 rover(E,G,t){const a=t/60*0.5+Math.sin(t/90)*2,tx=480+Math.cos(a)*300,ty=300+Math.sin(a*1.3)*200;setMove(E,tx-G.p.x,ty-G.p.y);const n=nearest(G);if(n.e){E().input.aimAngle=Math.atan2(n.e.y-G.p.y,n.e.x-G.p.x);E().input.atk=n.d<95}else{E().input.atk=true;E().input.aimAngle=a}if(t%70===0)E().input.dash=true}
};

/* ---------- ELITE 전용 봇 (IGNORE vs SMART) ----------
   이동/대시(회피)는 완전히 같은 코드. 차이는 '공격 대상·타이밍'뿐이다.
     IGNORE: 가장 가까운 적을 계속 공격 (ECHO 타이밍/ELITE 기믹 정보를 쓰지 않는다)
     TIMING: (SMART에서 유인만 뺀 변형) 공격 타이밍만 ECHO 타격 예정 시간에 맞춘다
     SMART : TIMING + ECHO 공격 예정 지점 앞으로 이동해 ELITE를 유인한다(이동 속도/회피 능력은 동일, 이동 '목표'만 다름). ELITE의 특성에 맞춰 ECHO 타격 예정 시간(nextEchoHitOn)에 맞춰 공격한다
       SYNC LOCK : 보호막이 있으면 ECHO 타격이 임박했을 때(또는 방금 ECHO가 때렸을 때)만 ELITE를 공격 → BREAK 유도, BREAK 중엔 집중 공격
       RELAY CORE: ECHO 타격에 맞춰 공격하되, 주변에 다른 적이 있을 때 BURST가 터지게 유도 */
// LURE(SMART 전용): 화면에 보이는 ECHO 공격 예정 지점 중 제시간에 도달 가능한 가장 이른 것 → 그 지점 바로 앞에 서서 ELITE(뒤따라옴)를 ECHO 공격 범위로 끌어온다
function lureTarget(E,G,el){
  const p=G.p;let best=null;
  for(const ec of G.echoes){
    const len=ec.clip.length;
    for(let k=1;k<=150;k++){
      const n=ec.i+k-1;if(ec.loop+Math.floor(n/len)>=E().B().echoLoops)break;
      const f=ec.clip[n%len];
      if(!f.atk)continue;
      const tx=f.x+Math.cos(f.a)*35,ty=f.y+Math.sin(f.a)*35;
      const me=Math.hypot(tx-p.x,ty-p.y)/250*60;                         // 내가 도착하는 데 걸리는 틱
      const ed=Math.hypot(tx-el.x,ty-el.y);                               // ELITE와 그 지점의 거리(가까울수록 ECHO 범위에 들어올 확률↑)
      if(k>=me*0.9&&(!best||ed<best.ed))best={k,x:tx,y:ty,ed};
      break;                                                             // 한 ECHO당 가장 이른 공격 프레임만
    }
  }
  return best;
}
function eliteMove(E,G,t,lure){                   // IGNORE/SMART 공통 이동: ELITE가 있으면 60px까지 접근, 없으면 sweeper 궤도 (lure면 ECHO 공격 지점으로 유인)
  const p=G.p;let tx,ty;
  const el=G.enemies.find(e=>e.elite&&e.hp>0&&e.spawn<=0);
  const lt=(lure&&el&&el.type==='chaser')?lureTarget(E,G,el):null;
  if(lt){tx=lt.x;ty=lt.y}
  else if(el){const d=Math.hypot(el.x-p.x,el.y-p.y);if(d>60+el.r){tx=el.x;ty=el.y}else{tx=p.x;ty=p.y}}
  else{const a=t/60*0.9;tx=480+Math.cos(a)*170;ty=300+Math.sin(a)*120}
  setMove(E,tx-p.x,ty-p.y);
  const n=nearest(G);if(n.e&&n.d<32&&t%20===0)E().input.dash=true;
  return el;
}
function eliteBot(mode){
  return function(E,G,t){
    const p=G.p,el=eliteMove(E,G,t,mode==='smart'),n=nearest(G);
    let tgt=n.e,atk=n.e&&n.d<95;
    if((mode==='smart'||mode==='timing')&&el){
      const d=Math.hypot(el.x-p.x,el.y-p.y),inReach=d-el.r<=68;
      if(inReach){
        const st=E().eliteStatus(el),nx=E().nextEchoHitOn(el,240);
        const soon=!!(nx&&nx.ticks<=70),recentEcho=st.e;
        const others=G.enemies.filter(o=>o!==el&&o.hp>0&&o.spawn<=0);
        let goElite;
        if(el.elite.trait==='lock'){
          // SYNC LOCK: 방패가 있는 동안에도 계속 때려 PLAYER 타격을 창 안에 유지(ECHO 타격이 들어오는 순간 BREAK), BREAK 중엔 집중 공격, 복구 직후 보호시간엔 다른 적
          goElite=st.kind!=='protect';
        }else{
          // RELAY CORE: ELITE를 먼저 죽여버리면 BURST가 없다 → ECHO 타격(예정 포함)을 맞출 수 있으면 그때까지 ELITE를 아끼고 주변 적을 처리, 맞출 방법이 없으면 그냥 처치
          const canSync=(el.type==='chaser'&&!!lureTarget(E,G,el))||!!nx;
          if(st.kind==='cool')goElite=false;
          else goElite=(soon||recentEcho)||!canSync;
        }
        if(goElite){tgt=el;atk=true}
        else{const alt=others.map(o=>({o,d:Math.hypot(o.x-p.x,o.y-p.y)})).sort((a,b)=>a.d-b.d)[0];if(alt&&alt.d<95){tgt=alt.o;atk=true}else atk=false}
      }
    }
    if(tgt)E().input.aimAngle=Math.atan2(tgt.y-p.y,tgt.x-p.x);
    E().input.atk=!!atk;
  };
}
SURVIVE.eliteIgnore=eliteBot('ignore');SURVIVE.eliteTiming=eliteBot('timing');SURVIVE.eliteSmart=eliteBot('smart');

const DIRS8=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707],[0,0]];
/* ---------- v2.6 장기 런(300초) 봇: BASIC / SMART ----------
   둘은 같은 기본 조작(이동·위험 회피·대시·타격)을 쓰고, ECHO 기믹 활용 판단에서만 갈린다.
   BASIC: 가장 가까운 적을 처리하고 위험하면 피한다 (ECHO는 자연히 생기는 대로만 활용)
   SMART: + ELITE의 SYNC/RELAY를 ECHO 타격 시점에 맞춰 노리고, WARDEN은 측후방을 치고, ECHO 근처를 유지해 PHASE HUNTER를 ECHO로 유인 */
const WALL=70;
function threatScore(G,x,y){                       // 해당 지점의 위험도(가까운 적/투사체일수록 큼)
  let s=0;
  for(const e of G.enemies){
    if(e.hp<=0||e.spawn>0)continue;
    const d=Math.hypot(e.x-x,e.y-y);
    if(d<160)s+=(160-d)*(e.elite?1.5:1)*(e.type==='warden'?0.7:1);
  }
  for(const s2 of G.shots){
    const d=Math.hypot(s2.x-x,s2.y-y);
    if(d<120)s+=(120-d)*1.4;
  }
  if(x<WALL||x>960-WALL||y<WALL||y>600-WALL)s+=60;  // 구석에 몰리지 않기
  return s;
}
function runMove(E,G,t,mem){                       // 공통 이동: 주변 8방향 중 가장 안전한 쪽 (원하는 방향 가중치 포함)
  const p=G.p;let best=[0,0],bs=1e18;
  for(const[dx,dy]of DIRS8){
    const x=clamp(p.x+dx*90,p.r,960-p.r),y=clamp(p.y+dy*90,p.r,600-p.r);
    let s=threatScore(G,x,y);
    if(mem.want)s-=(dx*mem.want[0]+dy*mem.want[1])*70;
    if(dx===0&&dy===0)s+=30;
    if(s<bs){bs=s;best=[dx,dy]}
  }
  setMove(E,best[0],best[1]);
  return bs;
}
// 측후방 판정: WARDEN의 정면 방패(±60°)를 피해 때릴 수 있는가
const canHitWarden=(G,e,fromX,fromY)=>{
  if(e.type!=='warden')return true;
  const a=Math.atan2(fromY-e.y,fromX-e.x),d=Math.abs(((a-e.face+Math.PI*3)%(Math.PI*2))-Math.PI);
  return d>Math.PI/3;
};
function pickTarget(E,G,smart){
  const p=G.p;let best=null,bs=-1e9;
  for(const e of G.enemies){
    if(e.hp<=0||e.spawn>0||e.type==='boss')continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    let s=-d;
    if(smart){
      if(e.elite&&SF('ELITE')&&d<220){                            // 가까운 ELITE만 우선 (멀리 있는 ELITE를 쫓다 둘러싸이지 않게)
        const st=E().eliteStatus(e);
        s+=70;
        if(st.kind==='break')s+=90;                               // BREAK 중에는 집중
      }
      if(SF('WARDEN')&&!canHitWarden(G,e,p.x,p.y))s-=80;                       // 방패 정면은 후순위
      if(SF('PH')&&e.type==='phase')s-=60;                                  // PHASE HUNTER는 ECHO에 맡긴다
    }
    if(s>bs){bs=s;best=e}
  }
  return best;
}
const SF=k=>!process.env['NO_'+k];      // 실험용 토글: NO_ELITE / NO_WARDEN / NO_HOLD / NO_LURE / NO_PH
function runBot(smart){
  const F=(k)=>!process.env['NO_'+k];
  return function(E,G,t,mem){
    mem=mem||{};const p=G.p;
    const tgt=pickTarget(E,G,smart);
    let want=null;
    if(tgt){
      const d=Math.hypot(tgt.x-p.x,tgt.y-p.y),ux=(tgt.x-p.x)/(d||1),uy=(tgt.y-p.y)/(d||1);
      if(d>72)want=[ux,uy];else if(d<40)want=[-ux,-uy];
      if(smart&&SF('WARDEN')&&tgt.type==='warden'&&!canHitWarden(G,tgt,p.x,p.y))want=[-uy,ux];      // 옆으로 돌아 들어간다
      if(smart&&SF('LURE')&&G.echoes.length){                                                     // ECHO 근처를 유지 → PHASE HUNTER가 ECHO를 쫓는다
        const e0=G.echoes[0],de=Math.hypot(e0.x-p.x,e0.y-p.y);
        if(de>380&&!want&&threatScore(G,p.x,p.y)<150)want=[(e0.x-p.x)/de,(e0.y-p.y)/de];
      }
      mem.want=want;runMove(E,G,t,mem);
      E().input.aimAngle=Math.atan2(tgt.y-p.y,tgt.x-p.x);
      let atk=d-tgt.r<=68&&(smart&&SF('WARDEN')?canHitWarden(G,tgt,p.x,p.y):true);
      if(smart&&SF('HOLD')&&tgt.elite&&atk){                                                      // ELITE: ECHO 타격 시점에 맞춰 PLAYER 타격
        const st=E().eliteStatus(tgt),nx=E().nextEchoHitOn(tgt,240);
        if(st.kind==='lock'||st.kind==='guard'||st.kind==='relay'){
          const soon=!!(nx&&nx.ticks<=70);
          if(!soon&&!st.e&&nx&&nx.ticks>110&&threatScore(G,p.x,p.y)<180)atk=false;                                // ECHO 타격이 멀면 잠깐 아낀다
        }
        if(st.kind==='protect'||st.kind==='cool')atk=true;
      }
      E().input.atk=atk;
    }else{mem.want=null;runMove(E,G,t,mem);E().input.atk=false}
    // 대시: 위험이 높고 쿨이 돌면 가장 안전한 쪽으로 (BASIC/SMART 동일)
    if(p.dashCd<=0){
      const here=threatScore(G,p.x,p.y);
      if(here>170){
        let bd=null,bs=here;
        for(const[dx,dy]of DIRS8){
          if(!dx&&!dy)continue;
          const x=clamp(p.x+dx*140,p.r,960-p.r),y=clamp(p.y+dy*140,p.r,600-p.r),s=threatScore(G,x,y);
          if(s<bs){bs=s;bd=[dx,dy]}
        }
        if(bd){E().input.aimAngle=Math.atan2(bd[1],bd[0]);E().input.dash=true}
      }else if(tgt&&Math.hypot(tgt.x-p.x,tgt.y-p.y)<150&&(!smart||canHitWarden(G,tgt,p.x,p.y))){
        E().input.aimAngle=Math.atan2(tgt.y-p.y,tgt.x-p.x);E().input.dash=true;       // 공격 대시
      }
    }
  };
}
SURVIVE.runBasic=runBot(false);SURVIVE.runSmart=runBot(true);

/* ---------- 보스: 공용 기본 조작 (A/B/C 동일) ---------- */
const LOOK=54;                                   // 예고 시간(최대 54틱) 전체를 보고 피한다
// want에 가깝게 가되, 예고된 위험 영역/보스 접촉을 피하는 방향
function pickDir(E,G,wantX,wantY,look){
  const p=G.p,b=G.boss;let best=null,bs=-1e9;
  for(const[dx,dy]of DIRS8){
    let s=(dx*wantX+dy*wantY)*10;
    if(dx===0&&dy===0)s-=1;
    for(const f of[0.5,1]){
      const x=clamp(p.x+dx*250*0.25*f,p.r,960-p.r),y=clamp(p.y+dy*250*0.25*f,p.r,600-p.r);
      if(E().bossDanger(x,y,look))s-=100/f;
      if(b&&Math.hypot(x-b.x,y-b.y)<p.r+b.r+6)s-=25;
    }
    if(s>bs){bs=s;best=[dx,dy]}
  }
  return best;
}
const inDanger=(E,G,look)=>E().bossDanger(G.p.x,G.p.y,look);
// 공용 위험 회피: 걷기 회피 + 임박(12틱) 시 대시(무적) 회피. 세 봇이 똑같이 사용한다.
function evade(E,G,wx,wy){
  const p=G.p;
  if(!(inDanger(E,G,LOOK)||E().bossDanger(p.x+wx*70,p.y+wy*70,LOOK)))return[wx,wy];
  const[ax,ay]=pickDir(E,G,wx,wy,LOOK);
  if(E().bossDanger(p.x,p.y,12)&&p.dashCd<=0&&(ax||ay))E().input.dash=true;
  return[ax,ay];
}
// 벽 근처에서 벽 쪽으로 가려 하면 접선 방향으로 미끄러진다 (구석에 몰려 접촉 피해를 받지 않게)
function wallSlide(p,wx,wy,ux,uy){
  const m=70,blocked=(p.x<m&&wx<-.2)||(p.x>960-m&&wx>.2)||(p.y<m&&wy<-.2)||(p.y>600-m&&wy>.2);
  if(!blocked)return[wx,wy];
  let tx=-uy,ty=ux;
  if((480-p.x)*tx+(300-p.y)*ty<0){tx=-tx;ty=-ty}          // 화면 중앙 쪽으로
  return[tx,ty];
}
function geom(G){const b=G.boss,p=G.p,dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||1;return{b,p,dx,dy,d,ux:dx/d,uy:dy/d}}

// 대시 계열 빌드용 공격 대시 (mem.dashAssist가 켜진 B/C만 사용): 보스 쪽으로 대시해 대시/트레일/마크를 만든다
function dashStrike(E,G,mem){
  if(!mem||!mem.dashAssist)return;
  const{b,p,d,ux,uy}=geom(G);
  const mode=process.env.DASHSTRIKE||'near';
  if(mode==='off'||p.dashCd>0||inDanger(E,G,30))return;
  if(b.pat||b.gap<75)return;      // 회피용 대시를 남겨 둔다: 예고 중이거나 다음 패턴이 75틱(1.25초) 안에 시작하면 공격 대시 금지
  if(mode==='near'){if(d>50&&d<150){setMove(E,ux,uy);E().input.dash=true}return}
  // tangent: 보스 옆을 스치듯 접선 방향으로 대시 (보스와 겹쳐 서지 않는다). 사거리 안(≈95 이내)일 때만
  if(d<100){const s=mem.tdir=(mem.tdir||1);setMove(E,-uy*s+ux*0.25,ux*s+uy*0.25);E().input.dash=true}
}
/* ---------- 보스: A / B / C ---------- */
const BOSS_BOT={
  // A — ECHO/SYNC 미사용. 안전 거리(84~100) 유지, 사거리 안에서 계속 공격, 위험/접촉 회피는 B·C와 동일.
  A(E,G,t,mem){
    if(!G.boss||G.boss.dead)return;
    const{b,p,d,ux,uy,dx,dy}=geom(G);
    let wx=0,wy=0;
    if(d>100){wx=ux;wy=uy}else if(d<84){wx=-ux;wy=-uy}
    [wx,wy]=wallSlide(p,wx,wy,ux,uy);
    [wx,wy]=evade(E,G,wx,wy);
    setMove(E,wx,wy);
    E().input.aimAngle=Math.atan2(dy,dx);
    E().input.atk=d-b.r<=68;
  },
  // B — 보스 주위를 돌며(녹화가 보스 근처에 쌓임) 현재 ECHO의 다음 보스 타격 시점에 공격을 맞춘다.
  B(E,G,t,mem){
    if(!G.boss||G.boss.dead)return;
    const{b,p,d,ux,uy,dx,dy}=geom(G);
    let wx=-uy+ux*clamp((d-86)/40,-1,1),wy=ux+uy*clamp((d-86)/40,-1,1);
    [wx,wy]=evade(E,G,wx,wy);
    setMove(E,wx,wy);
    E().input.aimAngle=Math.atan2(dy,dx);
    const inRange=d-b.r<=68,nx=E().nextEchoBossHit(240);
    const vuln=!b.shield,recentEcho=b.clock-b.lastHit.echo<=75;
    let atk=inRange;
    if(b.shield&&nx&&nx.ticks>110&&!recentEcho)atk=false;          // ECHO 타격이 1.8초 이상 남았으면 타이밍을 기다린다
    E().input.atk=atk||vuln&&inRange;
    dashStrike(E,G,mem);
  },
  // C — 최적화: 매 녹화 구간에 보스를 향한 공격을 항상 채우고, 같은 반경(72)의 궤도를 유지해 미래 ECHO가 보스에 닿게 계획한다.
  C(E,G,t,mem){
    if(!G.boss||G.boss.dead)return;
    const{b,p,d,ux,uy,dx,dy}=geom(G);
    let wx=-uy+ux*clamp((d-72)/35,-1.3,1.3),wy=ux+uy*clamp((d-72)/35,-1.3,1.3);
    [wx,wy]=evade(E,G,wx,wy);
    setMove(E,wx,wy);
    E().input.aimAngle=Math.atan2(dy,dx);
    E().input.atk=d-b.r<=68;
    dashStrike(E,G,mem);
  }
};

/* ---------- 업그레이드 선택 ---------- */
// 공정성: 모든 빌드가 같은 봇 조건(공격 대시 사용)으로 플레이한다 — 차이는 오직 업그레이드 선택에서 나온다.
// 빌드별 우선순위: 제시된 3택 중 우선순위가 가장 높은 것 → 없으면 해당 계열 → 없으면 첫 번째
const BUILDS={
  ATTACK:{prio:['sharp','rapid','reach'],cats:['공격'],dashAssist:true},
  ECHO:{prio:['power','deep','resonance'],cats:['ECHO'],dashAssist:true},
  DASH:{prio:['trail','phase','impact','mark'],cats:['대시'],dashAssist:true},
  HYBRID:{prio:['resonance','mark','feedback','power','trail'],cats:['HYBRID','ECHO','대시'],dashAssist:true},
  RANDOM:{prio:[],cats:[],dashAssist:true}
};
function pickByBuild(choices,name,rng){
  const B=BUILDS[name];if(!B||name==='RANDOM')return Math.floor((rng||Math.random)()*choices.length);
  for(const id of B.prio){const i=choices.findIndex(c=>c.id===id);if(i>=0)return i}
  for(const cat of B.cats){const i=choices.findIndex(c=>c.cat===cat);if(i>=0)return i}
  return 0;
}
function pickRandom(E,G,rng){E().chooseUpgrade(Math.floor((rng||Math.random)()*G.levelChoices.length))}
module.exports={SURVIVE,BOSS_BOT,runBot,threatScore,BUILDS,pickByBuild,setMove,nearest,pickRandom,inDanger,pickDir,evade};

/* ---------- v2.6 장기 런 봇 (BASIC / SMART) ----------
   두 봇은 이동·회피·대시·교전 거리 유지를 완전히 같은 코드(runMove/runEvade)로 수행한다.
   차이는 'ECHO 기믹을 읽고 대상과 타이밍을 고르는가'뿐이다:
     BASIC: 가장 가까운(또는 가장 위협적인) 적을 그냥 공격. ECHO 예측 API를 쓰지 않는다.
     SMART: WARDEN은 방패 밖(측후방)을 노리고, PHASE HUNTER는 ECHO 쪽으로 유인하며,
            ELITE는 SYNC LOCK/RELAY CORE 기믹에 맞춰 ECHO 타격 시점에 공격을 맞춘다. 보스전은 BOT C.
   보스전 구간은 BASIC=BOSS_BOT.A, SMART=BOSS_BOT.C를 그대로 사용한다. */
const RUN_R=150;                                  // 기본 교전 거리(이보다 가까우면 물러난다)
function threat(G){                               // 가장 가까운 적 + 가장 가까운 투사체
  const p=G.p;let e=null,ed=1e9;
  for(const o of G.enemies){if(o.hp<=0||o.spawn>0)continue;const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<ed){ed=d;e=o}}
  let s=null,sd=1e9;
  for(const o of G.shots){const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<sd){sd=d;s=o}}
  return{e,ed,s,sd};
}
// 공용 이동: 적 무리에서 벗어나는 방향으로 돌면서 화면 중앙을 크게 순회한다 (둘 다 동일)
function runMove(E,G,t,tx,ty){
  const p=G.p;let wx=0,wy=0;
  if(tx===undefined){const a=t/60*0.75;tx=480+Math.cos(a)*210;ty=300+Math.sin(a*1.1)*150}
  wx=tx-p.x;wy=ty-p.y;
  const L=Math.hypot(wx,wy)||1;wx/=L;wy/=L;
  // 사람처럼 '가까운 위협 몇 개'만 반응한다 (전지적 회피가 되지 않도록 반응 반경/개수 제한)
  const close=G.enemies.filter(o=>o.hp>0&&o.spawn<=0).map(o=>({o,d:Math.hypot(p.x-o.x,p.y-o.y),R:o.r+50})).filter(x=>x.d<x.R).sort((a,b)=>a.d-b.d).slice(0,3);
  for(const{o,d,R}of close){const dx=(p.x-o.x)/d,dy=(p.y-o.y)/d,w=(R-d)/R*2.0;wx+=dx*w;wy+=dy*w}
  for(const s of G.shots){                        // 투사체는 아주 가까운 것만
    const dx=p.x-s.x,dy=p.y-s.y,d=Math.hypot(dx,dy)||1;
    if(d<46){wx+=dx/d*1.4;wy+=dy/d*1.4}
  }
  const m=60;                                     // 벽에서 떨어지기
  if(p.x<m)wx+=1.5;if(p.x>960-m)wx-=1.5;if(p.y<m)wy+=1.5;if(p.y>600-m)wy-=1.5;
  setMove(E,wx,wy);
  return[wx,wy];
}
// 공용 회피 대시: 적/투사체가 아주 가까울 때만 (둘 다 동일)
function runDash(E,G,wx,wy){
  const p=G.p;if(p.dashCd>0)return false;
  const{ed,sd}=threat(G);
  if(ed<26||sd<22){E().input.aimAngle=Math.atan2(wy,wx);E().input.dash=true;return true}
  return false;
}
const inArc=(e,x,y)=>{                            // WARDEN 방패 정면인가 (화면에 보이는 방패 방향)
  const a=Math.atan2(y-e.y,x-e.x),d=Math.abs(((a-e.face+Math.PI*3)%(Math.PI*2))-Math.PI);
  return d<=Math.PI*0.42;
};
function runBot(smart){
  const F=(k)=>!process.env['NO_'+k];
  return function(E,G,t,mem){
    mem=mem||{};
    if(G.stage==='boss'||G.stage==='intro'){       // 보스전: 기존 검증된 봇 그대로
      (smart?BOSS_BOT.C:BOSS_BOT.A)(E,G,t,mem);return;
    }
    const p=G.p,th=threat(G);
    let tgt=th.e,tx,ty,atk=false;
    if(smart){
      // 1) ELITE 우선 (ECHO 타격 시점에 맞춰 공격 → SYNC BREAK / RELAY BURST)
      // ELITE 기믹은 '여유가 있을 때만' 노린다: 주변에 적이 몰려 있으면 기다리는 비용이 더 크다 (v2.6.1 ablation 결과 반영)
      const crowd=G.enemies.filter(e=>e.hp>0&&e.spawn<=0&&Math.hypot(e.x-p.x,e.y-p.y)<200).length;
      const el=(F('ELITE')&&crowd<=2)?G.enemies.find(e=>e.elite&&e.hp>0&&e.spawn<=0&&Math.hypot(e.x-p.x,e.y-p.y)<260):null;
      if(el){
        const d=Math.hypot(el.x-p.x,el.y-p.y),st=E().eliteStatus(el),nx=E().nextEchoHitOn(el,240);
        const soon=!!(nx&&nx.ticks<=70),recent=st.e,worthWaiting=!!(nx&&nx.ticks<=45);   // 곧 올 ECHO 타격만 기다린다(오래 기다리면 손해)
        tgt=el;
        const gimmick=el.elite.trait==='lock'?st.kind!=='protect':(st.kind!=='cool');
        atk=d-el.r<=68&&(!gimmick||soon||recent||st.kind==='break'||!worthWaiting);
        if(!atk&&th.e&&th.ed-th.e.r<=68){tgt=th.e;atk=true}      // 기다리는 동안 다른 적 처리
      }
      // 2) PHASE HUNTER는 ECHO가 있으면 ECHO 쪽으로 흘려보낸다(충돌 자멸 유도) → 직접 쫓지 않음
      if(F('PHASE')&&!el&&!atk&&th.e&&th.e.type==='phase'&&G.echoes.length){
        // PHASE HUNTER는 ECHO를 쫓는다 → 직접 쫓아가지 않고, 사거리 안의 다른 적을 먼저 처리한다
        const other=G.enemies.filter(o=>o.hp>0&&o.spawn<=0&&o.type!=='phase').map(o=>({o,d:Math.hypot(o.x-p.x,o.y-p.y)})).sort((a,b)=>a.d-b.d)[0];
        if(other&&other.d-other.o.r<=68){tgt=other.o;atk=true}else{tgt=th.e;atk=th.ed-th.e.r<=68}
      }
      // 3) WARDEN은 방패 정면을 피해 측후방으로 돈다
      if(F('WARDEN')&&!el&&!atk&&th.e&&th.e.type==='warden'&&th.ed<200){
        // WARDEN 정면 방패는 모든 공격을 막는다 → 정면에서는 때리지 않고(헛손질 방지), 측후방일 때만 공격한다.
        // 이동은 BASIC과 같은 회피 로직 그대로 (방패 뒤로 파고들려다 포위되지 않게).
        const w=th.e;
        if(inArc(w,p.x,p.y)){
          const other=G.enemies.filter(o=>o.hp>0&&o.spawn<=0&&o!==w).map(o=>({o,d:Math.hypot(o.x-p.x,o.y-p.y)})).sort((a,b)=>a.d-b.d)[0];
          if(other&&other.d-other.o.r<=68){tgt=other.o;atk=true}else{tgt=w;atk=false}
        }else{tgt=w;atk=th.ed-w.r<=68}
      }
    }
    if(!atk&&tgt){                                 // 기본 교전: 사거리 안이면 공격
      const d=Math.hypot(tgt.x-p.x,tgt.y-p.y);atk=d-tgt.r<=68;
    }
    if(tx===undefined&&tgt){                       // 접근/후퇴: 두 봇 동일
      const d=Math.hypot(tgt.x-p.x,tgt.y-p.y);
      if(d>RUN_R){tx=tgt.x;ty=tgt.y}
    }
    const[wx,wy]=runMove(E,G,t,tx,ty);
    runDash(E,G,wx,wy);
    if(tgt)E().input.aimAngle=Math.atan2(tgt.y-p.y,tgt.x-p.x);
    E().input.atk=!!atk;
  };
}
const RUN_BOT={BASIC:runBot(false),SMART:runBot(true)};
module.exports.RUN_BOT=RUN_BOT;
module.exports.runMove=runMove;module.exports.threat=threat;

/* ---------- v2.6.1 장기 런 빌드 선택 (기존 BUILDS/pickByBuild 재사용) ---------- */
function pickBuild(E,G,name,rng){E().chooseUpgrade(pickByBuild(G.levelChoices||[],name,rng))}
module.exports.pickBuild=pickBuild;

// SMART 전용 업그레이드 선택: ECHO/대시 시너지를 중심으로 일관된 빌드를 만든다 (BASIC은 무작위 선택)
const SMART_PRIORITY=['trail','rapid','power','resonance','sharp','mark','reach','feedback','deep','phase','impact'];
function pickSmart(E,G){
  const ch=G.levelChoices||[];let bi=0,bp=1e9;
  ch.forEach((u,i)=>{const r=SMART_PRIORITY.indexOf(u.id),pr=r<0?99:r;if(pr<bp){bp=pr;bi=i}});
  E().chooseUpgrade(bi);
}
module.exports.pickSmart=pickSmart;module.exports.SMART_PRIORITY=SMART_PRIORITY;
