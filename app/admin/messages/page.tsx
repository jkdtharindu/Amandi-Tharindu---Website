import AdminNav from '@/components/admin/AdminNav';
import MessagingCenter, { type MessageTemplate } from '@/components/admin/MessagingCenter';
import { requireAdminPage } from '@/lib/adminGuard';
import { getCategories } from '@/src/admin/categories.js';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { listEvents } from '@/src/celebration-events/celebrationEventsRepo.js';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { formatWeddingDate } from '@/src/theme/formatWeddingDate.js';

export const dynamic = 'force-dynamic';

/**
 * Placeholder values shared by every message: [Date] and [Venue] come from the
 * same live sources the public pages render, so a reminder never quotes a date
 * the site has since changed. Both are best-effort — a messaging run should not
 * fail because the theme or events table is unreachable.
 */
async function loadPlaceholderContext(): Promise<{ weddingDate: string; venueName: string }> {
  let weddingDate = '';
  let venueName = '';

  try {
    const theme = await getThemeSettings();
    weddingDate = theme?.weddingDate ? formatWeddingDate(theme.weddingDate) : '';
    venueName = theme?.venueName || '';
  } catch {
    // fall through to the event lookup below
  }

  if (!venueName) {
    try {
      const events = await listEvents();
      venueName = events[0]?.venueName || '';
    } catch {
      venueName = '';
    }
  }

  return { weddingDate, venueName };
}

export default async function AdminMessagesPage() {
  const session = await requireAdminPage();
  const templates = (await listTemplates()) as MessageTemplate[];
  const { weddingDate, venueName } = await loadPlaceholderContext();

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Messages</h1>
        <p className="text-sm text-slate-500 mb-6">
          Work through a group of guests on WhatsApp, one message at a time. Nothing is sent
          automatically — each one opens in WhatsApp for you to send yourself.
        </p>
        <MessagingCenter
          templates={templates}
          categories={getCategories()}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'}
          weddingDate={weddingDate}
          venueName={venueName}
        />
      </main>
    </>
  );
}
