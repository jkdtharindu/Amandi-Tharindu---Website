import { NextResponse } from 'next/server';
import { listPendingApprovalInvitees } from '@/src/invitees/inviteesRepo.js';
import { buildPendingRequests } from '@/src/invitees/pendingRequests.js';
import { listGuestsByParty } from '@/src/admin/adminRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Guest-requested "add another person" invitees still awaiting admin
 * approval, joined with their parent invitation's name/code so the admin
 * panel can show who is asking. Only the signed-in side's guests are passed
 * in, so requests from the other side (and from removed guests) are left out.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const [pending, guests] = await Promise.all([
    listPendingApprovalInvitees(),
    listGuestsByParty(session.party),
  ]);

  return NextResponse.json({ success: true, requests: buildPendingRequests(pending, guests) });
}
