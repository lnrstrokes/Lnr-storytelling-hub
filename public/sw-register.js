/* Service-worker registration.
 *
 * Moved out of index.html so the page needs no inline script and can carry a
 * strict Content-Security-Policy.
 *
 * A new build is waiting: activate it, then reload once so the installed app
 * shows the newest version instead of a stale cache. A controllerchange on the
 * FIRST install is not an update — the worker has merely claimed a page that
 * was never controlled — so only a replacement reloads. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('lnr Studio PWA ServiceWorker active');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch((err) => {
      console.warn('SW registration:', err);
    });

    let hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
