// Offline helper for the installed app. It only keeps copies of the app's own files (screens, styles, icons)
// so the app opens quickly and shows a clear message without internet. It never stores church records:
// requests to the database and to other sites always go straight to the network.
const CACHE = "iddi-secretaria-v1";

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // database, Google sign-in, other sites: never touched
  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith(".mp4") || req.headers.has("range")) return;   // videos stream straight from the network
  // Newest version first; the saved copy is used only when there is no connection.
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 200 && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then((hit) => hit || caches.match("/index.html"))));
});
