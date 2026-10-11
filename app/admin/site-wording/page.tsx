import AdminNav from '@/components/admin/AdminNav';
import SiteWordingEditor from '@/components/admin/SiteWordingEditor';
import { requireAdminPage } from '@/lib/adminGuard';
import { getSiteTextSafe } from '@/src/site-text/siteTextRepo.js';
import { SITE_TEXT_FIELDS, SITE_TEXT_GROUPS, MAX_SITE_TEXT_LENGTH } from '@/src/site-text/siteTextRegistry.js';

export const dynamic = 'force-dynamic';

export default async function AdminSiteWordingPage() {
  const session = await requireAdminPage();
  const overrides = await getSiteTextSafe();

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Site wording</h1>
        <p className="text-sm text-slate-500 mb-6">
          Change the headings, paragraphs, menu names and button text guests see. Open a group, edit the
          text, then press Save. Names and dates in {'{curly brackets}'} are filled in automatically.
          Names, dates, photos and events are changed on their own pages.
        </p>
        <SiteWordingEditor
          fields={SITE_TEXT_FIELDS}
          groups={SITE_TEXT_GROUPS}
          initialOverrides={overrides}
          maxLength={MAX_SITE_TEXT_LENGTH}
        />
      </main>
    </>
  );
}
