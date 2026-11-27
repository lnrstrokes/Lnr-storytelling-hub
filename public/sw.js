/* ============================================================
   lnr Studio - service worker

   The problem this solves: an installed PWA keeps its own copy of
   the app. If the cache name never changes, a new deploy is never
   picked up and the installed app serves the previous build
   indefinitely - the classic "I pushed but the app looks old".

   Rules here:
     - CACHE_VERSION is stamped at build time by `swVersionPlugin` in
       vite.config.ts from a hash of the built bundle. Changing it makes
       the browser install a NEW worker, which deletes every older
       cache in `activate`. That is the whole update mechanism, and it
       now happens on every deploy without anyone remembering to bump
       a number. The literal below is only the dev-server fallback.
     - Navigations are network-first, so a fresh deploy wins; the
       cache is only a fallback when offline.
     - Hashed build assets are cache-first (they are immutable -
       a new build produces new filenames).
     - The page is told when a new worker takes over, so it can
       reload once and show the new build immediately.
   ============================================================ */

const CACHE_VERSION = 'v36';
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
          precache(cache, url).catch((err) => console.warn('[sw] precache skip', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* Precache one URL, never trusting the HTTP cache for it.
   Why this matters: `cache.add(url)` is a plain fetch, so it honours the
   browser's HTTP cache. The one URL that hurts is '/', the app shell: on a
   fresh install straight after a deploy, '/' could be answered from a
   disk-cached copy of the PREVIOUS index.html, which names a bundle the current
   deployment has already purged. That stale document then sat inside the NEW
   cache name, so `activate` had nothing to delete and the freshly installed app
   booted into a bundle 404 (white screen). Fetching with `cache: 'no-store'`
   guarantees the shell stored under a version belongs to that same version. */
async function precache(cache, url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!response || !response.ok) throw new Error('precache ' + url + ' -> ' + (response && response.status));
  await cache.put(url, response);
}

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

/* The page can ask a waiting worker to take over immediately, or ask which
   build is live. */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /* The settings page shows the live build so an operator can quote it when the
     installed app "still looks old" - the version only changes when the bundle
     does, which is exactly the question being asked. */
  if (data.type === 'GET_VERSION') {
    const reply = (client) => {
      if (client && typeof client.postMessage === 'function') {
        client.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
      }
    };
    if (event.source) reply(event.source);
    else self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach(reply));
  }
});

/* ONLY Vite's fingerprinted output ("index-Kho1UJhI.js") is immutable. The
   studio's own media lives under /assets/aistudio/ with hand-written names, so
   matching the whole directory would pin a replaced clip in the cache forever. */
function isHashedAsset(url) {
  return /\/assets\/[^/]*-[A-Za-z0-9_]{8}\.(js|css|woff2?|png|jpe?g|svg|webp)$/i.test(url.pathname);
}

/* The offline fallback for a navigation.
   A cached document is only worth serving if the bundle it names still exists.
   An installed copy can hold an index.html from an OLDER deploy while its
   hashed chunks were purged by that deploy, and serving it boots the app into
   a bundle 404 - a white screen, which is the worst possible outcome on a
   livestream. So: read the cached HTML, find its fingerprinted entry script,
   and confirm that file is reachable. If anything is uncertain we prefer the
   precached shell over a document that cannot boot. */
async function offlineDocument(req) {
  const cached = await caches.match(req);
  if (cached) {
    try {
      const html = await cached.clone().text();
      const entry = html.match(/\/assets\/[^"']*-[A-Za-z0-9_]{8}\.js/);
      /* No entry script at all means this is not the app shell - do not guess. */
      if (entry) {
        const probe = await caches.match(entry[0]);
        if (probe) return cached;
        /* Not in the cache: ask the network. A deploy that still publishes it
           is fine; a 404 means the document outlived its assets. */
        try {
          const live = await fetch(entry[0], { method: 'GET', cache: 'no-store' });
          if (live && live.ok) return cached;
        } catch (err) {
          /* Offline and the bundle is not cached: the document cannot boot. */
        }
      } else {
        return cached;
      }
    } catch (err) {
      /* Unreadable body - treat as unusable rather than risking a white screen. */
    }
  }
  return (await caches.match('/', { cacheName: CACHE_NAME })) || cached || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // never touch third-party or live API requests

  /* Media range requests must reach the network untouched. A cached 200 reply
     to a Range request breaks seeking in <video>/<audio>, and the studio's
     looped clips are exactly that. */
  if (req.headers.has('range')) return;

  /* Navigations: network first, cache as the offline fallback.
     This is what makes a new deploy appear on the next load.

     `cache: 'no-store'` matters more than it looks. `fetch(req)` honours the
     browser's HTTP cache, so a navigation could be answered from a disk-cached
     copy of index.html even though this handler is "network first". That HTML
     names the PREVIOUS deploy's hashed bundle (index-OLD.js); `activate` has
     just deleted the old cache, and the new deployment no longer publishes
     that filename - so the installed app would boot into a 404 and show a
     white screen. Bypassing the HTTP cache for the document guarantees the
     HTML and the bundle it names come from the same deploy. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => offlineDocument(req))
    );
    return;
  }

  /* Hashed build assets are immutable - but ONLY within a deploy. An installed
     copy can ask for a filename from an older deploy that no longer exists
     (stale HTML + purged assets). A 404 there is fatal to boot, so a miss is
     answered by the network and the failure is surfaced rather than cached. */
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          } else if (response && response.status === 404) {
            /* The document outlived its assets: force the page to reload so it
               re-fetches an index.html that matches the live deploy. */
            self.clients.matchAll({ type: 'window' }).then((clients) => {
              clients.forEach((client) => client.postMessage({ type: 'STALE_ASSET', url: url.pathname }));
            });
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

/* Installed copies run for days without a navigation, so the browser may only
   notice a new deploy when it feels like it. The page polls `registration
   .update()` itself (see public/sw-register.js), and this is the belt to that
   braces: while the app stays open, check for a new worker periodically so an
   operator who never closes the studio is still moved onto the current build. */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CHECK_UPDATE') return;
  self.registration.update().catch(() => {});
});
