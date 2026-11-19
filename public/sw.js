/* ============================================================
   lnr Studio — service worker

   The problem this solves: an installed PWA keeps its own copy of
   the app. If the cache name never changes, a new deploy is never
   picked up and the installed app serves the previous build
   indefinitely — the classic "I pushed but the app looks old".

   Rules here:
     · CACHE_VERSION is bumped on every release. Changing it makes
       the browser install a NEW worker, which deletes every older
       cache in `activate`. That is the whole update mechanism.
     · Navigations are network-first, so a fresh deploy wins; the
       cache is only a fallback when offline.
     · Hashed build assets are cache-first (they are immutable —
       a new build produces new filenames).
     · The page is told when a new worker takes over, so it can
       reload once and show the new build immediately.
   ============================================================ */

const CACHE_VERSION = 'v25';
const CACHE_NAME = `lnr-studio-${CACHE_VERSION}`;

/* Only the shell is precached. Build assets are hashed and picked up
   on first use, so precaching them here would pin stale filenames. */
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // A single missing icon must not fail the whole install.
      Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache skip', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[sw] dropping old cache', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        // Tell every open tab that a new build is in control.
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
        })
      )
  );
});

/* The page can ask a waiting worker to take over immediately. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHashedAsset(url) {
  return /\/assets\/.+\.(js|css|woff2?|png|jpe?g|svg|webp)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // never touch third-party or live API requests

  /* Navigations: network first, cache as the offline fallback.
     This is what makes a new deploy appear on the next load. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  /* Hashed build assets are immutable: serve from cache, fill on miss. */
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  /* Everything else: network first, fall back to cache. */
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
      )
  );
});
