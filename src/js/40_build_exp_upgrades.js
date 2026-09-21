/* ================= PLAYER STATS (빌드) ================= */
// 업그레이드가 바꾸는 값은 전부 여기 모은다. 전투 코드는 '지금 시점의 빌드 값'만 읽는다.
// → ECHO는 녹화된 행동(위치/타이밍)만 재생하고, 피해/사거리 같은 스탯은 현재 빌드를 참조 (살아 있는 ECHO에도 즉시 적용).
function newBuild(){
  return{stacks:{},atkPct:0,atkCd:CFG.atkCd,atkRangeMul:1,echoLoops:CFG.echoLoops,echoMax:CFG.echoMax,echoPow:1,dashCd:CFG.dashCd,dashBonus:0};
}
const B=()=>G.build;
const num=v=>String(Math.round(v*100)/100);
const echoMulOf=src=>src==='echo'?B().echoPow:1;
const atkDmgBase=()=>CFG.atkDmg*(1+B().atkPct/100);          // SHARP EDGE: 스택당 기본 공격 피해 +20% (대시 피해에는 영향 없음)
const atkDmgOf=src=>atkDmgBase()*echoMulOf(src);
const atkRange=()=>CFG.atkRange*B().atkRangeMul;
const dashDmgOf=src=>(CFG.dashDmg+B().dashBonus)*echoMulOf(src);

/* ================= EXPERIENCE SYSTEM ================= */
const XP_VALUE={chaser:10,shooter:15,phase:18,warden:25};
function newExp(){return{level:1,xp:0,need:CFG.xpFirst,pending:0}}
function gainXp(n){                              // 적 처치 시점(hitEnemy의 사망 처리)에서만 호출됨 → 적 1기당 1회
  const x=G.exp;x.xp+=n;
  while(x.xp>=x.need){x.xp-=x.need;x.level++;x.need=Math.round(x.need*CFG.xpGrowth);x.pending++}
}

/* ================= UPGRADE SYSTEM (데이터 기반) ================= */
// id / name / cat / max(최대 중첩) / desc(build)->설명(현재→다음) / apply(build)
const stk=id=>(B().stacks[id]||0);
const RES_DMG=[0,1,1.5,2],MARK_DMG=[0,2,3,4],TRAIL_DMG=[0,1,1.5,2],FB_CD=[0,.08,.12,.16];
const nxt=(arr,b,id)=>arr[Math.min(arr.length-1,(b.stacks[id]||0)+1)],cur=(arr,b,id)=>arr[b.stacks[id]||0];
const UPGRADES=[
  // ---- 공격 ----
  {id:'sharp',name:'SHARP EDGE',cat:'공격',max:4,          // v2.5.1: 최대 5 → 4스택 (최종 1.8)
   desc:b=>'기본 공격 피해 +20% ('+num(CFG.atkDmg*(1+b.atkPct/100))+' → '+num(CFG.atkDmg*(1+(b.atkPct+20)/100))+', ECHO 공격 포함 · 대시 제외)',apply:b=>{b.atkPct+=20}},
  {id:'rapid',name:'RAPID CUT',cat:'공격',max:5,
   desc:b=>'공격 쿨다운 '+num(b.atkCd)+'초 → '+num(Math.max(.15,b.atkCd*.9))+'초 (ECHO는 기록된 타이밍 유지)',apply:b=>{b.atkCd=Math.max(.15,b.atkCd*.9)}},
  {id:'reach',name:'LONG REACH',cat:'공격',max:4,
   desc:b=>'공격 사거리 '+Math.round(CFG.atkRange*b.atkRangeMul)+' → '+Math.round(CFG.atkRange*(b.atkRangeMul+.10))+' (ECHO 포함)',apply:b=>{b.atkRangeMul+=.10}},
  // ---- ECHO ----
  {id:'deep',name:'DEEP RECORD',cat:'ECHO',max:2,
   desc:b=>'ECHO 반복 '+b.echoLoops+'회 → '+(b.echoLoops+1)+'회 · 동시 ECHO '+b.echoMax+'개 → '+(b.echoMax+1)+'개 (최대 5)',apply:b=>{b.echoLoops+=1;b.echoMax+=1}},
  {id:'power',name:'ECHO POWER',cat:'ECHO',max:6,
   desc:b=>'ECHO 피해 '+Math.round(b.echoPow*100)+'% → '+Math.round((b.echoPow+.25)*100)+'%',apply:b=>{b.echoPow+=.25}},
  {id:'resonance',name:'RESONANCE',cat:'ECHO',max:3,
   desc:b=>'같은 적을 PLAYER와 ECHO가 0.8초 안에 각각 맞히면 추가 피해 '+cur(RES_DMG,b,'resonance')+' → '+nxt(RES_DMG,b,'resonance')+' (적별 쿨 0.8초)',apply:b=>{}},
  // ---- 대시 ----
  {id:'phase',name:'PHASE DRIVE',cat:'대시',max:5,
   desc:b=>'대시 쿨다운 '+num(b.dashCd)+'초 → '+num(Math.max(.45,b.dashCd*.85))+'초',apply:b=>{b.dashCd=Math.max(.45,b.dashCd*.85)}},
  {id:'impact',name:'IMPACT',cat:'대시',max:5,
   desc:b=>'대시 피해 '+(CFG.dashDmg+b.dashBonus)+' → '+(CFG.dashDmg+b.dashBonus+1)+' (ECHO 대시 포함)',apply:b=>{b.dashBonus+=1}},
  {id:'trail',name:'PHASE TRAIL',cat:'대시',max:3,
   desc:b=>'대시 경로에 0.8초간 트레일 · 처음 닿는 적에게 피해 '+cur(TRAIL_DMG,b,'trail')+' → '+nxt(TRAIL_DMG,b,'trail')+' (ECHO 대시 포함)',apply:b=>{}},
  // ---- HYBRID ----
  {id:'mark',name:'PHASE MARK',cat:'HYBRID',max:3,
   desc:b=>'대시로 맞힌 적에 2초간 마크 · 반대 주체(PLAYER↔ECHO)가 공격하면 추가 피해 '+cur(MARK_DMG,b,'mark')+' → '+nxt(MARK_DMG,b,'mark'),apply:b=>{}},
  {id:'feedback',name:'FEEDBACK LOOP',cat:'HYBRID',max:3,
   desc:b=>'ECHO가 적을 맞힐 때마다 내 대시 쿨다운 -'+cur(FB_CD,b,'feedback')+'초 → -'+nxt(FB_CD,b,'feedback')+'초 (프레임당 최대 0.32초)',apply:b=>{}}
];
function availableUpgrades(){return UPGRADES.filter(u=>(B().stacks[u.id]||0)<u.max)}
function rollChoices(){
  const pool=availableUpgrades();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return pool.slice(0,3);                        // 서로 다른 최대 3개 (중복 없음)
}

