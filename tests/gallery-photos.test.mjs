import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateGalleryPhoto, sanitizeGalleryPhoto } from '../src/gallery/validateGalleryPhoto.js';
import {
  listGalleryPhotos,
  createGalleryPhoto,
  updateGalleryPhoto,
  deleteGalleryPhoto,
} from '../src/gallery/galleryPhotosRepo.js';

beforeEach(async () => {
  // Reset in-memory store by listing and deleting all photos
  const photos = await listGalleryPhotos();
  for (const photo of photos) {
    await deleteGalleryPhoto(photo.id);
  }
});

test('validateGalleryPhoto rejects a missing photo URL', () => {
  const result = validateGalleryPhoto({ photoUrl: '', caption: 'Test' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.photoUrl, 'Photo URL is required');
});

test('validateGalleryPhoto rejects a photo URL that is too long', () => {
  const longUrl = 'https://example.com/' + 'x'.repeat(2000);
  const result = validateGalleryPhoto({ photoUrl: longUrl, caption: '' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.photoUrl, 'Photo URL is too long');
});

test('validateGalleryPhoto rejects a caption that is too long', () => {
  const longCaption = 'x'.repeat(501);
  const result = validateGalleryPhoto({ photoUrl: 'https://example.com/photo.jpg', caption: longCaption });
  assert.equal(result.valid, false);
  assert.equal(result.errors.caption, 'Caption is too long (max 500 characters)');
});

test('validateGalleryPhoto rejects an invalid display order', () => {
  const result = validateGalleryPhoto({ photoUrl: 'https://example.com/photo.jpg', displayOrder: -1 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.displayOrder, 'Display order must be a non-negative integer');
});

test('validateGalleryPhoto accepts valid input', () => {
  const result = validateGalleryPhoto({
    photoUrl: 'https://example.com/photo.jpg',
    caption: 'Our engagement photo',
    displayOrder: 0,
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('sanitizeGalleryPhoto trims strings and defaults displayOrder', () => {
  const sanitized = sanitizeGalleryPhoto({
    photoUrl: '  https://example.com/photo.jpg  ',
    caption: '  Our photo  ',
    displayOrder: 0,
  });
  assert.equal(sanitized.photoUrl, 'https://example.com/photo.jpg');
  assert.equal(sanitized.caption, 'Our photo');
  assert.equal(sanitized.displayOrder, 0);
});

test('createGalleryPhoto adds a new photo and returns it', async () => {
  const photo = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo1.jpg',
    caption: 'First photo',
    displayOrder: 0,
  });

  assert.equal(photo.photoUrl, 'https://example.com/photo1.jpg');
  assert.equal(photo.caption, 'First photo');
  assert.equal(photo.displayOrder, 0);
  assert(photo.id);
});

test('listGalleryPhotos returns photos in display order', async () => {
  const photo1 = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo1.jpg',
    displayOrder: 1,
  });
  const photo2 = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo2.jpg',
    displayOrder: 0,
  });
  const photo3 = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo3.jpg',
    displayOrder: 2,
  });

  const photos = await listGalleryPhotos();
  assert.equal(photos.length, 3);
  assert.equal(photos[0].id, photo2.id);
  assert.equal(photos[1].id, photo1.id);
  assert.equal(photos[2].id, photo3.id);
});

test('updateGalleryPhoto changes caption and display order', async () => {
  const created = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo.jpg',
    caption: 'Original caption',
    displayOrder: 0,
  });

  const updated = await updateGalleryPhoto(created.id, {
    caption: 'Updated caption',
    displayOrder: 2,
  });

  assert.equal(updated.caption, 'Updated caption');
  assert.equal(updated.displayOrder, 2);
  assert.equal(updated.photoUrl, 'https://example.com/photo.jpg');
});

test('updateGalleryPhoto returns null for nonexistent photo', async () => {
  const result = await updateGalleryPhoto('nonexistent-id', { caption: 'Test' });
  assert.equal(result, null);
});

test('deleteGalleryPhoto removes a photo and returns true', async () => {
  const photo = await createGalleryPhoto({
    photoUrl: 'https://example.com/photo.jpg',
  });

  const deleted = await deleteGalleryPhoto(photo.id);
  assert.equal(deleted, true);

  const photos = await listGalleryPhotos();
  assert.equal(photos.length, 0);
});

test('deleteGalleryPhoto returns false for nonexistent photo', async () => {
  const deleted = await deleteGalleryPhoto('nonexistent-id');
  assert.equal(deleted, false);
});
