import { NextRequest, NextResponse } from 'next/server';
import { listApprovedInvitees } from '@/src/invitees/inviteesRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

/** The named people in a party, for the "remove a person" control on the Guest list page. */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const { id } = await context.params;
  const invitees = await listApprovedInvitees(id);
  return NextResponse.json({ success: true, invitees });
}
