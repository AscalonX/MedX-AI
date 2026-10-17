import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@medx/shared"],
  output: "standalone",
  // Hide the Next.js dev badge so demo recordings stay clean.
  devIndicators: false,
  // The Expo web export is a single-page app served from public/patient (scripts/build-patient-web.sh).
  async rewrites() {
    return [
      { source: "/patient", destination: "/patient/index.html" },
      { source: "/patient/:path((?!_expo|assets).*)", destination: "/patient/index.html" },
    ];
  },
  // The app imports ../../packages/shared, so both bundler and tracing must see the repo root.
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
