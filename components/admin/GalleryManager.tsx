'use client';

import { useEffect, useState } from 'react';
import ImageUploadField from './ImageUploadField';
import { useToast } from '@/components/Toast';

type GalleryPhoto = {
  id: string;
  photoUrl: string;
  caption: string;
  displayOrder: number;
};

export default function GalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));

    loadPhotos();
  }, [showToast]);

  async function loadPhotos() {
    try {
      const res = await fetch('/api/admin/gallery');
      const data = await res.json();
      if (res.ok && data.success) {
        setPhotos(data.photos);
      }
    } catch (error) {
      console.error('Failed to load gallery photos:', error);
    }
  }

  async function handleAddPhoto(url: string) {
    if (!url.trim()) return;

    setBusy(true);
    setErrors({});

    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          photoUrl: url,
          caption: newCaption.trim(),
          displayOrder: photos.length,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPhotos([...photos, data.photo]);
        setNewCaption('');
        showToast({ kind: 'ok', text: 'Photo added to gallery.' });
        return;
      }

      if (data.errors) setErrors(data.errors);
      showToast({ kind: 'error', text: data.message || 'Could not add photo.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateCaption(id: string, caption: string) {
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ caption }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPhotos(photos.map((p) => (p.id === id ? data.photo : p)));
        showToast({ kind: 'ok', text: 'Caption updated.' });
        return;
      }

      showToast({ kind: 'error', text: data.message || 'Could not update caption.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong.' });
    }
  }

  async function handleReorder(id: string, newOrder: number) {
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ displayOrder: newOrder }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await loadPhotos();
        showToast({ kind: 'ok', text: 'Gallery order updated.' });
        return;
      }

      showToast({ kind: 'error', text: data.message || 'Could not reorder photos.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong.' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this photo from the gallery?')) return;

    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPhotos(photos.filter((p) => p.id !== id));
        showToast({ kind: 'ok', text: 'Photo removed from gallery.' });
        return;
      }

      showToast({ kind: 'error', text: data.message || 'Could not delete photo.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong.' });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold mb-4">Gallery Photos</h2>

      {/* Upload section */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold mb-3">Add a new photo</h3>
        <ImageUploadField
          label="Photo"
          imageUrl=""
          onChange={(url) => handleAddPhoto(url)}
          csrfToken={csrfToken}
        />
        <div className="mt-3">
          <label htmlFor="newCaption" className="block text-xs font-semibold text-slate-500 mb-1">
            Caption (optional)
          </label>
          <input
            id="newCaption"
            type="text"
            value={newCaption}
            onChange={(e) => setNewCaption(e.target.value)}
            placeholder="e.g., Our engagement photo"
            disabled={busy}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-100"
          />
        </div>
        {errors.photoUrl && <p className="text-xs text-red-600 mt-2">{errors.photoUrl}</p>}
        {errors.caption && <p className="text-xs text-red-600 mt-2">{errors.caption}</p>}
      </div>

      {/* Photos list */}
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">No photos yet. Upload your first one above.</p>
      ) : (
        <div className="space-y-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote,
                  admin-supplied URL; see components/public/CustomSections.tsx
                  for why next/image is skipped project-wide for uploaded photos. */}
              <img
                src={photo.photoUrl}
                alt={photo.caption || 'Gallery photo'}
                className="h-16 w-16 object-cover rounded"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={photo.caption}
                  onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                  placeholder="Caption"
                  className="w-full text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <div className="mt-2 flex gap-2 text-xs">
                  {index > 0 && (
                    <button
                      onClick={() => handleReorder(photo.id, index - 1)}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                      disabled={busy}
                    >
                      ↑ Move up
                    </button>
                  )}
                  {index < photos.length - 1 && (
                    <button
                      onClick={() => handleReorder(photo.id, index + 1)}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                      disabled={busy}
                    >
                      ↓ Move down
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={busy}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
