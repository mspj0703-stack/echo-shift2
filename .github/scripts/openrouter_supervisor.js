#!/usr/bin/env node
// OpenRouter Supervisor v0.3
// Asks an OpenRouter free model to decide ONE next task for the Claude worker
// (or explicitly decide there is no safe next task), grounded only in this CI
// run's logs and a snapshot of the repo (README, package.json, test file
// lists, recent commits). Writes NEXT_TASK.md.
//
// This script never modifies game code (src/js/*.js) and never commits,
// pushes, or opens a PR — NEXT_TASK.md is uploaded as a CI artifact only.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT_FILE = path.join(ROOT, 'NEXT_TASK.md');
// openrouter/free always routes to a currently-available $0 model, so this
// doesn't break when individual vendor free models rotate out (they do, weekly).
const MODEL = 'openrouter/free';
const HEADINGS = ['# Decision', '# Why', '# Claude Prompt', '# Acceptance Criteria', '# Test Plan', '# Stop Conditions'];
const NO_ACTION_CLAUDE_PROMPT = '(작업 없음)';
const NO_ACTION_NA = '(N/A)';
// Loose evidence markers used to sanity-check that a TASK decision's "# Why"
// actually points at something from the supplied input, instead of being
// invented. This is a heuristic, not a semantic check.
const EVIDENCE_MARKERS = [
  'unit-tests.log', 'build.log', 'README.md', 'package.json',
  'tests/unit', 'tests/sim', 'src/js', 'commit', '.js', 'PASS', 'FAIL',
];

function truncateHead(str, maxChars) {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '\n...(truncated)...';
}

function readTail(file, maxChars) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length > maxChars ? '...(truncated)...\n' + text.slice(-maxChars) : text;
  } catch (e) {
    return `(로그 없음: ${file} — ${e.message})`;
  }
}

function readHeadSafe(file, maxChars) {
  try {
    return truncateHead(fs.readFileSync(file, 'utf8'), maxChars);
  } catch (e) {
    return `(파일 없음: ${file} — ${e.message})`;
  }
}

function listJsFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .sort();
  } catch (e) {
    return null;
  }
}

function getRecentCommits(n) {
  try {
    const out = execSync(`git log -${n} --pretty=format:%s`, { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch (e) {
    return null;
  }
}

function writeFallback(reason) {
  const md = `# Decision\n(OpenRouter 응답 형식 오류로 결정 없음)\n\n# Why\n${reason}\n\n# Claude Prompt\n${NO_ACTION_NA}\n\n# Acceptance Criteria\n${NO_ACTION_NA}\n\n# Test Plan\n${NO_ACTION_NA}\n\n# Stop Conditions\n${NO_ACTION_NA}\n`;
  fs.writeFileSync(OUT_FILE, md);
}

function extractText(data) {
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const content = choice && choice.message && choice.message.content;
  if (typeof content === 'string') return content;
  // Some OpenRouter models return content as an array of parts instead of a plain string.
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && (c.type === 'text' || typeof c.text === 'string'))
      .map((c) => c.text || '')
      .join('');
  }
  return '';
}

// Strictly parses the 6 fixed headings (in order, each on its own line) out
// of the model's raw response. Returns { ok:false, reason } or
// { ok:true, decision:'TASK'|'NO_ACTION', sections:{heading: body} }.
function parseSections(text) {
  const lines = text.split(/\r?\n/);
  const idx = HEADINGS.map((h) => lines.findIndex((l) => l.trim() === h));
  const missing = HEADINGS.filter((_, i) => idx[i] === -1);
  if (missing.length) {
    return { ok: false, reason: `다음 헤딩이 응답에 없습니다: ${missing.join(', ')}` };
  }
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] <= idx[i - 1]) {
      return { ok: false, reason: '헤딩 순서가 요구된 순서(Decision/Why/Claude Prompt/Acceptance Criteria/Test Plan/Stop Conditions)와 다릅니다.' };
    }
  }

  const sections = {};
  for (let i = 0; i < HEADINGS.length; i++) {
    const start = idx[i] + 1;
    const end = i + 1 < HEADINGS.length ? idx[i + 1] : lines.length;
    sections[HEADINGS[i]] = lines.slice(start, end).join('\n').trim();
  }

  const decisionBody = sections['# Decision'];
  const firstLine = (decisionBody.split('\n')[0] || '').trim();
  let decision = null;
  if (firstLine === 'TASK' || firstLine.startsWith('TASK')) decision = 'TASK';
  else if (firstLine === 'NO_ACTION' || firstLine.startsWith('NO_ACTION')) decision = 'NO_ACTION';
  if (!decision) {
    return { ok: false, reason: `# Decision의 첫 줄이 "TASK" 또는 "NO_ACTION"이 아닙니다 (받은 값: "${firstLine.slice(0, 80)}")` };
  }

  if (decision === 'TASK') {
    const why = sections['# Why'].toLowerCase();
    const hasEvidence = EVIDENCE_MARKERS.some((m) => why.includes(m.toLowerCase()));
    if (!hasEvidence) {
      return { ok: false, reason: 'Decision이 TASK인데 # Why에 로그/README/파일 등 구체적인 근거 인용이 없습니다.' };
    }
  }

  return { ok: true, decision, sections };
}

