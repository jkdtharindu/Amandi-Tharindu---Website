import pg from 'pg';

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
    console.error(
      '❌ DATABASE_URL is required to seed local DB.\n' +
      '   Add DATABASE_URL to your .env file'
    );
    process.exit(1);
  }

  const client = new pg.Client(process.env.DATABASE_URL);

  try {
    console.log('📦 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log(`🌱 Seeding ${seedData.length} guest(s)...\n`);

    for (const guest of seedData) {
      const columns = Object.keys(guest).join(', ');
      const placeholders = Object.keys(guest)
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const values = Object.values(guest);

      const sql =
        `INSERT INTO guests (${columns}) VALUES (${placeholders}) ` +
        `ON CONFLICT (code) DO UPDATE SET ` +
        `name = EXCLUDED.name, relationship = EXCLUDED.relationship, ` +
        `slot_count = EXCLUDED.slot_count, whatsapp_number = EXCLUDED.whatsapp_number, ` +
        `email = EXCLUDED.email, is_deleted = false`;

      console.log(`  ⏳ Seeding ${guest.code} (${guest.name})...`);
      await client.query(sql, values);
      console.log(`  ✅ ${guest.code}`);
    }

    console.log('\n✅ Seed data inserted successfully');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
