#!/usr/bin/env node
// 전체 자동 검증: 단위 테스트 6종 + 일반구간 시뮬 + 보스 시뮬(A/B/C) + 업그레이드 벤치마크 → tests/reports/*.log, TEST_REPORT.md, BENCHMARK_REPORT.md
// 사용: node tests/run_all.js [보스단독N=200] [전체런N=100] [업그레이드 벤치마크 RUNS=100] [빌드 벤치마크 RUNS=200]   (사전: npm i, node build.js 2.4)
const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const T=__dirname,out=path.join(T,'reports');fs.mkdirSync(out,{recursive:true});
const ERUNS=process.env.ERUNS||'300';
const RRUNS=process.env.RRUNS||'300';
const LRUNS=process.env.LRUNS||'200';        // v2.6.1 300초 빌드 벤치마크
const ARUNS=process.env.ARUNS||'200';        // v2.6.1 SMART ablation          // v2.6 전체 런: 봇당 300판
const N=process.argv[2]||'200',FULL=process.argv[3]||'200',RUNS=process.argv[4]||'100',BRUNS=process.argv[5]||'200';
const jobs=[['unit_core',['unit/unit_core.js']],['unit_enemies',['unit/unit_enemies.js']],['unit_xp',['unit/unit_xp.js']],['unit_boss',['unit/unit_boss.js']],
 ['unit_upgrades',['unit/unit_upgrades.js']],['unit_synergy',['unit/unit_synergy.js']],['unit_bots',['unit/unit_bots.js']],['unit_elite',['unit/unit_elite.js']],['unit_run',['unit/unit_run.js']],
 ['sim_survive',['sim/sim_survive.js','150']],['sim_boss',['sim/sim_boss.js',N,FULL]],['upgrade_benchmark',['sim/upgrade_benchmark.js',RUNS]],['build_benchmark',['sim/build_benchmark.js',BRUNS]],['elite_bench',['sim/elite_bench.js',ERUNS]],['sim_run',['sim/sim_run.js',RRUNS]],['long_build',['sim/long_build.js',LRUNS]],['ablation',['sim/ablation.js',ARUNS]]];
const res={};let allOk=true;
for(const[name,args]of jobs){
  const r=spawnSync('node',args,{cwd:T,encoding:'utf8',timeout:900000,env:process.env});
  fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||''));
  const summ=((r.stdout||'').split('\n').filter(l=>/ALL PASS|FAILS|게임 \d+|상태\/수치|경과/.test(l)).pop()||'').trim();
  res[name]={ok:r.status===0,summ};if(r.status!==0)allOk=false;
  console.log((r.status===0?'OK   ':'FAIL ')+name+' — '+summ);
}
const b=JSON.parse(fs.readFileSync(path.join(T,'sim/out/boss_report.json'),'utf8'));
let run=null;try{run=JSON.parse(fs.readFileSync(path.join(T,'sim/out/run_report.json'),'utf8'))}catch(e){}
const bm=JSON.parse(fs.readFileSync(path.join(T,'sim/out/benchmark_report.json'),'utf8'));
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-';
let md='# ECHO//SHIFT v2.6.1 테스트 결과\n\n'+jobs.map(([n])=>'- '+(res[n].ok?'✅':'❌')+' `'+n+'` — '+res[n].summ).join('\n')+'\n';
for(const mode of['boss','full']){
  md+='\n## BOT A/B/C — '+(mode==='boss'?'보스 단독':'전체 런(일반 구간 후 보스)')+' (각 '+b[mode].A.n+'판, 동일 seed 세트)\n\n| BOT | 클리어율 | 클리어 시간 | 받은 총 피해 | 접촉 피해 | SYNC BREAK | 방패 중 준 피해 | 취약 중 준 피해 | ECHO 피해비율 | SYNC 대기 | LV |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for(const k of['A','B','C']){const s=b[mode][k];md+='| '+k+' | '+f(s.clear*100,0)+'% | '+f(s.timeWin)+'s | '+f(s.taken,2)+' | '+f(s.takenBy.contact,2)+' | '+f(s.breaks)+' | '+f(s.shieldDmg,0)+' | '+f(s.vulnDmg,0)+' | '+f(s.echoShare*100,0)+'% | '+f(s.syncWait,2)+'s | '+f(s.level)+' |\n'}
}
md+='\n(v2.3 당시 BOT A 접촉 피해: 보스 단독 4.52 / 전체 런 3.96)\n\n크래시/예외 '+b.exceptions+'건, NaN·상태 오류 '+b.problems.length+'건, 총 '+b.ticks+'틱\n';
if(run){const s=run.summary;
 md+='\n## 5분 런 (상세: RUN_REPORT.md / DEATH_REPORT.md)\n\n| 봇 | 보스 도달률 | 클리어율 | 평균 총 런 | 보스 진입 LV | ECHO 피해 비율 |\n|---|---|---|---|---|---|\n';
 for(const k of['BASIC','SMART']){const x=s[k];md+='| '+k+' | '+(x.reachRate*100).toFixed(0)+'% | '+(x.winRate*100).toFixed(0)+'% | '+Math.floor(x.totalT/60)+':'+String(Math.round(x.totalT%60)).padStart(2,'0')+' | '+f(x.bossLevel)+' | '+(x.dmg.echo*100).toFixed(0)+'% |\n'}
 md+='\n런 시뮬 예외 '+run.exceptions+'건, 상태/상한 문제 '+run.problems.length+'건 (봇당 '+run.N+'판)\n';}
