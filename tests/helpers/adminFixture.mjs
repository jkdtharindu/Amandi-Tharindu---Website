import { adminStore } from '../../src/data/adminStore.js';
import { hashPassword } from '../../src/admin-auth/hashPassword.js';

/**
 * Test-only admin credentials.
 *
 * The application ships with NO default admin password — `adminStore` is empty
 * unless ADMIN_EMAIL and ADMIN_PASSWORD_HASH are configured. Tests therefore
 * seed their own account rather than leaning on a shipped fallback, which is
 * also more honest: a test that needs an admin should say so.
 *
 * This password exists only inside the test process. It is never a valid
 * credential for a running server unless someone deliberately configures it.
 */
export const TEST_ADMIN = {
  email: 'admin@test.invalid',
  password: 'test-only-not-a-real-password',
};

/** Seeds the single admin account used by admin tests. Call in `beforeEach`. */
export function seedTestAdmin() {
  adminStore.length = 0;
  adminStore.push({
    id: 'admin-1',
    email: TEST_ADMIN.email,
    passwordHash: hashPassword(TEST_ADMIN.password),
  });
}

/** Empties the admin store, for tests that assert the unconfigured state. */
export function clearTestAdmin() {
  adminStore.length = 0;
}
