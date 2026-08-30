import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(path.join(__dirname, '../migrations'));

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error(
      '❌ DATABASE_URL is required to run migrations.\n' +
      '   Add DATABASE_URL to your .env file (e.g., postgres://user:pass@localhost:5432/dbname)'
    );
    process.exit(1);
  }

  const client = new pg.Client(process.env.DATABASE_URL);

  try {
    console.log('📦 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    if (migrationFiles.length === 0) {
      console.log('✅ No migrations to run');
      return;
    }

    console.log(`🚀 Running ${migrationFiles.length} migration(s)...\n`);

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`  ⏳ ${file}...`);
      try {
        await client.query(sql);
        console.log(`  ✅ ${file}`);
      } catch (error) {
        console.error(`  ❌ ${file}`);
        throw error;
      }
    }

    console.log('\n✅ All migrations completed successfully');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();