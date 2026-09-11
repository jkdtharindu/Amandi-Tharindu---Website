import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateImageFile,
  isStorageConfigured,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '../src/storage/blobStorage.js';

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

test('validateImageFile accepts a real JPEG', () => {
  const result = validateImageFile({ buffer: JPEG_BYTES, mimeType: 'image/jpeg' });
  assert.equal(result.valid, true);
});

test('validateImageFile accepts a real PNG', () => {
  const result = validateImageFile({ buffer: PNG_BYTES, mimeType: 'image/png' });
  assert.equal(result.valid, true);
});

test('validateImageFile accepts a real WEBP', () => {
  const result = validateImageFile({ buffer: WEBP_BYTES, mimeType: 'image/webp' });
  assert.equal(result.valid, true);
});

test('validateImageFile rejects a disallowed mime type', () => {
  const result = validateImageFile({ buffer: PNG_BYTES, mimeType: 'application/pdf' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_type');
});

test('validateImageFile rejects a file over the size limit', () => {
  const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_FILE_SIZE_BYTES)]);
  const result = validateImageFile({ buffer: oversized, mimeType: 'image/png' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'file_too_large');
});

test('validateImageFile rejects content that does not match its claimed mime type', () => {
  // A renamed non-image file claiming to be a PNG -- the exact spoofed-type
  // scenario this project already caught once in the legacy upload route.
  const notActuallyAnImage = Buffer.from('#!/bin/sh\necho hi\n');
  const result = validateImageFile({ buffer: notActuallyAnImage, mimeType: 'image/png' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'content_mismatch');
});

test('validateImageFile rejects an empty file', () => {
  const result = validateImageFile({ buffer: Buffer.alloc(0), mimeType: 'image/jpeg' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'empty_file');
});

test('isStorageConfigured reflects BLOB_READ_WRITE_TOKEN', () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(isStorageConfigured(), false);

    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    assert.equal(isStorageConfigured(), true);
  } finally {
    if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = original;
  }
});

test('ALLOWED_MIME_TYPES only allows the three supported image formats', () => {
  assert.deepEqual([...ALLOWED_MIME_TYPES].sort(), ['image/jpeg', 'image/png', 'image/webp']);
});
