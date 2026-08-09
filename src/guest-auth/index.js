import { loginGuestByCode as loginGuestByCodeImpl } from './loginGuestByCode.js';
import { loginGuestByName as loginGuestByNameImpl } from './loginGuestByName.js';
import { guestStore } from '../data/guestStore.js';

export async function loginGuestByCode(code) {
  return loginGuestByCodeImpl(code, guestStore);
}

export async function loginGuestByName(name) {
  return loginGuestByNameImpl(name, guestStore);
}
