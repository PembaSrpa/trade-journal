/** @type {import('next').NextConfig} */

// The app is 100% client-side: all data lives on the device (IndexedDB), so
// there's no server. `next build` emits a fully static site into ./out, which is
// used both as the website (any static host) and as the bundle packaged into the
// Android app by Capacitor (`npm run android:build`).
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
