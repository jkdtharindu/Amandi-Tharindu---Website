import { loginAdmin as loginAdminImpl } from './loginAdmin.js';

export async function loginAdmin(email, password) {
  return loginAdminImpl(email, password);
}

export { findAdminByEmail, findAdminById } from './adminRepo.js';
export {
  requireAdminAuth,
  signAdminSession,
  verifyAdminSession,
  adminSessionCookieName,
} from './adminSession.js';