/* ================= LEVEL-UP UI ================= */
function openLevelUp(){
  const x=G.exp,choices=rollChoices();
  if(!choices.length){x.pending=0;return}        // 더 고를 게 없으면 레벨만 오르고 계속 진행
  G.levelChoices=choices;G.phase='levelup';      // 시뮬레이션 전체 정지
  lvTitle.textContent='LEVEL UP — LV '+(x.level-x.pending+1);
  lvSub.textContent=x.pending>1?('남은 선택 '+x.pending+'회'):'';
  lvChoices.innerHTML='';
  choices.forEach((u,i)=>{
    const st=B().stacks[u.id]||0,b=document.createElement('button');
    b.type='button';b.className='card';
    b.innerHTML='<span class="k">'+(i+1)+'</span><b>'+u.name+'</b><small>'+u.cat+' · '+(st+1)+' / '+u.max+'단계</small><span class="d">'+u.desc(B())+'</span>';
    b.addEventListener('click',()=>{ensureAudio();chooseUpgrade(i)});
    lvChoices.appendChild(b);
  });
  ovLevel.classList.remove('hidden');
  sfx('level');
}
function chooseUpgrade(i){
  if(G.phase!=='levelup')return;
  const u=G.levelChoices&&G.levelChoices[i];if(!u)return;
  u.apply(B());B().stacks[u.id]=(B().stacks[u.id]||0)+1;
  const rt=G.stats.tel.run,n=B().stacks[u.id],sec=G.runT/60;                 // v2.6: 빌드 완성 속도 기록
  if(rt.firstPick[u.id]===undefined)rt.firstPick[u.id]=sec;
  if(n>=u.max&&rt.maxAt[u.id]===undefined)rt.maxAt[u.id]=sec;
  G.exp.pending--;G.levelChoices=null;
  ovLevel.classList.add('hidden');
  G.phase='play';input.dash=false;               // 일시정지 중 눌린 대시 입력이 남지 않게
  if(G.exp.pending>0)openLevelUp();              // 여러 레벨이 쌓였으면 순차적으로 다음 선택창
}

