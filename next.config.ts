import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo. Without this, Turbopack walks up and
  // finds an unrelated package-lock.json in the user's home directory, infers
  // the wrong root, and warns during build.
  turbopack: {
    root: import.meta.dirname,
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
    ];
  },
};

export default nextConfig;
