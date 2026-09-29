import AdminNav from '@/components/admin/AdminNav';
import GuestManager, { type Guest } from '@/components/admin/GuestManager';
import InviteeRequests from '@/components/admin/InviteeRequests';
import { requireAdminPage } from '@/lib/adminGuard';
import { listGuestsByParty } from '@/src/admin/adminRepo.js';
import { filterGuests } from '@/src/admin/guestQueries.js';
import { getCategories } from '@/src/admin/categories.js';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { loadPlaceholderContext } from '@/src/admin/loadPlaceholderContext.js';
import type { MessageTemplate } from '@/components/admin/GuestMessageModal';

export const dynamic = 'force-dynamic';

export default async function AdminGuestsPage() {
  const session = await requireAdminPage();
  const [guests, templates, { weddingDate, venueName }] = await Promise.all([
    listGuestsByParty(session.party) as Promise<Guest[]>,
    listTemplates() as Promise<MessageTemplate[]>,
    loadPlaceholderContext(),
  ]);
  const categories = getCategories();

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
          weddingDate={weddingDate}
          venueName={venueName}
        />
      </main>
    </>
  );
}