try{const lb=JSON.parse(fs.readFileSync(path.join(T,'sim/out/long_build_report.json'),'utf8'));
 md+='\n## 300초 빌드 벤치마크 (상세: LONG_BUILD_REPORT.md)\n\n| 빌드 | 보스 도달률 | 클리어율 | 처치 | BASIC | ECHO | DASH·TRAIL | SYNERGY |\n|---|---|---|---|---|---|---|---|\n';
 for(const b of['ATTACK','ECHO','DASH','HYBRID','RANDOM']){const s=lb.summary[b];md+='| '+b+' | '+(s.reach*100).toFixed(0)+'% | '+(s.win*100).toFixed(0)+'% | '+s.kills.toFixed(0)+' | '+(s.basic*100).toFixed(0)+'% | '+(s.echo*100).toFixed(0)+'% | '+(s.dash*100).toFixed(0)+'% | '+(s.syn*100).toFixed(0)+'% |\n'}
 md+='\n- 정체성: '+Object.entries(lb.identity).map(([k,v])=>k+(v?' ✅':' ❌')).join(' · ')+'\n- LONG BUILD DOMINANCE: '+(lb.dominance.length?lb.dominance.map(d=>d.build).join(', '):'없음')+'\n';}catch(e){}
try{const ab=JSON.parse(fs.readFileSync(path.join(T,'sim/out/ablation_report.json'),'utf8'));
 md+='\n## SMART ABLATION (상세: ABLATION_REPORT.md)\n\n'+Object.entries(ab.summary).map(([k,s])=>'- '+k+': 보스 도달률 '+(s.reach*100).toFixed(0)+'%').join('\n')+'\n';}catch(e){}
md+='\n## 업그레이드 벤치마크 요약 (상세: BENCHMARK_REPORT.md)\n\n- 조건당 '+bm.runs+'회(일반 구간+보스), 동일 seed 세트\n- BALANCE OUTLIER: '+(bm.outliers.length?bm.outliers.map(o=>o.key+' ('+o.why.join(' / ')+')').join('; '):'없음')+'\n';
const bd=JSON.parse(fs.readFileSync(path.join(T,'sim/out/build_report.json'),'utf8'));
try{const el=JSON.parse(fs.readFileSync(path.join(T,'sim/out/elite_report.json'),'utf8')),v=el.verdict;
 md+='\n## ELITE 요약 (상세: ELITE_REPORT.md)\n\n- 특성×봇 조합당 '+el.N+'판\n- SYNC LOCK: SMART 처치 시간 '+(v.lockGain*100).toFixed(0)+'% 감소 → '+(v.lock?'✅':'❌')+'\n- RELAY CORE: SMART의 BURST x'+v.burstX.toFixed(1)+' (발동 '+(v.relayBursts?'✅':'❌')+') / 주변 적 처치 기여 '+v.contrib.toFixed(2)+'기 (기여 '+(v.relayKills?'✅':'❌')+') / 처치 시간 '+v.timeSmart.toFixed(1)+'s vs '+v.timeIgnore.toFixed(1)+'s ('+(v.relayNotSlower?'✅':'❌')+')\n';}catch(e){}
md+='\n## 빌드 벤치마크 요약 (상세: BUILD_REPORT.md)\n\n- 빌드당 '+bd.runs+'판(일반+보스), BUILD DOMINANCE: '+(Object.entries(bd.dominance).filter(([k,v])=>v.dominant).map(([k])=>k).join(', ')||'없음')+'\n'+bd.character.map(c=>'- '+(c.pass?'✅':'❌')+' '+c.name).join('\n')+'\n';
fs.writeFileSync(path.join(T,'..','TEST_REPORT.md'),md);
process.exit(allOk?0:1);

