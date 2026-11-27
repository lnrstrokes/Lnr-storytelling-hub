/* Service-worker registration.
 *
 * Moved out of index.html so the page needs no inline script and can carry a
 * strict Content-Security-Policy.
 *
 * GETTING A NEW BUILD TO AN INSTALLED COPY
 * ----------------------------------------
 * An installed PWA is the hard case: it is usually opened from the home
 * screen, kept warm for days, and its worker is only re-checked when the
 * browser feels like it (in practice: on a navigation, and Chrome may throttle
 * that to once a day). A deploy can therefore sit unseen for hours, which is
 * the "I pushed but the app still looks old" report.
 *
 * This file closes that hole from the page side:
 *   1. an immediate registration.update() on load, so a cold start compares
 *      /sw.js with the network straight away instead of waiting for the
 *      browser's own schedule;
 *   2. a periodic update() while the app is open, and one more whenever the
 *      tab becomes visible again, which is exactly when someone re-opens the
 *      installed app;
 *   3. `updateViaCache: 'none'` so the worker script itself is never answered
 *      from the HTTP cache (vercel.json already sends max-age=0 for /sw.js,
 *      but a proxy or an older deploy could still revalidate lazily);
 *   4. a new worker is activated immediately (SKIP_WAITING) and the page
 *      reloads ONCE so the new build is on screen, not merely installed;
 *   5. the same for an installed copy that was still running an older worker
 *      when it opened.
 *
 * The worker stamps CACHE_VERSION from a hash of the built bundle
 * (swVersionPlugin in vite.config.ts), so a deploy that changes anything
 * produces a new worker and therefore a new cache; the template's literal is
 * never what an installed app ends up with.
 */
if ('serviceWorker' in navigator) {
  /* The update check interval while the app is open. Ten minutes is well under
     the half-hour-ish throttle browsers apply, so an operator who leaves the
     studio open still picks up a deploy before going live. */
  var UPDATE_EVERY_MS = 10 * 60 * 1000;
  var reg = null;
  var reloading = false;

  function activateWhenReady(worker) {
    if (!worker) return;
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      /* A worker is waiting and an older one is serving the page: take over. */
      worker.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none', scope: '/' })
      .then(function (registration) {
        reg = registration;
        console.log('lnr Studio PWA ServiceWorker active');

        registration.addEventListener('updatefound', function () {
          activateWhenReady(registration.installing);
        });

        /* A worker may already be waiting (installed while the app was closed,
           or by a previous page load that never reloaded). */
        if (registration.waiting) activateWhenReady(registration.waiting);

        /* (1) Compare with the network now. */
        registration.update().catch(function () {});

        /* (2) Keep checking while the app stays open, and again the moment it
           comes back to the foreground. */
        window.setInterval(function () {
          if (document.visibilityState === 'visible') {
            registration.update().catch(function () {});
          }
        }, UPDATE_EVERY_MS);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            registration.update().catch(function () {});
          }
        });
      })
      .catch(function (err) {
        console.warn('SW registration:', err);
      });

    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) {
        /* FIRST install, not an update: the worker has merely claimed a page
           that was never controlled. Reloading here would fight the first load. */
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    /* The worker reports a fingerprinted asset it could not resolve. That means
       this document was built by a different deploy than the one now live, so
       the page cannot finish booting. One reload asks for a matching HTML; the
       guard below stops a broken deploy from turning that into a reload loop. */
    navigator.serviceWorker.addEventListener('message', function (event) {
      var data = event.data || {};
      if (data.type !== 'STALE_ASSET') return;
      if (reloading) return;
      var KEY = 'lnr-stale-asset-reload';
      var last = 0;
      try { last = Number(window.sessionStorage.getItem(KEY) || 0); } catch (err) { last = 0; }
      /* One attempt per five minutes. A deploy that is genuinely missing its
         bundle would otherwise reload forever; this way it reloads once, and
         the operator sees a plain failed load instead of a flicker storm. */
      if (Date.now() - last < 5 * 60 * 1000) {
        console.error('[lnr] build asset missing and a reload was already tried:', data.url);
        return;
      }
      try { window.sessionStorage.setItem(KEY, String(Date.now())); } catch (err) { /* private mode */ }
      reloading = true;
      window.location.reload();
    });
  });
}
