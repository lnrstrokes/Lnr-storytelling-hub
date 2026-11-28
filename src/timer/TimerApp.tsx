import { useEffect, useRef } from 'react';
const Analytics = () => null;
import timerMarkup from './timer.html?raw';
import './timer.css';
import './offer.css';
import './breaks.css';
// Long anecdote text: its own scrolling window on the break card, so a story
// that runs past the stage is still read to the end. Loaded after breaks.css.
import './break-card.css';
import { initLibrary } from './player-library.ts';
import { loadBuiltInBanks } from './built-in-banks.ts';
import { loadStoryLibrary } from './story-library.ts';
import './demo-content.ts';
// Speech normalization: publishes window.LNR_SPEECH, which the engine uses to
// read numbers, verse references and dates as words. Must load before the
// engine, which captures the reference at boot.
import './speech.js';
// Football pronunciation layer: sits in front of speech.js and fixes names,
// shirt numbers and age grades ("#2" -> "jersey number two", "Under 17/18"
// -> "Under seventeen, Under eighteen"). Loaded before the engine, which
// captures window.LNR_SPEECH at boot.
import './speech-football.js';
import { installProGate } from './pro-gate.ts';
import { installVideoBreaks } from './video-breaks.ts';
// Editable video titles: publishes window.LNR_CLIP_TITLES for the engine's
// clip list. Must run before the engine boots.
import { publishClipTitles } from './clip-title-store.ts';
import { installVideoSetup } from './video-setup.ts';
import { installTimerDecorations, videoDisclaimer } from './timer-decorator';
// Break-card customizer (background templates & motion effects). Imported
// statically: the app ships as an ESM bundle where `require` is undefined, so
// the old dynamic require() threw and the customizer never installed.
import { onBreakPanelReady } from './engine-decorator';
import { installBreakVoice } from './break-voice';
import { installAdminKeys } from './admin-keys.ts';
// Free tier: 5 hours of airtime per day. Pro is unlimited. Enforced outside
// the engine, against the stage class the engine already sets.
import { installAirtimeLimit } from './airtime-limit.ts';
// Install + streaming-route notice. Additive: injects its own markup, so
// deleting these two lines removes every trace of it.
import { initInstallNotice } from './install-notice.ts';
import { initReachOut } from './reach-out.ts';
// Pro: lets a creator replace the pack name read on the stage with their own
// niche. Applied at the DOM layer, so the engine is untouched.
import { installSegmentLabels } from './segment-label.ts';
// Voice: the reader uses this device's own choice and keeps it, whatever the
// text says. No screen content can switch the voice or its language.
import { installVoiceLanguages } from './voice-language.ts';
// Text-to-speech is optional: uploaded narration and prerecorded clips need no
// voice at all, and the panels now say so. Words only, no engine state.
import { installVoiceOptional } from './voice-optional.ts';
// Keep the phone awake while a block is on the stage, so a broadcast is not
// interrupted by the lock screen. Fail-open, and only during a session.
import { installSessionKeepAwake } from './session-keepawake.ts';
// "Which build is this?" - the service worker's stamped version in Settings.
import { installBuildTag } from './build-tag.ts';
// Quiz pack: a Remove button so a fresh JSON pack can be loaded (Free and Pro).
import { installQuizPackReset } from './quiz-pack-reset.ts';
// Legacy addresses: a studio saved before the rename still printed the old
// project host under "Run your own stream". Migrated before the engine boots.
import { installLegacySiteFix } from './legacy-site.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    LNR_TRACK?: (eventName: string, params?: Record<string, unknown>) => void;
    LNR_DEBUG?: unknown;
    /** Set by index.html when this browser must not report to analytics. */
    __LNR_ANALYTICS_OFF__?: boolean;
  }
}

function initAnalytics() {
  /* The operator's own devices are excluded: index.html decides this before
     gtag.js loads, so no page_view or realtime hit is ever sent from here.
     The tracker becomes a no-op rather than a second, unlabelled source. */
  if (window.__LNR_ANALYTICS_OFF__) {
    window.LNR_TRACK = () => {};
    return;
  }
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

    // Existing video-upload success surface (user_type = free/pro from current tier).
    // We only tag the existing "upload succeeded" path; we do not add any new upload UI.
    const trackVideoUpload = (user_type: 'free' | 'pro') => {
      try {
        window.LNR_TRACK?.('video_upload', { user_type });
      } catch {}
    };

    // Existing quiz-and-anecdote toggle surface (#sermonAnecdoteToggle).
    // This is the only existing quiz-loop toggle in the app; we track its changes.
    const trackQuizLoopToggle = (on: boolean) => {
      try {
        window.LNR_TRACK?.('quiz_loop_toggle', { on: on ? 'on' : 'off' });
      } catch {}
    };
    window.addEventListener('appinstalled', onInstalled);

    host.innerHTML = timerMarkup;
    document.title = 'LNR Storytelling Hub - Timer';

    // Installed BEFORE the engine boots: the gate listens on `document` in the
    // capture phase, so it always sees a gated control's event first.
    installProGate(host);
    publishClipTitles();
    installVideoBreaks(host);
    
    // Install break card customizer (background templates & motion effects)
    // Called after a short delay to ensure the break panel is fully built.
    const setupCustomizer = () => {
      try {
        onBreakPanelReady();
      } catch (e) {
        // Fail silently - customizer is optional
      }
    };
    setTimeout(setupCustomizer, 100);

    // Existing quiz-and-anecdote toggle: the only quiz-loop toggle in the app.
    const anecdoteToggle = host.querySelector<HTMLInputElement>('#sermonAnecdoteToggle');
    if (anecdoteToggle) {
      trackQuizLoopToggle(anecdoteToggle.checked);
      anecdoteToggle.addEventListener('change', () => {
        trackQuizLoopToggle(anecdoteToggle.checked);
      });
    }

    // Upgrade / Selar / Jotform surfaces that already live in the timer markup.
    //
    // The upgrade buttons are deliberately NOT tracked here any more. This file
    // used to attach a third listener that fired `selar_open` + `upgrade_click`
    // on top of analytics-entry.ts and engine.js, so one Pro click produced
    // three or four events. openProCheckout() in engine.js is now the single
    // owner of upgrade_click / checkout_start, and pro/license.ts owns purchase.
    const trackJotformOpen = () => {
      try {
        window.LNR_TRACK?.('jotform_open');
      } catch {}
    };

    // Existing "Send Pre-filled Email" / details-form surface opens a mailto to the
    // studio contact address. That is the existing details-form flow; track it there.
    const contactFormBtn = host.querySelector<HTMLElement>('#contactFormBtn');
    if (contactFormBtn) {
      contactFormBtn.addEventListener('click', () => {
        trackJotformOpen();
      });
    }

    installVideoSetup(host);
    installTimerDecorations(host);
    installBreakVoice(host);
    installAdminKeys(host);
    installAirtimeLimit(host);
    initInstallNotice();
    initReachOut();
    installSegmentLabels(host);
    installVoiceLanguages(host);
    installVoiceOptional(host);
    installSessionKeepAwake(host);
    installBuildTag(host);
    installQuizPackReset(host);
    installLegacySiteFix();

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
