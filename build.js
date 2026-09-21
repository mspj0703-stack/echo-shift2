#!/usr/bin/env node
/* 모듈(src/js/*.js) + style.css + template.html → 단일 실행 파일(dist/echo_shift_<ver>.html)
   사용: node build.js [버전]   (기본 2.3) */
const fs=require('fs'),path=require('path');
const ver=process.argv[2]||'2.3';
const root=__dirname,src=path.join(root,'src');
const files=fs.readdirSync(path.join(src,'js')).filter(f=>f.endsWith('.js')).sort();
const banner=`/*
  ECHO//SHIFT ${ver} — 실시간 탑다운 프로토타입 (빌드 산출물: src/js/*.js를 순서대로 이어 붙임)
  핵심 가설: "몇 초 전의 내 행동을 ECHO가 그대로 반복한다".
  고정 타임스텝(60틱/초) 시뮬레이션. 수치는 00_config.js의 CFG에서 조정.
*/`;
const script=banner+'\n(()=>{\n\'use strict\';\n'+files.map(f=>'/* >>> '+f+' */\n'+fs.readFileSync(path.join(src,'js',f),'utf8')).join('\n')+'\n})();';
let html=fs.readFileSync(path.join(src,'template.html'),'utf8');
html=html.replace('{{STYLE}}',()=>fs.readFileSync(path.join(src,'style.css'),'utf8').trimEnd()).replace('{{SCRIPT}}',()=>script);
html=html.replace(/<title>[^<]*<\/title>/,'<title>ECHO//SHIFT '+ver+' 프로토타입</title>');
const out=path.join(root,'dist','echo_shift_'+ver.replace(/\./g,'_')+'.html');
fs.writeFileSync(out,html);
console.log('built',out,(html.length/1024).toFixed(1)+'KB',files.length+' modules');
