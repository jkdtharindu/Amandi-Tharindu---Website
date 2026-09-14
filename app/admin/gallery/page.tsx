import AdminNav from '@/components/admin/AdminNav';
import GalleryManager from '@/components/admin/GalleryManager';
import { requireAdminPage } from '@/lib/adminGuard';

export default async function AdminGalleryPage() {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav email={admin.email} />
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-6">Gallery Photos</h1>
        <GalleryManager />
      </main>
    </div>
  );
}
