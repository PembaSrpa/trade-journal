/* Offline support for the web build. Best-effort: the Android app bundles everything and doesn't use this. */
const CACHE = "journal-v1";
const ROUTES = ["/", "/overview", "/journal", "/journal/new", "/journal/trade", "/journal/trade/edit", "/notebook", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const assets = new Set(["/manifest.json", "/icon-192.png", "/icon-512.png"]);
      await Promise.allSettled(
        ROUTES.map(async (url) => {
          const res = await fetch(url, { cache: "reload" });
          if (!res.ok) return;
          await cache.put(url, res.clone());
          const html = await res.text();
          for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
        })
      );
      await Promise.allSettled([...assets].map((a) => cache.add(a)));
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Pages and everything else: network-first so updates show up, cache as the offline fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        // Unknown page while offline: serve the app shell so client routing can take over.
        if (req.mode === "navigate") return (await caches.match("/overview")) || (await caches.match("/")) || Response.error();
        return Response.error();
      })
  );
});
