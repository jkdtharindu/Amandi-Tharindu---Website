import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageBuffer, detectMimeType } from '../src/image-validator.js';

// Create properly sized test buffers with real signatures
const REAL_JPEG_HEADER = Buffer.from('ffd8ffeae004' + '0000'.repeat(100), 'hex'); // JPEG + some data
const REAL_PNG_HEADER = Buffer.from('89504e470d0a1a0a' + '0000'.repeat(100), 'hex'); // PNG + some data
const REAL_WEBP_HEADER = Buffer.concat([
  Buffer.from('52494646', 'hex'), // RIFF
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // Size (4 bytes)
  Buffer.from('57454250', 'hex'), // WEBP
  Buffer.alloc(100), // Padding
]);

test('validateImageBuffer accepts valid JPEG by magic bytes', () => {
  const result = validateImageBuffer(REAL_JPEG_HEADER, 'image/jpeg');
  assert.equal(result.valid, true, 'Valid JPEG accepted');
});

test('validateImageBuffer rejects invalid JPEG signature', () => {
  const fakeJpeg = Buffer.from('0000000000000000000000000000', 'hex');
  const result = validateImageBuffer(fakeJpeg, 'image/jpeg');
  assert.equal(result.valid, false, 'Invalid JPEG rejected');
  assert.match(result.reason, /JPEG signature/);
});

test('validateImageBuffer accepts valid PNG by magic bytes', () => {
  const result = validateImageBuffer(REAL_PNG_HEADER, 'image/png');
  assert.equal(result.valid, true, 'Valid PNG accepted');
});

test('validateImageBuffer rejects invalid PNG signature', () => {
  const fakePng = Buffer.from('00000000000000000000000000000000', 'hex');
  const result = validateImageBuffer(fakePng, 'image/png');
  assert.equal(result.valid, false, 'Invalid PNG rejected');
  assert.match(result.reason, /PNG signature/);
});

test('validateImageBuffer accepts valid WebP by magic bytes', () => {
  const result = validateImageBuffer(REAL_WEBP_HEADER, 'image/webp');
  assert.equal(result.valid, true, 'Valid WebP accepted');
});

test('validateImageBuffer rejects invalid WebP signature', () => {
  const fakeWebp = Buffer.alloc(20, 0x00);
  const result = validateImageBuffer(fakeWebp, 'image/webp');
  assert.equal(result.valid, false, 'Invalid WebP rejected');
  assert.match(result.reason, /WebP signature/);
});

test('validateImageBuffer rejects too-small buffers', () => {
  const tiny = Buffer.from('ff', 'hex');
  const result = validateImageBuffer(tiny, 'image/jpeg');
  assert.equal(result.valid, false, 'Too-small buffer rejected');
  assert.match(result.reason, /too small/);
});

test('validateImageBuffer rejects empty buffer', () => {
  const result = validateImageBuffer(Buffer.alloc(0), 'image/jpeg');
  assert.equal(result.valid, false, 'Empty buffer rejected');
});

test('detectMimeType identifies JPEG', () => {
  const type = detectMimeType(REAL_JPEG_HEADER);
  assert.equal(type, 'image/jpeg', 'JPEG detected');
});

test('detectMimeType identifies PNG', () => {
  const type = detectMimeType(REAL_PNG_HEADER);
  assert.equal(type, 'image/png', 'PNG detected');
});

test('detectMimeType identifies WebP', () => {
  const type = detectMimeType(REAL_WEBP_HEADER);
  assert.equal(type, 'image/webp', 'WebP detected');
});

test('detectMimeType returns null for unknown format', () => {
  const unknown = Buffer.from('deadbeef', 'hex');
  const type = detectMimeType(unknown);
  assert.equal(type, null, 'Unknown format returns null');
});

test('validateImageBuffer detects spoofed file types', () => {
  // File with PNG header but claiming to be JPEG
  const spoofed = REAL_PNG_HEADER;
  const result = validateImageBuffer(spoofed, 'image/jpeg');
  assert.equal(result.valid, false, 'Spoofed PNG-as-JPEG rejected');
});

test('validateImageBuffer detects renamed executables claiming image type', () => {
  // Simulate a Windows EXE header (MZ = 4D 5A)
  const exe = Buffer.from('4d5a9000', 'hex');
  const resultJpeg = validateImageBuffer(exe, 'image/jpeg');
  const resultPng = validateImageBuffer(exe, 'image/png');
  assert.equal(resultJpeg.valid, false, 'EXE claiming JPEG rejected');
  assert.equal(resultPng.valid, false, 'EXE claiming PNG rejected');
});
