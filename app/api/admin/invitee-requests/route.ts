import { NextResponse } from 'next/server';
import { listPendingApprovalInvitees } from '@/src/invitees/inviteesRepo.js';
import { listAllGuests } from '@/src/admin/adminRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Guest-requested "add another person" invitees still awaiting admin
 * approval, joined with their parent invitation's name/code so the admin
 * panel can show who is asking.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  type GuestRow = { id: string; name: string; code: string };
  type InviteeRow = { id: string; name: string; createdAt: string; guestId: string };

  const [pending, guests] = await Promise.all([listPendingApprovalInvitees(), listAllGuests()]);
  const guestById = new Map((guests as GuestRow[]).map((guest) => [guest.id, guest]));

  const requests = (pending as InviteeRow[]).map((invitee) => {
    const guest = guestById.get(invitee.guestId);
    return {
      id: invitee.id,
      name: invitee.name,
      createdAt: invitee.createdAt,
      guestId: invitee.guestId,
      guestName: guest?.name ?? 'Unknown',
      guestCode: guest?.code ?? '',
    };
  });

  return NextResponse.json({ success: true, requests });
}
