import AdminNav from '@/components/admin/AdminNav';
import ThemeEditor from '@/components/admin/ThemeEditor';
import { requireAdminPage } from '@/lib/adminGuard';
import { getThemeSettings } from '@/src/admin/themeRepo.js';
import { FONT_FAMILY_OPTIONS, FONT_STYLE_OPTIONS } from '@/src/admin/themeValidation.js';

export const dynamic = 'force-dynamic';

export default async function AdminThemePage() {
  const session = await requireAdminPage();
  const settings = await getThemeSettings();

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Theme</h1>
        <ThemeEditor
          initialSettings={settings}
          fontFamilyOptions={FONT_FAMILY_OPTIONS}
          fontStyleOptions={FONT_STYLE_OPTIONS}
        />
      </main>
    </>
  );
}
