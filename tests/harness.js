// 공용 테스트 하네스: 게임(단일 HTML)을 jsdom에 올려 __ES2 훅으로 조작한다. (캔버스는 기록형 스텁)
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=process.env.ES_HTML||path.join(__dirname,'..','dist','echo_shift_2_6_1.html');
const html=fs.readFileSync(HTML,'utf8');
function makeCtx(record){
  const store={};const calls=record?[]:null;
  const ctx=new Proxy(store,{
    get:(t,k)=>{if(k in t)return t[k];return(...a)=>{if(calls)calls.push([k,...a])}},
    set:(t,k,v)=>{t[k]=v;return true}
  });
  return{ctx,calls};
}
// 재현 가능한 난수 (mulberry32). 게임의 Math.random(스폰/무작위 위치/업그레이드 후보)을 seed로 교체한다.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function load(opts){
  opts=opts||{};const errs=[];const{ctx,calls}=makeCtx(opts.record);
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.addEventListener('error',e=>errs.push(e.message))}});
  const w=dom.window;
  const st={rand:Math.random};
  const setSeed=n=>{const r=mulberry32(n>>>0);w.Math.random=r;st.rand=r;return r};
  if(opts.seed!==undefined)setSeed(opts.seed);
  return{w,errs,calls,E:()=>w.__ES2,doc:w.document,close:()=>w.close(),setSeed,rand:()=>st.rand()};
}
const steps=(E,n)=>{for(let i=0;i<n;i++)E().step()};
const ok=(state,cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg);if(!cond)state.fails++;state.total++};
function summary(state,name){console.log((state.fails?'FAILS: '+state.fails:'ALL PASS')+' '+name+' ('+(state.total-state.fails)+'/'+state.total+')');return state.fails===0}
module.exports={load,steps,ok,summary,HTML,mulberry32};
