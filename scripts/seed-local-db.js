import 'dotenv/config';
import { query, closePool } from '../src/db.js';

const seedData = [
  {
    code: 'SILVA-001',
    name: 'Nimal Silva',
    relationship: 'Family',
    slot_count: 2,
    whatsapp_number: '+94123456789',
    email: 'nimal@example.com',
  },
  {
    code: 'PERERA-101',
    name: 'Dinithi Perera',
    relationship: 'Friend',
    slot_count: 1,
    email: 'dinithi@example.com',
  },
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to seed local DB.');
    process.exit(1);
  }

  for (const guest of seedData) {
    const columns = Object.keys(guest).join(', ');
    const placeholders = Object.keys(guest).map((_, index) => `$${index + 1}`).join(', ');
    const values = Object.values(guest);

    await query(
      `INSERT INTO guests (${columns}) VALUES (${placeholders}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, relationship = EXCLUDED.relationship, slot_count = EXCLUDED.slot_count, whatsapp_number = EXCLUDED.whatsapp_number, email = EXCLUDED.email, is_deleted = false`,
      values
    );
  }

  console.log('Local guest seed data inserted.');
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
