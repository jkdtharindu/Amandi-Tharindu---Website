#!/usr/bin/env node
import { execSync } from 'node:child_process';

function gitDiffFiles() {
  try {
    // fetch base ref (GITHUB_BASE_REF is set automatically on pull_request events)
    execSync('git fetch --all', { stdio: 'ignore' });
    const baseRef = process.env.GITHUB_BASE_REF;
    if (baseRef) {
      const out = execSync(`git diff --name-only origin/${baseRef}...HEAD`, { encoding: 'utf8' });
      if (out) return out.split(/\r?\n/).filter(Boolean);
    }

    // No PR base ref: a direct push. The workflow passes the pre-push SHA as
    // EVENT_BEFORE (github.event.before) — diffing against HEAD covers every
    // commit in the push, not just the last one. All-zero means "no prior
    // commit" (a new branch's first push), which falls through to the
    // against-main fallback below instead.
    const before = process.env.EVENT_BEFORE;
    if (before && !/^0+$/.test(before)) {
      const out = execSync(`git diff --name-only ${before}..HEAD`, { encoding: 'utf8' });
      return out.split(/\r?\n/).filter(Boolean);
    }

    // fallback: diff against main
    const out = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
    if (out) return out.split(/\r?\n/).filter(Boolean);
    return execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
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

  // The 8c5e665 consolidation that moved MEMORY.md under docs/ was abandoned in
  // practice: root MEMORY.md is canonical and docs/MEMORY.md is a stale duplicate
  // nobody may edit (MEMORY.md 2026-09-04). Checking docs/MEMORY.md made this gate
  // unsatisfiable — the only way to pass was to edit the forbidden copy.
  const memoryTouched = files.some((f) => f === 'MEMORY.md');
  const hitlTouched = files.some((f) => f === 'HITL.md' || f.startsWith('.github/')) || memoryTouched;

  if (touchedSensitive && !hitlTouched) {
    console.error('\nERROR: Sensitive files changed (migrations/messaging). You must update HITL.md and add a MEMORY.md entry describing the change.');
    process.exit(2);
  }

  // Schema changes live in migrations/. The previous substring match on 'db' and
  // 'schema' fired on any path containing them anywhere — scripts/backup-db.js
  // tripped it while changing no schema at all.
  const dbTouched = files.some((f) => f.startsWith('migrations/'));
  if (dbTouched && !memoryTouched) {
    console.error('\nERROR: Database schema changes detected. Please add an entry to MEMORY.md describing the migration and reason.');
    process.exit(3);
  }

  console.log('Docs checks passed.');
}

main();
