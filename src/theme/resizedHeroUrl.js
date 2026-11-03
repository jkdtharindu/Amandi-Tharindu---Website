/**
 * The hero photo is a CSS background, so Next.js does not shrink it the way it
 * shrinks <Image> photos: every guest would download the full upload (up to
 * 5 MB). For photos uploaded to our Vercel Blob store, route the address
 * through Next's own image resizer instead. Anything else (the built-in preset
 * photos, which are embedded data, or a link to another site) is returned
 * unchanged, because the resizer would refuse it.
 */
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export function resizedHeroUrl(url, width) {
  if (typeof url !== 'string' || !BLOB_HOST.test(url)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
