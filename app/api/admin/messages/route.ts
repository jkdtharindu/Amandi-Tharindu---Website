import { NextRequest, NextResponse } from 'next/server';
import { listGuestsByParty } from '@/src/admin/adminRepo.js';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { tableLabelsByGuest } from '@/src/table-arrangement/guestTableView.js';
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
 * The audience for a WhatsApp run (P1-06), from the signed-in side's guests only: each
 * side messages its own guests from its own number. Who matches the filters, who has
 * no number, and who has already been worked through for this template.
 *
 * Each recipient carries `tableName`, what `[TableNumber]` fills with: the names
 * of the tables their party sits at (their side's own or Common tables, Action 68),
 * joined with ", ", or "" while they have no seat.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const templateId = params.get('templateId') || '';
  const skipSent = params.get('skipSent') !== 'false';

  const [guests, tables] = await Promise.all([
    listGuestsByParty(session.party) as Promise<GuestRow[]>,
    listSeatingTablesByParty(session.party),
  ]);
  const tableLabels = tableLabelsByGuest(tables);
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
      tableName: (tableLabels.get(guest.id) ?? []).join(', '),
    })),
    noNumberCount,
    alreadySentCount,
  });
}
