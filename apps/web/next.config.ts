import { execSync } from "node:child_process";
import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");
// Vercel builds its own output; Docker and Render run the standalone server (apps/web/Dockerfile).
const onVercel = Boolean(process.env.VERCEL);

/** Short commit baked into the server bundle for /api/health. CLI deploys have no git metadata unless MEDX_COMMIT is passed. */
function buildCommit() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.MEDX_COMMIT || process.env.RENDER_GIT_COMMIT;
  if (fromEnv) return fromEnv.slice(0, 7);
  try { return execSync("git rev-parse --short=7 HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).toString().trim(); }
  catch { return ""; }
}

/**
 * Security headers for a public URL. The CSP keeps everything first-party: next/font fonts are self-hosted,
 * the product video and posters come from /media, QR codes are data: URLs, recordings may be blob: URLs.
 * Next.js inlines its bootstrap scripts, so script-src needs 'unsafe-inline' (no nonce, pages stay static).
 * The microphone is allowed for this origin only (voice intake and ambient consult); camera and location never.
 */
function securityHeaders() {
  const dev = process.env.NODE_ENV !== "production";
  // Vercel injects its toolbar on preview deployments only.
  const preview = process.env.VERCEL_ENV === "preview";
  const live = preview ? " https://vercel.live" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${live}`,
    `style-src 'self' 'unsafe-inline'${live}`,
    `img-src 'self' data: blob:${preview ? " https://vercel.live https://vercel.com" : ""}`,
    `font-src 'self' data:${preview ? " https://vercel.live https://assets.vercel.com" : ""}`,
    "media-src 'self' blob:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `frame-src 'self'${live}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}

const nextConfig: NextConfig = {
  transpilePackages: ["@medx/shared"],
  ...(onVercel ? {} : { output: "standalone" as const }),
  // Lets a check build run without colliding with another build in .next (e.g. MEDX_DIST_DIR=.next-check).
  ...(process.env.MEDX_DIST_DIR ? { distDir: process.env.MEDX_DIST_DIR } : {}),
  // Hide the Next.js dev badge so demo recordings stay clean.
  devIndicators: false,
  poweredByHeader: false,
  // The build type-checks app code only; vitest keeps the full tsconfig.json (tests included).
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // Server-only use (/api/health); a commit id is not a secret.
  env: { MEDX_BUILD_COMMIT: buildCommit() },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      // The product video and its poster never change under one name; ship a new name for a new cut.
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
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
