// 2.0 핵심: ECHO 녹화/재생, 대시, 사망 (v2.6 흐름에 맞게: 300초 → 보스 등장)
const {load,steps,ok,summary}=require('../harness');const S={fails:0,total:0};const t=(c,m)=>ok(S,c,m);
const quiet=E=>{E().G.spawnT=1e9};
{const{errs,E}=load();t(E().G.phase==='title','타이틀 상태로 시작');E().startGame();t(E().G.phase==='play','시작');
 steps(E,600,);for(let i=0;i<20;i++)E().render();t(errs.length===0,'600틱 + 렌더 예외 없음 '+errs.slice(0,2))}
{const{E}=load();E().startGame();quiet(E);steps(E,239);t(E().G.echoes.length===0,'239틱: ECHO 없음');steps(E,1);t(E().G.echoes.length===1&&E().G.echoes[0].clip.length===240,'240틱: ECHO 1개, 클립 240틱');
 steps(E,240);t(E().G.echoes.length===2,'8초: ECHO 2개');steps(E,240);t(E().G.echoes.length===3,'12초: ECHO 3개');}
{const{E}=load();E().startGame();quiet(E);E().keys.add('KeyD');steps(E,100);E().keys.delete('KeyD');E().keys.add('KeyS');steps(E,140);E().keys.delete('KeyS');
 const clip=E().G.echoes[0].clip;let bad=0;for(let k=1;k<=200;k++){E().step();const e=E().G.echoes[0];if(e.x!==clip[k-1].x||e.y!==clip[k-1].y)bad++}
 t(bad===0,'ECHO가 녹화된 위치를 틱 단위로 그대로 재생 (불일치 '+bad+')');}
{const{E}=load();E().startGame();quiet(E);E().input.aimAngle=0;E().input.atk=true;steps(E,240);E().input.atk=false;
 const clip=E().G.echoes[0].clip,N=clip.filter(f=>f.atk).length;let cnt=0;
 for(let k=0;k<240;k++){E().step();cnt+=E().G.fx.filter(f=>f.k==='slash'&&f.src==='echo'&&f.t<1.5/60).length}
 t(N>=10&&cnt===N,'ECHO가 같은 횟수/틱에 공격 재생 ('+cnt+'/'+N+')');}
{const{E}=load();E().startGame();quiet(E);steps(E,240);const id=E().G.echoes[0].id;steps(E,719);t(E().G.echoes.some(e=>e.id===id),'생성 후 719틱: 존재');steps(E,1);t(!E().G.echoes.some(e=>e.id===id),'720틱(12초): 소멸');}
{const{E}=load();E().startGame();quiet(E);const G=E().G;G.p.hp=1;
 G.enemies=[{type:'chaser',x:G.p.x,y:G.p.y,r:11,hp:2,maxHp:2,kx:0,ky:0,flash:0,spawn:0,cd:9,wind:0,aim:0,touchCd:0}];steps(E,3);t(G.phase==='dead','HP 0 → 사망');}
{const{E}=load();E().startGame();const G=E().G;G.p.hp=1e6;G.runT=299*60;G.phaseIdx=2;   // v2.6: 일반 구간 300초 끝(PHASE 3)에서 시작
 for(let i=0;i<120&&G.stage==='survive';i++){if(G.phase==='levelup')E().chooseUpgrade(0);E().step()}   // 레벨업 선택창은 자동 선택
 
 t(G.stage==='intro'&&G.phase==='play','300초 경과 → 승리가 아니라 보스 등장 연출');}
{const{E}=load();E().startGame();const G=E().G;G.p.hp=1e6;G.spawnT=1e9;
 for(let i=0;i<3600;i++){if(G.phase==='levelup')E().chooseUpgrade(0);E().step()}
 t(G.stats.echoes===15,'60초 동안 ECHO 15회 생성 ('+G.stats.echoes+')');}
process.exit(summary(S,'unit_core')?0:1);
