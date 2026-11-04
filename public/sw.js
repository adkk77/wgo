// WGO app shell: open instantly and work offline with the last news; news itself always comes fresh from the network.
const CACHE = 'wgo-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/countries-50m.json', '/places.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // network first (fresh news and fresh app), fall back to the saved copy when offline
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok && !u.pathname.startsWith('/healthz')) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
  } else if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return n; })));
  }
});
