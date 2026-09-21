#!/usr/bin/env node
// Writes CLAUDE_RESULT.md from environment variables set by the workflow's
// worker steps. Never trusts the Claude worker's own self-report: the final
// status is computed here purely from deterministic signals (did a commit
// exist, did the workflow's own post-task `npm run build` / unit test run
// pass) so a model that mis-describes its own success can't turn into a
// false SUCCESS in this file.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'CLAUDE_RESULT.md');

function main() {
  const env = process.env;
  const triggered = env.WORKER_TRIGGERED === 'true';
  const skipReason = env.WORKER_SKIP_REASON || '';
  const actionOutcome = env.WORKER_ACTION_OUTCOME || ''; // 'success' | 'failure' | ''
  const hadCommit = env.WORKER_HAD_COMMIT === 'true';
  const buildResult = env.WORKER_BUILD_RESULT || 'N/A'; // PASS | FAIL | N/A
  const testResult = env.WORKER_TEST_RESULT || 'N/A';
  const branch = env.WORKER_BRANCH || '(N/A)';
  const changedFilesRaw = env.WORKER_CHANGED_FILES || '';
  const commitSha = env.WORKER_COMMIT_SHA || '';
  const prUrl = env.WORKER_PR_URL || '';
  const taskSummary = (env.WORKER_TASK_SUMMARY || '').trim();

  let status;
  let note;

  if (!triggered) {
    status = 'SKIP';
    if (skipReason === 'NO_ACTION') {
      note = 'Supervisor decision이 NO_ACTION이어서 Claude worker를 실행하지 않았습니다.';
    } else if (skipReason === 'NO_TOKEN') {
      note = 'CLAUDE_CODE_OAUTH_TOKEN secret이 없어 Claude worker를 실행하지 않았습니다.';
    } else {
      note = `Claude worker를 실행하지 않았습니다 (사유: ${skipReason || '기록되지 않음'}).`;
    }
  } else if (actionOutcome === 'failure') {
    status = 'RUN';
    note = 'claude-code-action 실행 자체가 오류로 종료되어, 커밋/빌드/테스트 결과를 신뢰할 수 있는 형태로 판정할 수 없습니다. 워크플로우 로그를 확인하세요.';
  } else if (!hadCommit) {
    status = 'FAILED';
    note = 'Claude worker가 커밋을 생성하지 않았습니다. TASK가 근거를 갖고 결정되었는데도 결과물이 없으므로 실패로 기록합니다.';
  } else if (buildResult !== 'PASS' || testResult !== 'PASS') {
    status = 'FAILED';
    note = '커밋은 생성되었지만 빌드 또는 유닛 테스트가 실패했습니다. main으로 병합하지 마세요. 작업 브랜치는 검토를 위해 보존됩니다.';
  } else {
    status = 'SUCCESS';
    note = '커밋, 빌드, 유닛 테스트가 모두 정상입니다. 이 워크플로우는 절대 자동으로 main에 병합하지 않습니다 — 사람이 검토 후 병합하세요.';
  }

  const changedFiles = changedFilesRaw.trim();
  const changedFilesBlock = changedFiles
    ? changedFiles
        .split('\n')
        .filter(Boolean)
        .map((f) => `  - ${f}`)
        .join('\n')
    : '  (없음)';

  const md = `# Claude Worker Result

- Worker status: ${status}
- Task summary: ${taskSummary || '(N/A)'}
- Branch name: ${branch}
- Changed files:
${changedFilesBlock}
- Build result: ${buildResult}
- Unit test result: ${testResult}
- Commit SHA: ${commitSha || '(없음)'}
- PR URL: ${prUrl || '(없음)'}

## Note
${note}
`;

  fs.writeFileSync(OUT, md);
  console.log(`Wrote ${OUT} (Worker status: ${status})`);
}

main();
