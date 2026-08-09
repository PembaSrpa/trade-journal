"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Client component so this works identically on the website (Vercel) and
// in the locally-bundled Android build, which has no server to read
// cookies with. lib/supabase/client.ts already persists the session
// locally, so this check is instant and works offline too.
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "/overview" : "/login");
    });
  }, [router]);

  return null;
}
