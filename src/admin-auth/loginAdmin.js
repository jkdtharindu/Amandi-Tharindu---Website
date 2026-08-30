import { findAdminByEmail } from './adminRepo.js';
import { verifyPassword, hashPassword } from '../password.js';

// Fixed placeholder hash (never a real password) used only to keep the
// verifyPassword() timing consistent when no matching admin is found.
const DUMMY_HASH = hashPassword('unused-dummy-value-for-timing-safety');

export async function loginAdmin(email, password) {
  if (!email || !password) {
    return { success: false, reason: 'missing_credentials' };
  }

  const admin = await findAdminByEmail(email);

  // Always run verifyPassword, even for an unknown email, against a fixed
  // dummy hash — keeps response timing independent of whether the account
  // exists, and both failure paths return the same generic reason so a
  // caller can't use this endpoint to enumerate admin email addresses.
  const passwordHash = admin ? admin.passwordHash : DUMMY_HASH;
  const passwordMatches = verifyPassword(password, passwordHash);

  if (!admin || !passwordMatches) {
    return { success: false, reason: 'invalid_credentials' };
  }

  return {
    success: true,
    adminId: admin.id,
    email: admin.email,
  };
}
