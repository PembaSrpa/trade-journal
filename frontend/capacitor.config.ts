import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.journal.app",
  appName: "Trading Journal",
  // Everything is bundled into the APK from the static export (`npm run build`
  // -> ./out, then `npx cap sync android`). Data lives on the device, so the app
  // needs no server and works with no connection at all.
  webDir: "out",
};

export default config;