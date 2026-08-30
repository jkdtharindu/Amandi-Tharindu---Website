import { query } from '../db.js';
import { adminStore } from '../data/adminStore.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapAdminRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function findAdminByEmail(email) {
  const needle = String(email).trim().toLowerCase();

  if (!useDb) {
    return adminStore.find((entry) => entry.email.toLowerCase() === needle) || null;
  }

  const { rows } = await query('SELECT * FROM admins WHERE LOWER(email) = $1', [needle]);
  return mapAdminRow(rows[0]);
}

export async function findAdminById(id) {
  if (!useDb) {
    return adminStore.find((entry) => entry.id === id) || null;
  }

  const { rows } = await query('SELECT * FROM admins WHERE id = $1', [id]);
  return mapAdminRow(rows[0]);
}
