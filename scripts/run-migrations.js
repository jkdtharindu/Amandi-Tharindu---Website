import fs from 'fs';
import path from 'path';
import { query } from '../src/db.js';

const migrationsDir = path.resolve('migrations');
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to run migrations.');
    process.exit(1);
  }

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running migration ${file}`);
    await query(sql);
  }

  console.log('Migrations completed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});