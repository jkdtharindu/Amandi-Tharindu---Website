import { NextRequest, NextResponse } from 'next/server';
import { listAllGuests } from '@/src/admin/adminRepo.js';
import { selectRecipients } from '@/src/messaging/selectRecipients.js';
import { listSentGuestIds } from '@/src/messaging/messageLogRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type GuestRow = {
  id: string;
  code: string;
  name: string;
  relationship: string;
  rsvpStatus: string;
  whatsappNumber: string | null;
  isDeleted?: boolean;
};

/**
 * The audience for a WhatsApp run (P1-06): who matches the filters, who has
 * no number, and who has already been worked through for this template.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const templateId = params.get('templateId') || '';
  const skipSent = params.get('skipSent') !== 'false';

  const guests = (await listAllGuests()) as GuestRow[];
  const skipGuestIds = skipSent && templateId ? await listSentGuestIds(templateId) : [];

  const { recipients, noNumberCount, alreadySentCount } = selectRecipients(guests, {
    status: params.get('status') || 'pending',
    relationship: params.get('relationship') || 'all',
    skipGuestIds,
  });

  return NextResponse.json({
    success: true,
    recipients: (recipients as GuestRow[]).map((guest) => ({
      id: guest.id,
      code: guest.code,
      name: guest.name,
      relationship: guest.relationship,
      rsvpStatus: guest.rsvpStatus,
      whatsappNumber: guest.whatsappNumber,
    })),
    noNumberCount,
    alreadySentCount,
  });
}
