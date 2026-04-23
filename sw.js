/* Clean Latrine Dispatch — Service Worker
 * Caches the app shell for offline use. CSV data is NOT cached here;
 * the app handles CSV caching itself in localStorage so the logic
 * stays simple and predictable.
 */
const CACHE_NAME = 'clean-latrine-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept the Google Sheets CSV — always let the network handle it.
  // The app manages its own stale-data fallback via localStorage.
  if (url.hostname.includes('docs.google.com') ||
      url.hostname.includes('googleusercontent.com')) {
    return; // default network behavior
  }

  // Only handle GETs for app shell / same-origin assets.
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // Opportunistically cache successful same-origin responses.
          if (
            resp &&
            resp.status === 200 &&
            url.origin === self.location.origin
          ) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => {
          // Offline fallback — return index.html for navigations.
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
