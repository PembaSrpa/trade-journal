/** @type {import('next').NextConfig} */

// The website (Vercel) build uses the normal Next.js server: `next build`,
// with middleware.ts and app/api/signup for server-side auth gating and the
// service-role signup call.
//
// The Android app build is a fully static export bundled into the APK so
// the app opens and navigates between pages instantly and offline, with no
// dependency on reaching the server just to render a page. Static export
// can't include middleware or server API routes, so `npm run build:capacitor`
// (see package.json) temporarily moves those two aside before calling
// `next build` with output: "export", then restores them afterwards. This
// file just flips on `output: "export"` when that script sets
// CAPACITOR_BUILD=1 — it never affects the normal `npm run build`.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig = {
  ...(isCapacitorBuild
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
