#!/usr/bin/env node
// Prints exactly two lines to stdout for the workflow to capture:
//   line 1: TASK | NO_ACTION | UNKNOWN
//   line 2: the one/two-sentence summary that followed the Decision token
//           in NEXT_TASK.md (may be empty)
// Never throws — any read/parse failure prints UNKNOWN with an empty summary,
// so the workflow safely treats it as "do not run the Claude worker".
const fs = require('fs');
const path = require('path');
const { parseNextTask } = require('./lib/next_task_parser');

const FILE = path.join(__dirname, '..', '..', 'NEXT_TASK.md');

try {
  const text = fs.readFileSync(FILE, 'utf8');
  const parsed = parseNextTask(text);
  if (!parsed) {
    process.stdout.write('UNKNOWN\n');
  } else {
    process.stdout.write(`${parsed.decision}\n${parsed.summary}`);
  }
} catch (e) {
  process.stdout.write('UNKNOWN\n');
}
