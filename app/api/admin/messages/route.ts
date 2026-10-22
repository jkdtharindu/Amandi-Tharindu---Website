import { NextRequest, NextResponse } from 'next/server';
import { listGuestsByParty } from '@/src/admin/adminRepo.js';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { tableLabelsByGuest, tableMemberLinesByGuest } from '@/src/table-arrangement/guestTableView.js';
import { selectRecipients } from '@/src/messaging/selectRecipients.js';
import { getMessageEventsByGuest, listCompletedGuestIds } from '@/src/messaging/messageEventsRepo.js';
import { MESSAGE_LEVELS, levelProgress } from '@/src/messaging/messageLevels.js';
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
  const level = MESSAGE_LEVELS.find((entry) => entry.key === params.get('level'));
  const skipSent = params.get('skipSent') !== 'false';

  const [guests, tables] = await Promise.all([
    listGuestsByParty(session.party) as Promise<GuestRow[]>,
    listSeatingTablesByParty(session.party),
  ]);
  const tableLabels = tableLabelsByGuest(tables);
  const memberLines = tableMemberLinesByGuest(tables);
  const skipGuestIds = skipSent && level ? await listCompletedGuestIds(level.eventName) : [];

  const eventsByGuest = (await getMessageEventsByGuest((guests as GuestRow[]).map((guest) => guest.id))) as Record<
    string,
    { eventName: string; isCompleted: boolean }[]
  >;

  // Per level: how many of the side's guests (with a number) are ticked as sent.
  const messageable = (guests as GuestRow[]).filter(
    (guest: GuestRow) => !guest.isDeleted && String(guest.whatsappNumber ?? '').trim()
  );
  const progress = MESSAGE_LEVELS.map((entry) => {
    const done = messageable.filter(
      (guest: GuestRow) =>
        levelProgress(eventsByGuest[guest.id] ?? []).levels.find((l) => l.key === entry.key)?.done
    ).length;
    return {
      key: entry.key,
      number: entry.number,
      label: entry.label,
      done,
      total: messageable.length,
      percent: messageable.length ? Math.round((done / messageable.length) * 100) : 0,
    };
  });

  const selected = selectRecipients(guests, {
    status: params.get('status') || 'pending',
    relationship: params.get('relationship') || 'all',
    skipGuestIds,
  });
  const { noNumberCount, alreadySentCount } = selected;

  const tableTextFor = (guestId: string) =>
    memberLines.get(guestId) ?? (tableLabels.get(guestId) ?? []).join(', ');

  // The table message (level 3) only goes to parties that have a seat; the rest wait for seating.
  const needsTable = level?.key === 'table_update';
  const recipients = (selected.recipients as GuestRow[]).filter(
    (guest) => !needsTable || tableTextFor(guest.id)
  );
  const noTableCount = selected.recipients.length - recipients.length;

  return NextResponse.json({
    success: true,
    recipients: recipients.map((guest) => ({
      id: guest.id,
      code: guest.code,
      name: guest.name,
      relationship: guest.relationship,
      rsvpStatus: guest.rsvpStatus,
      whatsappNumber: guest.whatsappNumber,
      tableName: tableTextFor(guest.id),
      messageEvents: eventsByGuest[guest.id] ?? [],
    })),
    progress,
    noNumberCount,
    noTableCount,
    alreadySentCount,
  });
}
