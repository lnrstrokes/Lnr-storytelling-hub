/* GA4 bootstrap.
 *
 * This lived inline in index.html, which meant the site could not ship a
 * Content-Security-Policy without allowing every inline script. Moving it to
 * a same-origin file lets script-src stay at 'self' + googletagmanager.com.
 *
 * Never loaded on the operator's own devices: a registered owner device, or
 * any browser that has been opened once with ?me=1, sends nothing at all —
 * no page_view, no realtime hit. ?me=0 removes the opt-out again. The flag has
 * to be read here, before gtag.js loads, or the first page_view counts. */
(function () {
  try {
    if (/[?&]me=1(&|$)/.test(location.search)) localStorage.setItem('lnr_internal_traffic', '1');
    if (/[?&]me=0(&|$)/.test(location.search)) localStorage.removeItem('lnr_internal_traffic');
    window.__LNR_ANALYTICS_OFF__ =
      localStorage.getItem('lnr_internal_traffic') === '1' ||
      !!localStorage.getItem('lnr_owner_check_v1');
  } catch (e) {
    window.__LNR_ANALYTICS_OFF__ = false;
  }
  if (window.__LNR_ANALYTICS_OFF__) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-4K18FJXFX6';
  document.head.appendChild(tag);
  window.gtag('js', new Date());
  window.gtag('config', 'G-4K18FJXFX6');
})();
