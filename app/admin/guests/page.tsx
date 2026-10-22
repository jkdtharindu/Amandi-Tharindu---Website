import AdminNav from '@/components/admin/AdminNav';
import GuestManager, { type Guest, type SeatingStatus } from '@/components/admin/GuestManager';
import InviteeRequests from '@/components/admin/InviteeRequests';
import { requireAdminPage } from '@/lib/adminGuard';
import { listAllInvitees, listGuestsByParty } from '@/src/admin/adminRepo.js';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { computeSeatingCompletion } from '@/src/table-arrangement/seatingCompletion.js';
import { filterGuests } from '@/src/admin/guestQueries.js';
import { mergeGroups } from '@/src/admin/categories.js';
import { getMessageEventsByGuest } from '@/src/messaging/messageEventsRepo.js';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { loadPlaceholderContext } from '@/src/admin/loadPlaceholderContext.js';
import type { MessageEvent, MessageTemplate } from '@/components/admin/GuestMessageModal';

export const dynamic = 'force-dynamic';

export default async function AdminGuestsPage() {
  const session = await requireAdminPage();
  const [guests, templates, { weddingDate, venueName }] = await Promise.all([
    listGuestsByParty(session.party) as Promise<Guest[]>,
    listTemplates() as Promise<MessageTemplate[]>,
    loadPlaceholderContext(),
  ]);
  const categories = mergeGroups(guests.map((g) => g.relationship));
  // Seating completion per party: seated people over accepted people, from the side's own and Common tables.
  const [tables, allInvitees] = await Promise.all([
    listSeatingTablesByParty(session.party),
    listAllInvitees(),
  ]);
  const seatingStatus = Object.fromEntries(
    computeSeatingCompletion({ guests, invitees: allInvitees, tables })
  ) as Record<string, SeatingStatus>;
  const messageEvents =(await getMessageEventsByGuest(guests.map((g) => g.id))) as Record<string, MessageEvent[]>;

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Guest list</h1>
        <InviteeRequests />
        <GuestManager
          initialGuests={filterGuests(guests, {}) as Guest[]}
          categories={categories}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'}
          party={session.party}
          templates={templates}
          initialMessageEvents={messageEvents}
          seatingStatus={seatingStatus}
          weddingDate={weddingDate}
          venueName={venueName}
        />
      </main>
    </>
  );
}
