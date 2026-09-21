# ECHO//SHIFT v2.6.1 테스트 결과

- ✅ `unit_core` — ALL PASS unit_core (14/14)
- ✅ `unit_enemies` — ALL PASS v2.2 단위
- ✅ `unit_xp` — ALL PASS 2.1
- ✅ `unit_boss` — ALL PASS unit_boss (86/86)
- ✅ `unit_upgrades` — ALL PASS unit_upgrades (17/17)
- ✅ `unit_synergy` — ALL PASS unit_synergy (55/55)
- ✅ `unit_bots` — ALL PASS unit_bots (7/7)
- ✅ `unit_elite` — ALL PASS unit_elite (116/116)
- ✅ `unit_run` — ALL PASS unit_run (41/41)
- ✅ `sim_survive` — 게임 300 | 120초 생존(무적+일반 합) 124 사망 176 | 예외 0 NaN 0 상한위반 0 XP불일치 0
- ✅ `sim_boss` — 상태/수치 문제: 0 개, 예외 0 개, 총 틱 5051998 경과 150.3s
- ✅ `upgrade_benchmark` — 경과 523.4s
- ✅ `build_benchmark` — 예외 0 경과 226.5s
- ✅ `elite_bench` — 
- ✅ `sim_run` — 예외 0 문제 0 경과 595.6s
- ❌ `long_build` — 
- ❌ `ablation` — 

## BOT A/B/C — 보스 단독 (각 200판, 동일 seed 세트)

| BOT | 클리어율 | 클리어 시간 | 받은 총 피해 | 접촉 피해 | SYNC BREAK | 방패 중 준 피해 | 취약 중 준 피해 | ECHO 피해비율 | SYNC 대기 | LV |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 100% | 66.7s | 0.14 | 0.07 | 6.3 | 25 | 155 | 27% | 4.58s | 6.0 |
| B | 97% | 26.7s | 1.07 | 0.39 | 3.9 | 14 | 165 | 63% | 1.40s | 6.0 |
| C | 100% | 23.6s | 0.79 | 0.30 | 3.4 | 13 | 167 | 67% | 1.44s | 6.0 |

## BOT A/B/C — 전체 런(일반 구간 후 보스) (각 200판, 동일 seed 세트)

| BOT | 클리어율 | 클리어 시간 | 받은 총 피해 | 접촉 피해 | SYNC BREAK | 방패 중 준 피해 | 취약 중 준 피해 | ECHO 피해비율 | SYNC 대기 | LV |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 100% | 70.5s | 0.17 | 0.09 | 6.4 | 27 | 153 | 26% | 5.01s | 5.7 |
| B | 78% | 29.2s | 1.80 | 1.62 | 3.9 | 13 | 153 | 61% | 1.76s | 5.7 |
| C | 98% | 24.5s | 0.60 | 0.40 | 3.5 | 13 | 166 | 68% | 1.57s | 5.7 |

(v2.3 당시 BOT A 접촉 피해: 보스 단독 4.52 / 전체 런 3.96)

크래시/예외 0건, NaN·상태 오류 0건, 총 5051998틱

## 5분 런 (상세: RUN_REPORT.md / DEATH_REPORT.md)

| 봇 | 보스 도달률 | 클리어율 | 평균 총 런 | 보스 진입 LV | ECHO 피해 비율 |
|---|---|---|---|---|---|
| BASIC | 62% | 60% | 5:01 | 12.0 | 43% |
| SMART | 69% | 66% | 4:52 | 12.0 | 50% |

런 시뮬 예외 0건, 상태/상한 문제 0건 (봇당 300판)

## 300초 빌드 벤치마크 (상세: LONG_BUILD_REPORT.md)

| 빌드 | 보스 도달률 | 클리어율 | 처치 | BASIC | ECHO | DASH·TRAIL | SYNERGY |
|---|---|---|---|---|---|---|---|
| ATTACK | 79% | 78% | 234 | 90% | 49% | 3% | 2% |
| ECHO | 76% | 75% | 231 | 85% | 54% | 5% | 3% |
| DASH | 74% | 73% | 232 | 81% | 46% | 10% | 3% |
| HYBRID | 68% | 66% | 224 | 82% | 47% | 6% | 5% |
| RANDOM | 71% | 70% | 226 | 85% | 49% | 6% | 3% |

- 정체성: ATTACK ✅ · ECHO ✅ · DASH ✅ · HYBRID ✅
- LONG BUILD DOMINANCE: 없음

## SMART ABLATION (상세: ABLATION_REPORT.md)

- FULL SMART: 보스 도달률 74%
- NO WARDEN FLANK: 보스 도달률 68%
- NO PHASE LURE: 보스 도달률 74%
- NO ELITE SYNC: 보스 도달률 82%
- BASIC (대조군): 보스 도달률 67%

## 업그레이드 벤치마크 요약 (상세: BENCHMARK_REPORT.md)

- 조건당 100회(일반 구간+보스), 동일 seed 세트
- BALANCE OUTLIER: sharp@max (보스 클리어 시간 -33%); rapid@max (보스 클리어 시간 -33%); power@max (보스 클리어 시간 -35%)

## ELITE 요약 (상세: ELITE_REPORT.md)

- 특성×봇 조합당 300판
- SYNC LOCK: SMART 처치 시간 14% 감소 → ❌
- RELAY CORE: SMART의 BURST x3.8 (발동 ✅) / 주변 적 처치 기여 0.20기 (기여 ✅) / 처치 시간 11.1s vs 10.3s (❌)

## 빌드 벤치마크 요약 (상세: BUILD_REPORT.md)

- 빌드당 200판(일반+보스), BUILD DOMINANCE: 없음
- ✅ ATTACK: 직접 공격(PLAYER 기본 공격) DPS 최고
- ✅ ECHO: ECHO 피해 비율 최고 (일반+보스 평균)
- ✅ DASH: DASH·TRAIL 피해 비율 최고
- ✅ DASH: 생존성(평균 생존시간 또는 보스 받은 피해)이 다른 빌드 평균보다 우수
- ✅ HYBRID: RESONANCE/PHASE MARK 발동 빈도 최고 (일반, 분당)
- ✅ HYBRID: 시너지 피해 비율(ECHO 활용 보상) 최고
