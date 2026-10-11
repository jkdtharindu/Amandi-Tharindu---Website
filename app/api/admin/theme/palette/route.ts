import { NextRequest, NextResponse } from 'next/server';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { extractPalette } from '@/src/theme/paletteExtract.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

const MAX_BYTES = 8 * 1024 * 1024;

/** The only places a saved hero image can live: this app's public Blob store, or a built-in curated preset. */
function isReadableHeroUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

async function loadImage(url: string): Promise<Buffer | null> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma === -1) return null;
    const meta = url.slice(0, comma);
    const body = url.slice(comma + 1);
    return meta.includes(';base64')
      ? Buffer.from(body, 'base64')
      : Buffer.from(decodeURIComponent(body), 'utf8');
  }
  const res = await fetch(url);
  if (!res.ok) return null;
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.length > MAX_BYTES ? null : buffer;
}

/**
 * Reads the section colours from the hero photo that is currently SAVED, for a
 * photo uploaded before colour-reading existed. The address always comes from
 * the saved theme, never from the request, so this cannot be pointed at an
 * arbitrary site. Returns the colours; saving them is the normal Theme save.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const settings = await getThemeSettings();
  const url = String(settings.heroImageUrl ?? '');
  if (!url) {
    return NextResponse.json(
      { success: false, reason: 'no_hero', message: 'There is no saved hero photo to read colours from.' },
      { status: 400 }
    );
  }
  if (!isReadableHeroUrl(url)) {
    return NextResponse.json(
      { success: false, reason: 'unsupported_source', message: 'This hero photo cannot be read. Upload it again from this page.' },
      { status: 400 }
    );
  }

  try {
    const buffer = await loadImage(url);
    if (!buffer) {
      return NextResponse.json(
        { success: false, reason: 'unreadable', message: 'Could not load the hero photo.' },
        { status: 502 }
      );
    }
    const palette = await extractPalette(buffer);
    return NextResponse.json({ success: true, palette });
  } catch (error) {
    console.error('hero palette read failed:', error);
    return NextResponse.json(
      { success: false, reason: 'extract_failed', message: 'Could not read colours from the hero photo.' },
      { status: 500 }
    );
  }
}
