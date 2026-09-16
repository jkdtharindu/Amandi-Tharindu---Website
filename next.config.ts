import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo. Without this, Turbopack walks up and
  // finds an unrelated package-lock.json in the user's home directory, infers
  // the wrong root, and warns during build.
  turbopack: {
    root: import.meta.dirname,
  },

  // Admin-uploaded photos (Sections/Events/Gallery/Bride & Groom, all via
  // Vercel Blob -- src/storage/blobStorage.js) render through next/image as
  // of the UI/UX Improvement Pass (TASKS.md). The store subdomain is
  // account-specific and not fixed in advance, so this uses the wildcard
  // pattern Vercel's own docs recommend rather than one hardcoded hostname.
  // Plain <img> was the deliberate original choice specifically to avoid
  // this config change (see MEMORY.md's 2026-09-11 image-upload entry) --
  // revisited now that Blob is actually live, not still hypothetical.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },

  // Phase 6 (single-page homepage redesign): pages folded into homepage
  // sections keep their old URL working as a redirect to the matching
  // anchor, per the owner's explicit call that existing links must not
  // break. proxy.ts's site gate runs before this for a signed-out visitor
  // (rewritten to /gate instead), so this only ever fires for a signed-in
  // guest — which is the only audience these paths ever had anyway.
  async redirects() {
    return [
      { source: "/our-story", destination: "/#our-story", permanent: false },
      { source: "/the-celebration", destination: "/#event-details", permanent: false },
      { source: "/gallery", destination: "/#gallery", permanent: false },
      { source: "/wishes", destination: "/#wishes", permanent: false },
    ];
  },
};

export default nextConfig;
