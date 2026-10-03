import { Repo } from "./repo";
import { IndexedDbStore, MemoryStore } from "./store";

let repo: Repo | null = null;

/** The app's single data repository, backed by IndexedDB (falls back to memory if unavailable, e.g. private mode). */
export function getRepo(): Repo {
  if (!repo) {
    const hasIdb = typeof indexedDB !== "undefined";
    repo = new Repo(hasIdb ? new IndexedDbStore() : new MemoryStore());
    // Ask the browser not to evict our data under storage pressure.
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => undefined);
    }
  }
  return repo;
}
