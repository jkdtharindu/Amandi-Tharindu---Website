import AdminNav from '@/components/admin/AdminNav';
import ThemeEditor from '@/components/admin/ThemeEditor';
import ShareImageCard from '@/components/admin/ShareImageCard';
import { requireAdminPage } from '@/lib/adminGuard';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { shareImageUrl } from '@/src/messaging/shareImage.js';
import { buildSharePhotoPrompt } from '@/src/messaging/sharePhotoPrompt.js';
import { formatWeddingDate } from '@/src/theme/formatWeddingDate.js';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { FONT_FAMILY_OPTIONS, FONT_STYLE_OPTIONS } from '@/src/theme/basicThemeValidation.js';

export const dynamic = 'force-dynamic';

export default async function AdminThemePage() {
  const session = await requireAdminPage();
  const settings = await getThemeSettings();
  const templates = await listTemplates();

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
        <ShareImageCard
          initialImageUrl={shareImageUrl(templates)}
          prompt={buildSharePhotoPrompt('main_invitation', {
            coupleNames: settings.coupleNames,
            weddingDate: settings.weddingDate ? formatWeddingDate(settings.weddingDate) : '',
            venueName: settings.venueName,
            colors: {
              name: settings.paletteName,
              primary: settings.primaryColor,
              secondary: settings.secondaryColor,
              accent: settings.accentColor,
            },
          })}
        />
      </main>
    </>
  );
}
