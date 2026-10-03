import { getRepo } from "@/lib/local";
import { newId } from "@/lib/local/id";
import { readFileAsDataUrl } from "@/lib/local/files";

/** Stores a chart screenshot on-device and returns its id (saved as the trade's `screenshot_url`). */
export async function saveScreenshot(file: File): Promise<string> {
  const id = newId();
  const data_url = await readFileAsDataUrl(file);
  await getRepo().raw.putMany("screenshots", [{ id, trade_id: null, data_url }]);
  return id;
}

/** Returns an <img>-ready URL for a stored screenshot id. Kept under its old name so callers are unchanged. */
export async function getSignedScreenshotUrl(id: string): Promise<string | null> {
  const rec = await getRepo().raw.get<{ data_url: string }>("screenshots", id);
  return rec?.data_url ?? null;
}