// TASK/NO_ACTION 판정과 무관하게, NO_ACTION일 때 세 섹션의 텍스트를 고정 문구로
// 강제한다 — 모델이 지시를 완벽히 따르지 않아도 v0.3 스펙(요구사항 3)을 항상 보장한다.
function normalize(parsed) {
  if (parsed.decision === 'NO_ACTION') {
    parsed.sections['# Claude Prompt'] = NO_ACTION_CLAUDE_PROMPT;
    parsed.sections['# Acceptance Criteria'] = NO_ACTION_NA;
    parsed.sections['# Test Plan'] = NO_ACTION_NA;
  }
  return parsed;
}

function render(sections) {
  return HEADINGS.map((h) => `${h}\n${sections[h]}`).join('\n\n') + '\n';
}

function buildPrompts(ctx) {
  const systemPrompt = [
    '당신은 ECHO//SHIFT v2.6.1 (단일 파일 브라우저 게임, dist/echo_shift_2_6_1.html, src/js/*.js를 build.js로 이어붙여 생성) 저장소를 감독하는 감독관입니다.',
    '역할: 아래에 주어지는 자료(이번 CI 실행의 빌드/유닛테스트 로그, README.md, package.json, 테스트 파일 목록, 최근 커밋 메시지)만 근거로, Claude 작업자에게 넘길 "다음 작업"을 결정합니다.',
    '당신에게 주어지는 정보는 이 자료뿐입니다. 이 자료에 없는 것은 모른다고 간주하세요.',
    '',
    '사실 검증 규칙 (반드시 지킬 것):',
    '- 입력 자료(로그/README/package.json/파일 목록/커밋 메시지)에서 직접 확인되지 않은 숫자·기능·테스트 결과를 사실처럼 말하지 마세요. 예를 들어 로그에 없는 총 테스트 개수(예: "269/269")를 임의로 만들어내지 마세요.',
    '- 입력 자료에 등장하지 않는 함수, 이벤트, 시스템, 파일이 존재한다고 가정하지 마세요.',
    '- 새로운 테스트나 기능을 제안하려면, 그 필요성을 입력 자료 안에서 구체적으로 확인할 수 있어야 합니다. 확인할 수 없으면 제안하지 마세요.',
    '- "테스트가 모두 통과했으니 테스트를 더 만들자"처럼 근거 없이 일을 만들어내는 제안은 금지합니다.',
    '- 입력 자료에 문제가 없고 다음 개발 목표를 판단할 근거가 부족하면, 작업을 억지로 만들어내지 말고 NO_ACTION을 선택하세요.',
    '',
    '기존 제약(유지):',
    '- 게임 로직(src/js/*.js) 수정 코드를 직접 출력하지 마세요. 당신은 다음 작업을 설명만 합니다.',
    '- 자동 커밋이나 push, PR 생성을 지시하지 마세요. Claude Prompt에는 "커밋/푸시는 사용자 확인 후 진행"이라는 전제를 유지하세요.',
    '- tests/sim/long_build.js 와 tests/sim/ablation.js 는 기본값(N=200)에서 판당 300초+ 전체 런을 최대 1000회 수행하며, tests/run_all.js의 900초(15분) spawnSync 타임아웃을 CPU가 느린 환경에서 초과해 FAIL로 표시될 수 있음이 이미 확인되었습니다. 이는 게임 로직 버그가 아니라 실행 환경의 속도/타임아웃 설정 문제입니다. 이 두 잡이 이번 실행에 포함되지 않았거나 과거에 실패했다는 사실을 게임 버그로 취급하거나, 이를 "고치는" 작업을 다음 작업으로 제안하지 마세요.',
    '',
    '출력 형식 (반드시 지킬 것):',
    '- 오직 아래 6개 헤딩을 이 순서 그대로, 정확히 이 텍스트로, 각각 한 줄에 하나씩 사용해 응답 전체를 구성하세요. 다른 헤딩, 서문, 전체를 감싸는 코드 블록 등을 추가하지 마세요.',
    '- "# Decision" 바로 다음 줄에는 정확히 TASK 또는 NO_ACTION 이라는 단어만 적고, 그 아래에 한두 문장으로 그 판단을 요약하세요.',
    '- Decision이 TASK이면: "# Why"에 어떤 로그/README 내용/파일/커밋에서 그 근거를 얻었는지 구체적으로 밝히세요 (예: "unit-tests.log에서 unit_run PASS 확인", "README.md의 v2.6.1 추가 사항 섹션", "tests/sim/ablation.js 파일 존재"). "# Claude Prompt"에는 작업의 범위·목표·검증 기준만 적고, 구체적인 구현 방법(수정할 함수, 코드 스니펫, 알고리즘 선택 등)을 추정해서 만들어내지 마세요 — 구현 방법은 Claude 작업자가 선택합니다.',
    '- Decision이 NO_ACTION이면: "# Claude Prompt"에는 정확히 "(작업 없음)", "# Acceptance Criteria"에는 정확히 "(N/A)", "# Test Plan"에는 정확히 "(N/A)"라고만 적으세요. "# Why"에는 왜 지금 안전하게 제안할 작업이 없는지 적고, "# Stop Conditions"에는 다음에 다시 판단해야 할 조건(예: 새로운 로그/커밋 발생 시)을 적으세요.',
    '',
    HEADINGS.join('\n'),
  ].join('\n');

  const userPrompt = [
    '## 이번 CI 실행 결과 및 저장소 스냅샷',
    '',
    '### npm run build 로그',
    '```',
    ctx.buildLog,
    '```',
    '',
    '### tests/unit/*.js 전체 실행 로그',
    '```',
    ctx.unitLog,
    '```',
    '',
    '### README.md',
    '```',
    ctx.readme,
    '```',
    '',
    '### package.json',
    '```',
    ctx.packageJson,
    '```',
    '',
    '### tests/unit/*.js 파일 목록',
    ctx.unitFiles ? ctx.unitFiles.map((f) => `- ${f}`).join('\n') : '(목록을 읽을 수 없음)',
    '',
    '### tests/sim/*.js 파일 목록',
    ctx.simFiles ? ctx.simFiles.map((f) => `- ${f}`).join('\n') : '(목록을 읽을 수 없음)',
    '',
    '### 최근 git 커밋 메시지 (최대 10개, 최신순)',
    ctx.commits ? ctx.commits.map((c) => `- ${c}`).join('\n') : '(git log를 읽을 수 없음)',
    '',
    '위 자료만 근거로 다음 Claude 작업을 결정해 주세요. 근거가 부족하면 NO_ACTION을 선택하세요.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

async function callModel(apiKey, messages) {
  let res;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // Optional but recommended by OpenRouter for request attribution; harmless if ignored.
        'HTTP-Referer': 'https://github.com/mspj0703-stack/echo-shift2',
        'X-Title': 'echo-shift2 OpenRouter Supervisor',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });
  } catch (e) {
    return { ok: false, reason: `OpenRouter API 호출 중 네트워크 오류: ${e.message}` };
  }

  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, reason: `OpenRouter API가 HTTP ${res.status}를 반환했습니다:\n\n${raw.slice(0, 2000)}` };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, reason: `OpenRouter 응답 JSON 파싱 실패: ${e.message}\n\n원본 응답(앞부분):\n${raw.slice(0, 2000)}` };
  }

  if (data.error) {
    return { ok: false, reason: `OpenRouter API가 오류를 반환했습니다: ${JSON.stringify(data.error).slice(0, 2000)}` };
  }

  const text = extractText(data);
  if (!text || !text.trim()) {
    return { ok: false, reason: `OpenRouter 응답에서 텍스트를 추출하지 못했습니다.\n\n원본 응답(앞부분):\n${raw.slice(0, 2000)}` };
  }

  return { ok: true, text: text.trim() };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    writeFallback('OPENROUTER_API_KEY secret이 설정되어 있지 않습니다.');
    console.error('OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }

  const ctx = {
    buildLog: readTail(path.join(ROOT, 'build.log'), 6000),
    unitLog: readTail(path.join(ROOT, 'unit-test-logs', 'unit-tests.log'), 12000),
    readme: readHeadSafe(path.join(ROOT, 'README.md'), 6000),
    packageJson: readHeadSafe(path.join(ROOT, 'package.json'), 2000),
    unitFiles: listJsFiles(path.join(ROOT, 'tests', 'unit')),
    simFiles: listJsFiles(path.join(ROOT, 'tests', 'sim')),
    commits: getRecentCommits(10),
  };

  const { systemPrompt, userPrompt } = buildPrompts(ctx);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Up to one retry: if the first response doesn't satisfy the fixed format
  // (missing headings, bad Decision token, or a TASK with no cited evidence),
  // ask the model to redo it once before falling back to an error report.
  let lastReason = '(알 수 없음)';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await callModel(apiKey, messages);
    if (!result.ok) {
      lastReason = result.reason;
      console.error(`Attempt ${attempt} failed: ${result.reason}`);
      continue;
    }

    const parsed = parseSections(result.text);
    if (!parsed.ok) {
      lastReason = parsed.reason;
      console.error(`Attempt ${attempt} produced invalid format: ${parsed.reason}`);
      messages.push({ role: 'assistant', content: result.text });
      messages.push({
        role: 'user',
        content: `이전 응답이 형식 요구사항을 지키지 않았습니다: ${parsed.reason}\n정확히 6개 헤딩과 형식 규칙을 다시 지켜서 전체 응답을 처음부터 다시 작성하세요.`,
      });
      continue;
    }

    normalize(parsed);
    fs.writeFileSync(OUT_FILE, render(parsed.sections));
    console.log(`Wrote ${OUT_FILE} (Decision: ${parsed.decision}, attempt ${attempt})`);
    return;
  }

  writeFallback(`2회 시도 후에도 유효한 형식의 응답을 받지 못했습니다. 마지막 오류: ${lastReason}`);
  process.exit(1);
}

main().catch((e) => {
  writeFallback(`예상치 못한 오류: ${e && e.message}`);
  console.error(e);
  process.exit(1);
});
