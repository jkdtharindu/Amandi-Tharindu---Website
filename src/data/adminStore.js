import { hashPassword } from '../password.js';

/**
 * DEV-ONLY fallback admin account, used only when DATABASE_URL is not set.
 * This is never used once a real database is configured (see adminRepo.js).
 *
 * Default credentials (local development only):
 *   email:    admin@example.com
 *   password: change-me-now
 *
 * For any real deployment, seed a real admin via `npm run seed:admin`
 * with ADMIN_EMAIL / ADMIN_PASSWORD set to production values — see
 * docs/ADMIN_AUTH.md.
 */
export const adminStore = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    passwordHash: hashPassword('change-me-now'),
    createdAt: new Date().toISOString(),
  },
];
