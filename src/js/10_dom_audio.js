/* ================= DOM / CANVAS ================= */
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d');
const ovTitle=$('ovTitle'),ovEnd=$('ovEnd'),endTitle=$('endTitle'),endStat=$('endStat');
const ovLevel=$('ovLevel'),lvTitle=$('lvTitle'),lvSub=$('lvSub'),lvChoices=$('lvChoices');
let dpr=1;
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
resize();

/* ================= SOUND (WebAudio, 외부 파일 없음) ================= */
let ac=null,muted=false;
function ensureAudio(){
  if(ac===null){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){ac=false}}
  if(ac&&ac.state==='suspended')ac.resume();
}
function beep(f,d,type,vol,slide){
  if(!ac||muted)return;
  const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
  o.type=type||'square';o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
  g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d);
}
const SFX={
  atk:()=>beep(340,.08,'sawtooth',.035,-170),
  eatk:()=>beep(240,.08,'sine',.03,-90),
  hit:()=>beep(170,.06,'square',.045),
  kill:()=>beep(95,.14,'square',.055,-40),
  dash:()=>beep(420,.12,'triangle',.045,420),
  hurt:()=>beep(75,.25,'sawtooth',.08,-30),
  echo:()=>{beep(440,.15,'sine',.05,220);setTimeout(()=>beep(660,.2,'sine',.04,0),90)},
  win:()=>{beep(520,.15,'triangle',.05,0);setTimeout(()=>beep(780,.3,'triangle',.05,0),140)},
  block:()=>beep(900,.05,'square',.04,-350),
  warn:()=>beep(330,.12,'square',.04,120),
  sync:()=>{beep(700,.12,'triangle',.06,500);setTimeout(()=>beep(1100,.2,'triangle',.05,0),80)},
  phase:()=>beep(210,.14,'sawtooth',.05,320),
  level:()=>{beep(620,.1,'triangle',.05,0);setTimeout(()=>beep(930,.16,'triangle',.05,0),90)}
};
const sfx=n=>{try{SFX[n]&&SFX[n]()}catch(e){}};

