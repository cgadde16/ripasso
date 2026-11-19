// Ripasso offline cache.
// The page itself: network first, so an update shows up on the next launch; cache when offline.
// Icons and manifest: cache first, refreshed in the background.
// Every fetch skips the browser's HTTP cache (GitHub Pages lets browsers keep files for 10 minutes,
// which otherwise made the phone cache an old copy).
const CACHE = "ripasso-v4";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === "navigate" || req.destination === "document";
  e.respondWith(caches.open(CACHE).then(async c => {
    const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
      if (r.ok) c.put(isPage ? "index.html" : req, r.clone());
      return r;
    });
    if (isPage) {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
      try {
        return await Promise.race([fresh, timeout]);
      } catch {
        fresh.catch(() => {});
        return (await c.match("index.html")) || (await c.match("./")) || Response.error();
      }
    }
    const hit = await c.match(req);
    if (hit) { fresh.catch(() => {}); return hit; }
    return fresh;
  }));
});
