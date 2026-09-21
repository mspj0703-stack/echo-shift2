#!/usr/bin/env node
// Prints the body of NEXT_TASK.md's "# Claude Prompt" section to stdout.
// Used only on the path where parse_decision.js already reported TASK, so
// this should always find a real value; the fallback text below only
// matters if NEXT_TASK.md somehow changed between the two reads.
const fs = require('fs');
const path = require('path');
const { parseNextTask } = require('./lib/next_task_parser');

const FILE = path.join(__dirname, '..', '..', 'NEXT_TASK.md');

try {
  const text = fs.readFileSync(FILE, 'utf8');
  const parsed = parseNextTask(text);
  const body = parsed && parsed.sections['# Claude Prompt'];
  process.stdout.write(body && body.trim() ? body.trim() : '(NEXT_TASK.md에서 # Claude Prompt 내용을 읽을 수 없습니다.)');
} catch (e) {
  process.stdout.write(`(NEXT_TASK.md를 읽을 수 없습니다: ${e.message})`);
}
