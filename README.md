# ECHO//SHIFT v2.6.1 소스

- `src/js/*.js` — 게임 로직 모듈(숫자 순서대로 이어붙임). `65_boss.js` = PARADOX CORE, `92_render_boss.js` = 보스 렌더/HUD
- `src/template.html`, `src/style.css` — 페이지/스타일
- `node build.js 2.6.1` → `dist/echo_shift_2_6_1.html` (단일 실행 파일, 외부 의존 없음)
- `tests/harness.js` 공용 하네스, `tests/bots.js` 봇(SURVIVE / BOSS A·B·C), `tests/unit/*` 단위 테스트, `tests/sim/*` 시뮬레이션
- 실행: `npm i` → `node build.js 2.6.1` → `node tests/run_all.js` (결과: `TEST_REPORT.md`, `tests/reports/`)
- 수치는 `src/js/00_config.js`의 `CFG`(일반) / `BOSS`(보스, 시간은 틱=1/60초)

## v2.3.1 추가 사항
- SHARP EDGE: 스택당 기본 공격 피해 +20% (최대 5스택, 대시 제외)
- `tests/bots.js`: BOT A/B/C는 동일한 기본 조작·회피 코드를 공유, ECHO/SYNC 판단만 다름 (A는 ECHO API 미사용 — `unit_bots.js`가 정적/동적 검사)
- `tests/sim/upgrade_benchmark.js`: 동일 seed 업그레이드 벤치마크 + BALANCE OUTLIER 자동 판정 → `BENCHMARK_REPORT.md`
- `tests/harness.js`: `load({seed})` / `setSeed(n)`으로 게임 난수 재현

## v2.4 추가 사항 (BUILD IDENTITY)
- 업그레이드 11개: LONG SHIFT → PHASE TRAIL, 신규 RESONANCE / PHASE MARK / FEEDBACK LOOP, LONG REACH(+10%/최대 4), RAPID CUT(최대 5)
- `src/js/55_synergy.js`: 시너지 로직. 새 시너지는 `onRealHit(적, 주체, 종류)`에 붙인다. 피해 이벤트는 `logDamage`(source/kind/적 id/피해/틱)로 기록
- `tests/unit/unit_synergy.js`, `tests/sim/build_benchmark.js`(빌드별 200판, BUILD DOMINANCE 자동 판정 → `BUILD_REPORT.md`)
- 봇: 공격 대시(dashStrike)는 회피용 대시를 남겨 둘 때만 사용

## v2.5 추가 사항 (ELITE PRESSURE)
- PHASE TRAIL 지속 1.2초 → 0.8초 (피해 유지)
- `src/js/57_elite.js`: ELITE 상태(CHASER/SHOOTER에만 부여) — SYNC LOCK(피해 65% 감소, PLAYER+ECHO 1.25초 내 → BREAK 3초) / RELAY CORE(PLAYER+ECHO 1초 내 → 자신 1.5 + 반경 90 주변 적 1, 쿨 1.5초)
- `src/js/93_render_elite.js`: ELITE 외곽선·아이콘·보호막·BURST 이펙트, 특성별 첫 등장 안내
- `tests/unit/unit_elite.js`(88개), `tests/sim/elite_bench.js`(IGNORE/TIMING/SMART 비교 → `ELITE_REPORT.md`)
- `node tests/run_all.js`가 전체(단위 8종 + 일반 300판 + 보스 400판 + 업그레이드/빌드/ELITE 벤치마크)를 실행

## v2.5.1 추가 사항 (RELAY CORE FIX)
- RELAY CORE: 생성 시 RELAY GUARD(피해 -40%), 첫 RELAY BURST에 영구 해제(재생성 없음)
- RELAY BURST: 자신 +2, 반경 140px 주변 적 2 피해 + 약한 넉백 (쿨 1.5초 유지)
- SHARP EDGE 최대 5 → 4스택 (최종 1.8)
- `tests/unit/unit_elite.js` 113개(GUARD 15개 항목 포함), `tests/sim/elite_bench.js`는 IGNORE/TIMING/SMART 각 300판

## v2.6 추가 사항 (FIRST REAL RUN)
- 한 판 = 일반 구간 300초(PHASE 1/2/3) + PARADOX CORE. 90·210초 전환(4초, 스폰 정지·투사체 제거·타이머 정지·HP +2), 300초에 보스(연출 3초)
- `src/js/58_run.js` 런 구조, `00_config.js`의 `RUN`(구간별 상한·스폰 간격), `60_enemies.js`의 구간별 스폰 밴드 6단계
- ELITE: 45초 이후, 구간별 동시 최대 1/2/3
- 결과 화면 확장(피해 구성·업그레이드 목록·보스 결과) + RESTART
- `tests/unit/unit_run.js`(41개), `tests/sim/sim_run.js`(BASIC/SMART 장기 런 → `RUN_REPORT.md`, `DEATH_REPORT.md`)
- 업그레이드 이상치 판정을 ABSOLUTE(BASE 대비) / RELATIVE(다른 업그레이드 평균 대비)로 분리
- 주의: 렌더는 화면 흔들림에 난수를 쓰므로 시뮬레이션 중에는 호출하지 않는다(재현성)

## v2.6.1 추가 사항 (LONG RUN TUNING)
- WARDEN 이동 62→54, 후반 스폰 비중 하향(WARDEN 18/22/26% → 14/16/18%), PARADOX CORE HP 150→180
- `tests/sim/long_build.js` → `LONG_BUILD_REPORT.md` (ATTACK/ECHO/DASH/HYBRID/RANDOM, 300초 전체 런 200판씩, LONG BUILD DOMINANCE 판정)
- `tests/sim/ablation.js` → `ABLATION_REPORT.md` (SMART의 WARDEN 플랭크 / PHASE 유도 / ELITE SYNC 판단을 하나씩 제거해 기여도 분해)
- DEATH_REPORT에 DEATH SOURCE DOMINANCE(한 적이 사망 원인 60% 이상) 판정 추가
