// Builds the static bundle that gets packaged into the Android app.
//
// Why this script exists: the website (Vercel) needs middleware.ts and
// app/api/signup (server-side auth gating + the service-role signup call),
// but `next build` with output: "export" can't include either of those —
// it's a fully static, serverless bundle. Rather than maintaining two
// copies of the app, this script:
//   1. Temporarily moves middleware.ts and app/api out of the way
//   2. Runs `next build` with CAPACITOR_BUILD=1 (see next.config.mjs)
//   3. Puts middleware.ts and app/api back, even if the build failed
//
// The result lands in ./out — capacitor.config.ts points webDir at it.
// Run `npx cap sync android` afterwards to copy it into the Android project.
//
// Usage: npm run build:capacitor

import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const moves = [
  [path.join(root, "middleware.ts"), path.join(root, "middleware.ts.bak")],
  [path.join(root, "app", "api"), path.join(root, "app", "_api.bak")],
];

function setAside() {
  for (const [from, to] of moves) {
    if (existsSync(from)) renameSync(from, to);
  }
}

function restore() {
  for (const [from, to] of moves) {
    if (existsSync(to)) renameSync(to, from);
  }
}

setAside();
let result;
try {
  result = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CAPACITOR_BUILD: "1" },
    shell: process.platform === "win32",
  });
} finally {
  restore();
}

if (!result || result.status !== 0) {
  console.error("\nCapacitor build failed — middleware.ts and app/api have been restored.");
  process.exit(result ? result.status ?? 1 : 1);
}

console.log("\nStatic export ready in ./out — run `npx cap sync android` next.");
