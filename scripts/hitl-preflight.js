import { spawnSync } from 'child_process';

const action = process.argv[2];
const confirmed = process.argv.includes('--yes') || process.env.HITL_CONFIRM === 'yes';

const prompts = {
  migrate:
    '⚠️ HITL CHECKPOINT: I am about to run database migrations. This will apply SQL schema changes to the configured database. Shall I proceed? (yes / no)',
};

const commands = {
  migrate: ['node', ['scripts/run-migrations.js']],
};

if (!action || !commands[action]) {
  console.error('Usage: node scripts/hitl-preflight.js <action> [--yes]');
  process.exit(1);
}

if (!confirmed) {
  console.error(prompts[action]);
  console.error('Set HITL_CONFIRM=yes or pass --yes to confirm.');
  process.exit(1);
}

const [command, args] = commands[action];
const result = spawnSync(command, args, { stdio: 'inherit' });
process.exit(result.status || 0);
