import { loginGuestByCode as loginGuestByCodeImpl } from './loginGuestByCode.js';
import { loginGuestByName as loginGuestByNameImpl } from './loginGuestByName.js';

export async function loginGuestByCode(code) {
  return loginGuestByCodeImpl(code);
}

export async function loginGuestByName(name) {
  return loginGuestByNameImpl(name);
}
