import { loginGuestByCode as loginGuestByCodeImpl } from './loginGuestByCode.js';

export async function loginGuestByCode(code) {
  return loginGuestByCodeImpl(code);
}
