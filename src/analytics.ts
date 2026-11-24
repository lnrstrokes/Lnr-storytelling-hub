/* GA4 helper — single place for analytics, reused everywhere.
   index.html already loads the gtag snippet (G-4K18FJXFX6), so we do not
   add a second snippet or a second config call here. */

(function () {
  'use strict';

  const GA_MEASUREMENT_ID = 'G-4K18FJXFX6';

  function hasGtag() {
    return typeof window.gtag === 'function';
  }

  function isInternalTraffic() {
    if (typeof window === 'undefined' || !window.location) return false;
    return window.location.search.includes('me=1');
  }

  function storeInternalFlagOnce() {
    try {
      if (!localStorage.getItem('lnr_internal_traffic') && isInternalTraffic()) {
        localStorage.setItem('lnr_internal_traffic', '1');
      }
    } catch {}
  }

  function internalParam() {
    try {
      if (localStorage.getItem('lnr_internal_traffic') === '1') {
        return { traffic_type: 'internal' };
      }
    } catch {}
    return {};
  }

  function trackEvent(name: string, params?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    const p: Record<string, unknown> = Object.assign({}, internalParam(), params || {});
    // Privacy: never ship emails, licence keys, names or file contents.
    delete p.email;
    delete p.key;
    delete p.licenceKey;
    delete p.licenseKey;
    delete p.proKey;
    delete p.name;
    delete p.fileName;
    delete p.filename;
    delete p.file;
    delete p.src;
    delete p.fileNameRaw;
    delete p.nameRaw;
    try {
      if (hasGtag()) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        window.gtag!.apply(window.gtag, ['event', name, p]);
      } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: name, ...p });
      }
    } catch {}
  }

  // Persist the internal-traffic flag as early as possible.
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', storeInternalFlagOnce, { once: true });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      storeInternalFlagOnce();
    }
  }

  // Expose one helper for the rest of the app.
  if (typeof window !== 'undefined') {
    window.LNR_TRACK = (window.LNR_TRACK as undefined | ((name: string, params?: Record<string, unknown>) => void)) || trackEvent;
    // Back-compat: timer app already uses window.LNR_TRACK with 2 args.
    (window as { LNR_TRACK_EVENT?: typeof trackEvent }).LNR_TRACK_EVENT = trackEvent;
  }
})();
