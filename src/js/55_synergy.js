/* ================= SYNERGY: RESONANCE / PHASE MARK / FEEDBACK LOOP / PHASE TRAIL ================= */
// 모든 시너지는 '실제 공격 판정(basic/dash/trail)'의 (source, kind, 적)만 보고 동작한다. 새 시너지는 onRealHit에 붙이면 된다.
const SYN={resTicks:48,resCd:48,markTicks:120,fbCap:0.32,trailTtl:48,trailR:10};      // 0.8초 / 0.8초 / 2초 / 프레임당 0.32초 / 트레일 0.8초 (v2.5: 1.2초 → 0.8초)
function onRealHit(e,who,kind){
  const s=B().stacks,t=G.t,tel=G.stats.tel.syn,other=who==='echo'?'player':'echo';
  // FEEDBACK LOOP: ECHO가 피해를 줄 때마다 PLAYER의 대시 쿨다운 감소 (한 프레임 최대 0.32초, 0 미만 불가)
  if(who==='echo'&&s.feedback){
    const per=FB_CD[s.feedback],room=Math.max(0,SYN.fbCap-G.fbUsed),a=Math.min(per,room);
    if(a>0){G.fbUsed+=a;const before=G.p.dashCd;G.p.dashCd=Math.max(0,before-a);tel.fbSaved+=before-G.p.dashCd}
    tel.fbHits++;
  }
  if(!(s.resonance||s.mark))return;
  const st=e.syn||(e.syn={res:{player:-1e9,echo:-1e9,cd:-1e9},mark:null});
  // PHASE MARK 소비: 반대 주체가 공격하면 추가 피해 (같은 주체는 자신의 마크를 소비할 수 없다)
  if(s.mark&&st.mark){
    if(t-st.mark.t0>=SYN.markTicks)st.mark=null;                                     // 2초 후 만료
    else if(st.mark.src!==who&&e.hp>0){st.mark=null;tel.mark++;applyExtra(e,MARK_DMG[s.mark],who,'mark')}
  }
  // PHASE MARK 부여: PLAYER/ECHO의 DASH가 적에게 피해를 주면
  if(s.mark&&kind==='dash'&&e.hp>0)st.mark={src:who,t0:t};
  // RESONANCE: 같은 적을 PLAYER와 ECHO가 0.8초 안에 각각 맞히면 (적별 쿨 0.8초). 같은 주체 연속 타격은 해당 없음
  if(s.resonance){
    st.res[who]=t;
    if(e.hp>0&&t-st.res[other]<=SYN.resTicks&&t-st.res.cd>=SYN.resCd){st.res.cd=t;tel.resonance++;applyExtra(e,RES_DMG[s.resonance],who,'resonance')}
  }
}
const markOf=e=>(e.syn&&e.syn.mark&&G.t-e.syn.mark.t0<SYN.markTicks)?e.syn.mark:null;

/* ---- PHASE TRAIL ---- */
// a: 플레이어 또는 ECHO. 대시 중 매 틱 이동 구간을 트레일 조각으로 남긴다(조각 수명 0.8초). 대시 1회 = 트레일 1개, 적은 트레일당 1회만 피해.
function trailDash(a,src,px,py){
  if(!B().stacks.trail)return;
  if(!a.trail){a.trail={src,segs:[],hit:new Set()};G.trails.push(a.trail)}
  a.trail.segs.push({x1:px,y1:py,x2:a.x,y2:a.y,t:G.t});
}
function updateTrails(){
  if(!G.trails.length)return;
  const dmg=TRAIL_DMG[B().stacks.trail||0];             // 이미 존재하는 ECHO/트레일에도 현재 스택을 즉시 적용
  for(const tr of G.trails){
    tr.segs=tr.segs.filter(sg=>G.t-sg.t<SYN.trailTtl);
    if(!tr.segs.length||!dmg)continue;
    for(const e of G.enemies){
      if(e.hp<=0||e.dead||e.spawn>0||tr.hit.has(e))continue;
      for(const sg of tr.segs){
        if(distToSeg(e.x,e.y,sg.x1,sg.y1,sg.x2,sg.y2)<=e.r+SYN.trailR){
          tr.hit.add(e);G.stats.tel.syn.trailHits++;
          hitEnemy(e,dmg,tr.src,Math.atan2(sg.y2-sg.y1,sg.x2-sg.x1),0,null,'trail');
          break;
        }
      }
    }
  }
  G.trails=G.trails.filter(tr=>tr.segs.length>0||tr===G.p.trail||G.echoes.some(e=>e.trail===tr));   // 대시가 끝나고 조각이 모두 사라지면 제거
}
