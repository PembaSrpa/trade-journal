/**
 * Local data access. This file used to be an HTTP client for the FastAPI
 * backend; it now routes the same calls to the on-device repository, so
 * every page keeps working unchanged and the app needs no network at all.
 */
import { getRepo } from "@/lib/local";
import { saveTextFile } from "@/lib/local/files";

export const apiGet = <T,>(path: string): Promise<T> => getRepo().handle<T>("GET", path);
export const apiPost = <T,>(path: string, body: unknown): Promise<T> => getRepo().handle<T>("POST", path, body);
export const apiPatch = <T,>(path: string, body: unknown): Promise<T> => getRepo().handle<T>("PATCH", path, body);
export const apiDelete = <T,>(path: string): Promise<T> => getRepo().handle<T>("DELETE", path);

/** CSV export of the journal list (honors an optional &from=&to= range). */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const { text, mime } = await getRepo().handle<{ text: string; mime: string }>("GET", path);
  await saveTextFile(filename, text, mime);
}
