"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// No accounts or sign-in any more: the app opens straight to the Overview.
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overview");
  }, [router]);
  return null;
}
