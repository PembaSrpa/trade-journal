import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.journal.app",
  appName: "Trading Journal",
  // The app is bundled locally (see `npm run build:capacitor`, which builds
  // a static export into ../out and `npx cap sync android` copies it here).
  // No `server.url` — that used to point the WebView at the live site,
  // which is why every page nav reloaded over the network. Now the app
  // shell loads instantly from disk; only actual data calls (lib/api.ts)
  // hit the network, exactly like a normal API-backed app.
  webDir: "out",
};

export default config;