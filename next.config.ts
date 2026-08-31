import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo. Without this, Turbopack walks up and
  // finds an unrelated package-lock.json in the user's home directory, infers
  // the wrong root, and warns during build.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
