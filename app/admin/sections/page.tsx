import AdminNav from '@/components/admin/AdminNav';
import SectionManager from '@/components/admin/SectionManager';
import HomeSectionToggles from '@/components/admin/HomeSectionToggles';
import { requireAdminPage } from '@/lib/adminGuard';
import { getHomeSectionVisibilitySafe, HOME_SECTIONS } from '@/src/home-sections/homeSectionsRepo.js';
import { listSections } from '@/src/sections/sectionsRepo.js';
import { VALID_PAGES, VALID_SECTION_TYPES } from '@/src/sections/validateSection.js';

export const dynamic = 'force-dynamic';

export default async function AdminSectionsPage() {
  const session = await requireAdminPage();
  const sections = await listSections();
  const visibility = await getHomeSectionVisibilitySafe();

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Sections</h1>
        <p className="text-sm text-slate-500 mb-6">
          Add custom content blocks to any public page.
        </p>
        <HomeSectionToggles sections={HOME_SECTIONS} initialVisibility={visibility} />
        <SectionManager
          initialSections={sections}
          validPages={VALID_PAGES}
          validSectionTypes={VALID_SECTION_TYPES}
        />
      </main>
    </>
  );
}
