import { NextResponse } from 'next/server';
import { listPendingApprovalInvitees } from '@/src/invitees/inviteesRepo.js';
import { buildPendingRequests } from '@/src/invitees/pendingRequests.js';
import { listAllGuests } from '@/src/admin/adminRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Guest-requested "add another person" invitees still awaiting admin
 * approval, joined with their parent invitation's name/code so the admin
 * panel can show who is asking. Requests from removed guests are left out.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const [pending, guests] = await Promise.all([listPendingApprovalInvitees(), listAllGuests()]);

  return NextResponse.json({ success: true, requests: buildPendingRequests(pending, guests) });
}
