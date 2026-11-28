/* Non-upgrade click analytics.
 *
 * This was an inline module in index.html; externalising it keeps the page free
 * of inline script so a strict CSP can be enforced. It only reads button ids
 * and never sends emails, licence keys, names or file contents.
 *
 * WHY THIS FILE NO LONGER REPORTS `upgrade_click`
 *
 * It used to. So did engine.js (twice) and TimerApp.tsx (a third time), and all
 * of them fired on the same click. Worse, two of the three buttons involved are
 * not upgrades at all: "Start free" opens the studio and "Current Plan" is a
 * no-op. The result was that every new visitor taking the most obvious action
 * on the page was logged as a warm upgrade lead — `upgrade_click` came out
 * equal to `first_visit`, which is why the funnel read as a 97.5% click rate.
 *
 * `upgrade_click` now has exactly one owner: openProCheckout() in engine.js,
 * which is the only code that actually leaves for the checkout. This file owns
 * the two non-upgrade events and nothing else.
 */
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

    /* "Start free" — the primary call to action on the landing page. It opens
       the studio; it is not an upgrade and must not be counted as one. */
    if (target.closest('#homeGoStudioBtn')) {
      track('studio_start', { location: 'home_start_studio' });
      return;
    }

    /* "Current Plan" on the pricing card — informational, no navigation. */
    if (target.closest('#pricingFreeBtn')) {
      track('plan_current_click', { location: 'pricing_free_btn' });
    }
  });
})();
