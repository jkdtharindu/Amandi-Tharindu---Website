import { query } from '../src/db.js';
import { hashPassword } from '../src/password.js';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to seed the admin account.');
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before seeding.');
    console.error('Example: ADMIN_EMAIL=couple@example.com ADMIN_PASSWORD="..." npm run seed:admin');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);

  await query(
    `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email.trim().toLowerCase(), passwordHash]
  );

  console.log(`Admin account ready for ${email}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
