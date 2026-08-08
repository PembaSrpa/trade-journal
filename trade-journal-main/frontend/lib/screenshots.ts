import { createClient } from "@/lib/supabase/client";

export async function getSignedScreenshotUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("screenshots")
    .createSignedUrl(path, 3600);

  if (error || !data) return null;
  return data.signedUrl;
}
