import AdminNav from '@/components/admin/AdminNav';
import GuestManager, { type Guest } from '@/components/admin/GuestManager';
import { requireAdminPage } from '@/lib/adminGuard';
import { listAllGuests } from '@/src/admin/adminRepo.js';
import { filterGuests } from '@/src/admin/guestQueries.js';

export const dynamic = 'force-dynamic';

export default async function AdminGuestsPage() {
  const session = await requireAdminPage();
  const guests = (await listAllGuests()) as Guest[];

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Guest list</h1>
        <GuestManager initialGuests={filterGuests(guests, {}) as Guest[]} />
      </main>
    </>
  );
}
