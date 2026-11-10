import { query } from '../db.js';
import { galleryPhotos } from '../data/galleryPhotosStore.js';

const useDb = Boolean(process.env.DATABASE_URL);

export async function listGalleryPhotos() {
  if (!useDb) {
    return listInMemory();
  }
  const { rows } = await query(
    'SELECT * FROM gallery_photos ORDER BY display_order ASC'
  );
  return rows.map(mapRow);
}

export async function createGalleryPhoto({ photoUrl, caption = '', displayOrder = 0 }) {
  if (!useDb) {
    return createInMemory({ photoUrl, caption, displayOrder });
  }
  const { rows } = await query(
    `INSERT INTO gallery_photos (photo_url, caption, display_order)
     VALUES ($1, $2, $3)
     RETURNING id, photo_url, caption, display_order, created_at`,
    [photoUrl, caption, displayOrder]
  );
  return mapRow(rows[0]);
}

export async function updateGalleryPhoto(id, { caption, displayOrder, focusX, focusY }) {
  if (!useDb) {
    return updateInMemory(id, { caption, displayOrder, focusX, focusY });
  }
  const hasFocus = focusX !== undefined && focusY !== undefined;
  const updates = [];
  const params = [id];
  let paramIndex = 2;

  if (caption !== undefined) {
    updates.push(`caption = $${paramIndex++}`);
    params.push(caption);
  }
  if (displayOrder !== undefined) {
    updates.push(`display_order = $${paramIndex++}`);
    params.push(displayOrder);
  }

  if (!updates.length && !hasFocus) return null;

  if (updates.length) {
    const { rows } = await query(
      `UPDATE gallery_photos SET ${updates.join(', ')} WHERE id = $1 RETURNING id`,
      params
    );
    if (!rows.length) return null;
  }
  // The focus point is its own statement so caption/order saves keep working
  // even before migration 040 has been run.
  if (hasFocus) {
    const { rows } = await query(
      'UPDATE gallery_photos SET focus_x = $2, focus_y = $3 WHERE id = $1 RETURNING id',
      [id, focusX, focusY]
    );
    if (!rows.length) return null;
  }
  const { rows } = await query('SELECT * FROM gallery_photos WHERE id = $1', [id]);
  return rows.length ? mapRow(rows[0]) : null;
}

export async function deleteGalleryPhoto(id) {
  if (!useDb) {
    return deleteInMemory(id);
  }
  const { rows } = await query(
    'DELETE FROM gallery_photos WHERE id = $1 RETURNING id',
    [id]
  );
  return rows.length > 0;
}

function mapRow(row) {
  return {
    id: row.id,
    photoUrl: row.photo_url,
    caption: row.caption || '',
    displayOrder: row.display_order || 0,
    focusX: row.focus_x ?? 50,
    focusY: row.focus_y ?? 50,
    createdAt: row.created_at,
  };
}

import crypto from 'node:crypto';

// In-memory fallback for DATABASE_URL-unset dev mode
function listInMemory() {
  return [...galleryPhotos].sort((a, b) => a.displayOrder - b.displayOrder);
}

function createInMemory({ photoUrl, caption = '', displayOrder = 0 }) {
  const item = {
    id: crypto.randomUUID(),
    photoUrl,
    caption,
    displayOrder: displayOrder ?? galleryPhotos.length,
    focusX: 50,
    focusY: 50,
    createdAt: new Date().toISOString(),
  };
  galleryPhotos.push(item);
  return item;
}

function updateInMemory(id, { caption, displayOrder, focusX, focusY }) {
  const item = galleryPhotos.find((i) => i.id === id);
  if (!item) return null;
  if (caption !== undefined) item.caption = caption;
  if (displayOrder !== undefined) item.displayOrder = displayOrder;
  if (focusX !== undefined && focusY !== undefined) {
    item.focusX = focusX;
    item.focusY = focusY;
  }
  return item;
}

function deleteInMemory(id) {
  const index = galleryPhotos.findIndex((i) => i.id === id);
  if (index === -1) return false;
  galleryPhotos.splice(index, 1);
  return true;
}
