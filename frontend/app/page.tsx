"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Client component so this works identically on the website (Vercel) and
// in the locally-bundled Android build, which has no server to read
// cookies with. getSession() reads the persisted session straight from
// local storage with no network call, so this resolves instantly even
// fully offline. (getUser() looks similar but always revalidates against
// Supabase's server over the network — with no connection that promise
// never resolves and the app would sit on a blank screen forever.)
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/overview" : "/login");
    });
  }, [router]);

  return null;
}
