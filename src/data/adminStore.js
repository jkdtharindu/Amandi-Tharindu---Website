import { hashPassword } from '../admin-auth/hashPassword.js';

const envEmail = process.env.ADMIN_EMAIL;
const envPasswordHash = process.env.ADMIN_PASSWORD_HASH;

if (process.env.NODE_ENV === 'production' && (!envEmail || !envPasswordHash)) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD_HASH are required in production');
}

export const adminStore = [
  {
    id: 'admin-1',
    email: envEmail || 'admin@example.com',
    passwordHash: envPasswordHash || hashPassword('changeme123'),
  },
];
