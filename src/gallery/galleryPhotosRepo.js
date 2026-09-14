import { query } from '../db.js';
import { galleryPhotos } from '../data/galleryPhotosStore.js';

export async function listGalleryPhotos() {
  if (!process.env.DATABASE_URL) {
    return listInMemory();
  }
  const { rows } = await query(
    'SELECT id, photo_url, caption, display_order, created_at FROM gallery_photos ORDER BY display_order ASC'
  );
  return rows.map(mapRow);
}

export async function createGalleryPhoto({ photoUrl, caption = '', displayOrder = 0 }) {
  if (!process.env.DATABASE_URL) {
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

export async function updateGalleryPhoto(id, { caption, displayOrder }) {
  if (!process.env.DATABASE_URL) {
    return updateInMemory(id, { caption, displayOrder });
  }
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

  if (!updates.length) return null;

  const { rows } = await query(
    `UPDATE gallery_photos SET ${updates.join(', ')} WHERE id = $1
     RETURNING id, photo_url, caption, display_order, created_at`,
    params
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function deleteGalleryPhoto(id) {
  if (!process.env.DATABASE_URL) {
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
    createdAt: new Date().toISOString(),
  };
  galleryPhotos.push(item);
  return item;
}

function updateInMemory(id, { caption, displayOrder }) {
  const item = galleryPhotos.find((i) => i.id === id);
  if (!item) return null;
  if (caption !== undefined) item.caption = caption;
  if (displayOrder !== undefined) item.displayOrder = displayOrder;
  return item;
}

function deleteInMemory(id) {
  const index = galleryPhotos.findIndex((i) => i.id === id);
  if (index === -1) return false;
  galleryPhotos.splice(index, 1);
  return true;
}
