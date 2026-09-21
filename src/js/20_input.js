/* ================= INPUT ================= */
const keys=new Set();
const input={dash:false,atk:false,aimAngle:null};   // aimAngle: 테스트/고정 조준용
const mouse={x:W/2,y:H/2,seen:false,down:false};
const touch={active:false,joyX:0,joyY:0,atk:false};
let isTouch=false;
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const c=e.code;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ','Enter','Digit1','Digit2','Digit3'].includes(c))e.preventDefault();
  ensureAudio();
  if(G.phase==='levelup'){                       // 레벨업 선택 중: 1/2/3만 유효 (ESC 등으로 넘길 수 없음)
    if(e.repeat)return;
    keys.add(c);
    const m=/^(?:Digit|Numpad)([1-3])$/.exec(c);
    if(m)chooseUpgrade(Number(m[1])-1);
    else if(c==='KeyR')startGame();
    else if(c==='KeyM')muted=!muted;
    return;
  }
  if(e.repeat)return;
  keys.add(c);
  if(c==='Space'){input.dash=true}
  if(c==='Enter'&&(G.phase==='title'||G.phase==='dead'||G.phase==='win'))startGame();
  if(c==='KeyR')startGame();
  if(c==='KeyM')muted=!muted;
});
window.addEventListener('keyup',e=>{keys.delete(e.code)});
window.addEventListener('blur',()=>{keys.clear();mouse.down=false});
function canvasPos(e){
  const r=cv.getBoundingClientRect();
  return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
}
cv.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;mouse.seen=true});
cv.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;ensureAudio();const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;mouse.seen=true;mouse.down=true;if(G.phase==='play'){}});
window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')mouse.down=false});
cv.addEventListener('contextmenu',e=>e.preventDefault());
$('btnStart').addEventListener('click',()=>{ensureAudio();startGame()});
$('btnRetry').addEventListener('click',()=>{ensureAudio();startGame()});

// 터치 컨트롤
const touchUI=$('touch'),joyZone=$('joyZone'),joyBase=$('joyBase'),joyKnob=$('joyKnob'),rotHint=$('rot');
function enableTouch(){if(isTouch)return;isTouch=true;touchUI.classList.remove('hidden');updateRot()}
function updateRot(){rotHint.classList.toggle('hidden',!(isTouch&&window.innerHeight>window.innerWidth))}
window.addEventListener('resize',updateRot);
if(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches)enableTouch();
let joyId=null,joyO=null;
joyZone.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse')return;
  enableTouch();ensureAudio();joyId=e.pointerId;joyZone.setPointerCapture(e.pointerId);
  const r=$('stage').getBoundingClientRect();joyO={x:e.clientX,y:e.clientY};
  for(const el of[joyBase,joyKnob]){el.style.display='block';el.style.left=(e.clientX-r.left)+'px';el.style.top=(e.clientY-r.top)+'px'}
  touch.active=true;touch.joyX=0;touch.joyY=0;
});
joyZone.addEventListener('pointermove',e=>{
  if(e.pointerId!==joyId)return;
  let dx=e.clientX-joyO.x,dy=e.clientY-joyO.y;const d=Math.hypot(dx,dy),max=48;
  if(d>max){dx=dx/d*max;dy=dy/d*max}
  touch.joyX=dx/max;touch.joyY=dy/max;
  const r=$('stage').getBoundingClientRect();
  joyKnob.style.left=(joyO.x-r.left+dx)+'px';joyKnob.style.top=(joyO.y-r.top+dy)+'px';
});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;touch.active=false;touch.joyX=0;touch.joyY=0;joyBase.style.display='none';joyKnob.style.display='none'};
joyZone.addEventListener('pointerup',joyEnd);joyZone.addEventListener('pointercancel',joyEnd);
const tAtk=$('tAtk'),tDash=$('tDash');
tAtk.addEventListener('pointerdown',e=>{enableTouch();ensureAudio();tAtk.setPointerCapture(e.pointerId);touch.atk=true;e.preventDefault()});
const atkEnd=()=>{touch.atk=false};
tAtk.addEventListener('pointerup',atkEnd);tAtk.addEventListener('pointercancel',atkEnd);
tDash.addEventListener('pointerdown',e=>{enableTouch();ensureAudio();input.dash=true;e.preventDefault()});

