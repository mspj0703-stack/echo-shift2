#!/usr/bin/env node
// GPT Supervisor v0.1
// Asks the OpenAI Responses API to decide ONE next task for the Claude worker,
// based only on this CI run's build/unit-test logs, and writes NEXT_TASK.md.
// This script never modifies game code (src/js/*.js) and never commits or opens a PR —
// NEXT_TASK.md is uploaded as a CI artifact only.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT_FILE = path.join(ROOT, 'NEXT_TASK.md');
const MODEL = 'gpt-5.6-luna';
const HEADINGS = ['# Decision', '# Why', '# Claude Prompt', '# Acceptance Criteria', '# Test Plan', '# Stop Conditions'];

function readTail(file, maxChars) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length > maxChars ? '...(truncated)...\n' + text.slice(-maxChars) : text;
  } catch (e) {
    return `(로그 없음: ${file} — ${e.message})`;
  }
}

function writeFallback(reason) {
  const md = `# Decision\n(GPT 호출 실패로 결정 없음)\n\n# Why\n${reason}\n\n# Claude Prompt\n(N/A)\n\n# Acceptance Criteria\n(N/A)\n\n# Test Plan\n(N/A)\n\n# Stop Conditions\n(N/A)\n`;
  fs.writeFileSync(OUT_FILE, md);
}

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  let text = '';
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && typeof c.text === 'string') text += c.text;
        }
      }
    }
  }
  return text;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    writeFallback('OPENAI_API_KEY secret이 설정되어 있지 않습니다.');
    console.error('OPENAI_API_KEY is not set.');
    process.exit(1);
  }

  const buildLog = readTail(path.join(ROOT, 'build.log'), 6000);
  const unitLog = readTail(path.join(ROOT, 'unit-test-logs', 'unit-tests.log'), 12000);

  const systemPrompt = [
    '당신은 ECHO//SHIFT v2.6.1 (단일 파일 브라우저 게임, dist/echo_shift_2_6_1.html, src/js/*.js를 build.js로 이어붙여 생성) 저장소를 감독하는 GPT 감독관입니다.',
    '역할: 이번 CI 실행의 빌드 로그와 유닛 테스트 로그만 근거로, Claude 작업자에게 넘길 "다음 작업 딱 1개"를 결정합니다.',
    '',
    '중요 제약:',
    '- 게임 로직(src/js/*.js) 수정 코드를 직접 출력하지 마세요. 당신은 다음 작업을 설명만 합니다.',
    '- 자동 커밋이나 PR 생성을 지시하지 마세요. Claude Prompt에는 "커밋/푸시는 사용자 확인 후 진행"이라는 전제를 유지하세요.',
    '- tests/sim/long_build.js 와 tests/sim/ablation.js 는 기본값(N=200)에서 판당 300초+ 전체 런을 최대 1000회 수행하며, tests/run_all.js의 900초(15분) spawnSync 타임아웃을 CPU가 느린 환경에서 초과해 FAIL로 표시될 수 있음이 이미 확인되었습니다. 이는 게임 로직 버그가 아니라 실행 환경의 속도/타임아웃 설정 문제입니다. 이 두 잡이 이번 실행에 포함되지 않았거나 과거에 실패했다는 사실을 게임 버그로 취급하거나, 이를 "고치는" 작업을 다음 작업으로 제안하지 마세요.',
    '- 오직 아래 6개 헤딩을 이 순서 그대로, 정확히 이 텍스트로 사용해 응답 전체를 구성하세요. 각 헤딩 아래에 내용을 채우세요. 다른 헤딩, 서문, 코드 블록 전체 감싸기 등을 추가하지 마세요.',
    '',
    HEADINGS.join('\n'),
  ].join('\n');

  const userPrompt = [
    '## 이번 CI 실행 결과',
    '',
    '### npm run build 로그',
    '```',
    buildLog,
    '```',
    '',
    '### tests/unit/*.js 전체 실행 로그',
    '```',
    unitLog,
    '```',
    '',
    '위 로그만 근거로 다음 Claude 작업 1개를 결정해 주세요.',
  ].join('\n');

  const body = {
    model: MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    writeFallback(`OpenAI Responses API 호출 중 네트워크 오류: ${e.message}`);
    console.error(e);
    process.exit(1);
  }

  const raw = await res.text();
  if (!res.ok) {
    writeFallback(`OpenAI Responses API가 HTTP ${res.status}를 반환했습니다:\n\n${raw.slice(0, 2000)}`);
    console.error(`OpenAI API error ${res.status}: ${raw.slice(0, 2000)}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    writeFallback(`OpenAI 응답 JSON 파싱 실패: ${e.message}`);
    process.exit(1);
  }

  const text = extractText(data);
  if (!text || !text.trim()) {
    writeFallback('OpenAI 응답에서 텍스트를 추출하지 못했습니다.');
    process.exit(1);
  }

  const missing = HEADINGS.filter((h) => !text.includes(h));
  let finalText = text.trim() + '\n';
  if (missing.length) {
    finalText += `\n<!-- VALIDATION WARNING: 응답에 다음 헤딩이 없습니다: ${missing.join(', ')} -->\n`;
  }

  fs.writeFileSync(OUT_FILE, finalText);
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((e) => {
  writeFallback(`예상치 못한 오류: ${e && e.message}`);
  console.error(e);
  process.exit(1);
});
