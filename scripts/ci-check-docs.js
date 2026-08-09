#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

function gitDiffFiles() {
  try {
    // fetch base ref (origin/HEAD comparison handled by action)
    execSync('git fetch --all', { stdio: 'ignore' });
    const out = execSync('git diff --name-only origin/${{ github.base_ref }}...HEAD || true', { encoding: 'utf8' });
    if (!out) {
      // fallback: diff against main
      return execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    }
    return out.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    // best-effort: list staged/changed files
    try {
      const out = execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf8' });
      return out.split(/\r?\n/).filter(Boolean);
    } catch (err2) {
      return [];
    }
  }
}

function main() {
  const files = gitDiffFiles();
  console.log('Changed files:', files.join(', '));

  const sensitivePaths = ['migrations/', 'src/messaging', 'src/twilio', 'src/sms', 'src/email'];
  const touchedSensitive = files.some((f) => sensitivePaths.some((p) => f.startsWith(p)));

  const hitlTouched = files.some((f) => f === 'HITL.md' || f.startsWith('.github/') || f === 'MEMORY.md');
  const memoryTouched = files.some((f) => f === 'MEMORY.md');

  if (touchedSensitive && !hitlTouched) {
    console.error('\nERROR: Sensitive files changed (migrations/messaging). You must update HITL.md and add a MEMORY.md entry describing the change.');
    process.exit(2);
  }

  // If DB schema changed, ensure migrations/ changes include migration files
  const dbTouched = files.some((f) => f.startsWith('migrations/') || f.includes('schema') || f.includes('db'));
  if (dbTouched && !memoryTouched) {
    console.error('\nERROR: Database schema changes detected. Please add an entry to MEMORY.md describing the migration and reason.');
    process.exit(3);
  }

  console.log('Docs checks passed.');
}

main();
