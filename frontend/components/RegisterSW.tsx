"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/** Registers the offline service worker on the web build (not inside the Android app, which bundles everything). */
export function RegisterSW() {
  useEffect(() => {
    if (Capacitor.isNativePlatform() || process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
