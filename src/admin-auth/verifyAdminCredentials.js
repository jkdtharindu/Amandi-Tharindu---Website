import { verifyPassword } from './hashPassword.js';

export function verifyAdminCredentials(email, password, adminRecord) {
  if (!email || !password) {
    return { success: false, reason: 'missing_credentials', message: 'Email and password are required.' };
  }

  if (!adminRecord || String(adminRecord.email).toLowerCase() !== String(email).trim().toLowerCase()) {
    return { success: false, reason: 'invalid_credentials', message: 'Incorrect email or password.' };
  }

  if (!verifyPassword(password, adminRecord.passwordHash)) {
    return { success: false, reason: 'invalid_credentials', message: 'Incorrect email or password.' };
  }

  return { success: true, adminId: adminRecord.id };
}
