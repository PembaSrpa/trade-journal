"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const KEY = "journal_redirect";

/** Continues to the route an early script in app/page.tsx remembered (or the Overview). */
export function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    let target = "/overview";
    try {
      const saved = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      // The early script in app/page.tsx already guards against redirect loops.
      if (saved && saved.startsWith("/")) target = saved;
    } catch {
      /* storage unavailable: just go to the Overview */
    }
    router.replace(target);
  }, [router]);
  return null;
}
