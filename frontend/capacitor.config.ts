import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.journal.app",
  appName: "Trading Journal",
  webDir: "public",
  server: {
    url: "https://trade-journal-three-umber.vercel.app",
    cleartext: false,
  },
};

export default config;