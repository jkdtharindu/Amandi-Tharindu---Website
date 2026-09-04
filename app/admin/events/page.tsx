import AdminNav from '@/components/admin/AdminNav';
import EventManager from '@/components/admin/EventManager';
import { requireAdminPage } from '@/lib/adminGuard';
import { listEvents } from '@/src/celebration-events/celebrationEventsRepo.js';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const session = await requireAdminPage();
  const events = await listEvents();

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Events</h1>
        <p className="text-sm text-slate-500 mb-6">
          Manage the ceremony, reception, and any other celebration events shown on the public site.
        </p>
        <EventManager initialEvents={events} />
      </main>
    </>
  );
}
