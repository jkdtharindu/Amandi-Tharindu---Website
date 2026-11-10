'use client';

import { useEffect, useState } from 'react';
import ImageUploadField from './ImageUploadField';
import { useToast } from '@/components/Toast';

type GalleryPhoto = {
  id: string;
  photoUrl: string;
  caption: string;
  displayOrder: number;
  focusX?: number;
  focusY?: number;
};

export default function GalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [focusOpenId, setFocusOpenId] = useState<string | null>(null);
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

  async function handleSetFocus(id: string, focusX: number, focusY: number) {
    // Move the dot straight away; the server answer replaces it.
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, focusX, focusY } : p)));
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ focusX, focusY }),
      });
      const data = await res.json();
      if (res.ok && data.success) return;
      showToast({
        kind: 'error',
        text: data.message || 'Could not save the focus point. Has the latest database update been run?',
      });
      await loadPhotos();
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
              className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote,
                  admin-supplied URL; see components/public/CustomSections.tsx
                  for why next/image is skipped project-wide for uploaded photos. */}
              <img
                src={photo.photoUrl}
                alt={photo.caption || 'Gallery photo'}
                className="h-20 w-24 object-cover rounded"
                style={{ objectPosition: `${photo.focusX ?? 50}% ${photo.focusY ?? 50}%` }}
              />
              <div className="flex-1 min-w-[10rem]">
                <input
                  type="text"
                  value={photo.caption}
                  onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                  placeholder="Caption"
                  className="w-full text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setFocusOpenId(focusOpenId === photo.id ? null : photo.id)}
                    className="px-2 py-1 bg-slate-800 text-white hover:bg-slate-700 rounded"
                  >
                    {focusOpenId === photo.id ? 'Done' : '◎ Position photo'}
                  </button>
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

              {focusOpenId === photo.id && (
                <div className="w-full mt-1 p-3 bg-white rounded border border-slate-200">
                  <p className="text-xs text-slate-600 mb-2">
                    Tap or click on the most important spot (like a face). The small preview on the
                    right shows how the photo will be cropped on the website.
                  </p>
                  <div className="flex flex-wrap items-start gap-4">
                    <div
                      className="relative inline-block cursor-crosshair select-none touch-none"
                      onPointerDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                        handleSetFocus(
                          photo.id,
                          Math.min(100, Math.max(0, x)),
                          Math.min(100, Math.max(0, y))
                        );
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photoUrl}
                        alt=""
                        draggable={false}
                        className="block max-h-64 max-w-full rounded"
                      />
                      <span
                        className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-pink-500/40 shadow-[0_0_0_2px_rgba(0,0,0,0.5)] pointer-events-none"
                        style={{ left: `${photo.focusX ?? 50}%`, top: `${photo.focusY ?? 50}%` }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Website preview</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photoUrl}
                        alt=""
                        className="h-[110px] w-[135px] object-cover rounded"
                        style={{ objectPosition: `${photo.focusX ?? 50}% ${photo.focusY ?? 50}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
