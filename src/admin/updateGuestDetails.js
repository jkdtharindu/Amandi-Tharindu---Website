import { updateGuest, updateGuestIfPartyOwner } from './adminRepo.js';
import { listApprovedInvitees } from '../invitees/inviteesRepo.js';

/**
 * Saves an admin's edits to a guest.
 *
 * A party with named people derives its headcount from that list, so the
 * submitted slotCount is replaced with the real count of approved people. That
 * replacement happens in the same UPDATE that saves the name, relationship and
 * WhatsApp number — commit 9632cc7 did it as an early return instead, so for
 * any party with named people the other fields were silently never written
 * while the response said "saved" (Next Action 62).
 *
 * A party with no named people keeps the submitted headcount, which is the only
 * place it can come from.
 *
 * Resolves to the saved guest, or null when there is no such active guest.
 * If party is provided, verifies the guest belongs to that party (P1-14D).
 *
 * Known limit: the count is read before the write rather than derived inside
 * it, so an invitee approved in the same instant leaves the headcount one
 * short until the next save. One admin, one screen — and the next edit or
 * migration 019 corrects it.
 *
 * @param {string} id
 * @param {{ name: string, relationship: string, slotCount: number, whatsappNumber: string | null }} value
 * @param {string} [party] - Optional: 'bride' or 'groom'. If provided, enforces party ownership.
 */
export async function updateGuestDetails(id, value, party = null) {
  const approved = await listApprovedInvitees(id);
  const slotCount = approved.length > 0 ? approved.length : value.slotCount;

  // Use party-aware version if party is provided (P1-14D)
  if (party) {
    return updateGuestIfPartyOwner(id, party, { ...value, slotCount });
  }

  // Fallback to non-party version for backwards compatibility
  return updateGuest(id, { ...value, slotCount });
}
