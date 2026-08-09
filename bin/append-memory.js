#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node bin/append-memory.js <section-number> "Decision text" "Reason" "Alternative"');
  console.log('Example: node bin/append-memory.js 1 "Use Supabase" "Matches PRD" "SQLite"');
}

const args = process.argv.slice(2);
if (args.length < 4) {
  usage();
  process.exit(1);
}

const [section, decision, reason, alternative] = args;
const sections = {
  '1': 'Architectural decisions',
  '2': 'Technology choices',
  '3': 'Past mistakes and corrections',
  '4': 'Deprecated patterns',
  '5': 'Last session summary'
};

const sectionTitle = sections[section] || `Section ${section}`;
const now = new Date().toISOString().slice(0,10);
const entry = `\n[${now}] Decision: ${decision}\nReason: ${reason}\nAlternative considered: ${alternative}\n`;

const memPath = path.join(process.cwd(), 'MEMORY.md');
if (!fs.existsSync(memPath)) {
  console.error('MEMORY.md not found in project root.');
  process.exit(2);
}

fs.appendFileSync(memPath, entry, 'utf8');
console.log(`Appended entry to MEMORY.md under ${sectionTitle}`);
