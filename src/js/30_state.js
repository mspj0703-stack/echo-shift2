/* ================= STATE ================= */
// 플레이 행동 데이터 (밸런스/재미 검증용): 구간별 스폰, 종류별 처치 주체, PHASE 충돌, 방패 차단 등
function newTel(){
  return{spawn:[{},{},{},{},{},{}],killBy:{chaser:{player:0,echo:0},shooter:{player:0,echo:0},phase:{player:0,echo:0},warden:{player:0,echo:0}},
    dmgDealt:{player:0,echo:0},dmg:{player:{},echo:{}},dmgBoss:{player:{},echo:{}},syn:{resonance:0,mark:0,trailHits:0,fbHits:0,fbSaved:0},phaseCollisions:0,phaseCollisionKills:0,phaseEchoTicks:0,phasePlayerTicks:0,
    shieldBlocked:{player:0,echo:0},wardenHit:{player:0,echo:0},
    run:{heal:0,phaseEnd:[],bossEntry:null,levelAt:{},firstPick:{},maxAt:{}},
    elite:{spawned:{lock:0,relay:0},guardBroken:0,kills:{chaser:0,shooter:0},xpBonus:0,syncBreaks:0,relayBursts:0,relayKills:0,relayHits:0,relayAssists:0},
    boss:{syncBreaks:0,dmg:{player:0,echo:0},hits:{player:0,echo:0},taken:0,time:0,vulnDmg:0,shieldDmg:0,syncWait:0,syncWaitN:0,takenBy:{}}};
}
let G;
function newGame(phase){
  return{
    phase,t:0,
    p:{x:W/2,y:H/2,face:0,aim:0,hp:CFG.pHp,inv:0,atkCd:0,dashT:0,dashCd:0,dashAng:0,dashHit:new Set(),flash:0,r:CFG.pR,kx:0,ky:0,trail:null},
    enemies:[],shots:[],echoes:[],fx:[],
    rec:[],
    stats:{kills:0,you:0,echo:0,echoes:0,tel:newTel()},
    seen:{},noElite:false,notice:null,runT:0,shiftT:0,phaseIdx:0,death:null,trails:[],dmgLog:[],fbUsed:0,stage:'survive',stageT:0,bossT:0,boss:null,bossMsg:null,posHist:[],
    spawnT:1.0,shake:0,freeze:0,hurtFlash:0,nextEchoId:1,
    build:newBuild(),exp:newExp(),levelChoices:null
  };
}
G=newGame('title');

function startGame(){
  G=newGame('play');
  ovTitle.classList.add('hidden');ovEnd.classList.add('hidden');ovLevel.classList.add('hidden');
  input.dash=false;
}

