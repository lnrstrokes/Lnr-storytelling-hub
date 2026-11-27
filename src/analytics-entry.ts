/* Upgrade-click analytics.
 *
 * This was an inline module in index.html; externalising it keeps the page free
 * of inline script so a strict CSP can be enforced. It only reads button ids
 * and never sends emails, licence keys, names or file contents. */
import './analytics';

(function () {
  function track(name: string, params?: Record<string, unknown>) {
    const fn = (window as unknown as {
      LNR_TRACK?: (name: string, params?: Record<string, unknown>) => void;
    }).LNR_TRACK;
    if (typeof fn === 'function') fn(name, params);
  }

  document.addEventListener('click', function (event) {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;

    const link = target.closest('#pricingProBtn, #pricingFreeBtn');
    if (link) {
      track('upgrade_click', {
        location: link.id === 'pricingProBtn' ? 'pricing_pro_btn' : 'pricing_free_btn',
      });
    }

    if (target.id === 'homeGoStudioBtn') {
      track('upgrade_click', { location: 'home_start_studio' });
    }
  });
})();
