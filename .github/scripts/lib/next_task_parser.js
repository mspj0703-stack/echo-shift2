// Shared parser for NEXT_TASK.md's fixed 6-heading format, used by the v0.5
// workflow-level scripts (parse_decision.js, extract_claude_prompt.js).
// This is a read-only re-parse of a file openrouter_supervisor.js already
// validated/normalized when it wrote it, so it is intentionally not wired
// into openrouter_supervisor.js itself (keeping the already-verified v0.3
// script untouched).
const HEADINGS = ['# Decision', '# Why', '# Claude Prompt', '# Acceptance Criteria', '# Test Plan', '# Stop Conditions'];

function parseNextTask(text) {
  const lines = text.split(/\r?\n/);
  const idx = HEADINGS.map((h) => lines.findIndex((l) => l.trim() === h));
  if (idx.some((i) => i === -1)) return null;
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] <= idx[i - 1]) return null;
  }

  const sections = {};
  for (let i = 0; i < HEADINGS.length; i++) {
    const start = idx[i] + 1;
    const end = i + 1 < HEADINGS.length ? idx[i + 1] : lines.length;
    sections[HEADINGS[i]] = lines.slice(start, end).join('\n').trim();
  }

  const decisionBody = sections['# Decision'];
  const firstLine = (decisionBody.split('\n')[0] || '').trim();
  let decision = 'UNKNOWN';
  if (firstLine === 'TASK' || firstLine.startsWith('TASK')) decision = 'TASK';
  else if (firstLine === 'NO_ACTION' || firstLine.startsWith('NO_ACTION')) decision = 'NO_ACTION';

  const summary = decisionBody.split('\n').slice(1).join(' ').trim();

  return { decision, summary, sections };
}

module.exports = { parseNextTask, HEADINGS };
