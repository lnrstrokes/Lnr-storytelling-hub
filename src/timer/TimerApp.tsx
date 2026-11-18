import { useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import timerMarkup from './timer.html?raw';
import './timer.css';
import './offer.css';
import { initLibrary } from './player-library.ts';
import { loadBuiltInBanks } from './built-in-banks.ts';
import { loadStoryLibrary } from './story-library.ts';
import './demo-content.ts';
// Speech normalization: publishes window.LNR_SPEECH, which the engine uses to
// read numbers, verse references and dates as words. Must load before the
// engine, which captures the reference at boot.
import './speech.js';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    LNR_TRACK?: (eventName: string, params?: Record<string, unknown>) => void;
    LNR_DEBUG?: unknown;
  }
}

function initAnalytics() {
  const gaId = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();
  const isValidGa = /^G-[A-Z0-9]+$/i.test(gaId);
  const hasGoogleTag = !!document.querySelector('script[src*="googletagmanager.com/"]');

  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }

  if (isValidGa) {
    if (!hasGoogleTag && !document.getElementById('lnr-ga4-script')) {
      window.gtag('js', new Date());
      const s = document.createElement('script');
      s.id = 'lnr-ga4-script';
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(s);
    }
    window.gtag('config', gaId, { send_page_view: true });
  }

  window.LNR_TRACK = (eventName: string, params: Record<string, unknown> = {}) => {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      }
    } catch {
      // ignore analytics errors
    }
  };
}

/**
 * Mounts the timer edition.
 *
 * The engine is a self-contained DOM controller: it binds by id inside its own
 * markup, owns all session state on the device and drives the quiz -> story ->
 * player quiz -> video rotation. All built-in multi-hour banks, documentary
 * episodes and player cards hydrate on-device for unrestricted broadcasting.
 */
export default function TimerApp() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || host.dataset.mounted === '1') return;
    host.dataset.mounted = '1';

    initAnalytics();

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      window.LNR_TRACK?.('pwa_launch_installed', { display_mode: 'standalone' });
    }
    const onInstalled = () => {
      window.LNR_TRACK?.('pwa_install', { source: 'appinstalled' });
    };
    window.addEventListener('appinstalled', onInstalled);

    host.innerHTML = timerMarkup;
    document.title = 'lnr Studio — timer edition';

    let cancelled = false;
    void Promise.all([
      initLibrary().catch(() => {}),
      loadBuiltInBanks().catch(() => {}),
      loadStoryLibrary().catch(() => {}),
    ])
      .then(() => {
        if (cancelled) return;
        return import('./engine.js');
      })
      .then(() => {
        if (cancelled) return;
        if (!window.LNR_DEBUG) console.warn('[lnr timer] engine booted without its debug surface');
      });

    return () => {
      cancelled = true;
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return (
    <>
      <div ref={hostRef} className="lnr-timer-host" />
      <Analytics />
    </>
  );
}
