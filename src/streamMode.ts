/* ==========================================================================
   streamMode.ts — keeps the control surfaces out of the broadcast
   --------------------------------------------------------------------------
   THE PROBLEM

   A screencast captures pixels. Anything on the page that is inside the
   captured rectangle is in the stream, so the reader bar and the rotation bar
   at the bottom of the app were going out to viewers along with the quiz.

   There is no way to "capture everything except this element" in the browser —
   getDisplayMedia grabs a whole surface. So the only honest fix is to not have
   the controls on the page while the stream is live.

   THE TENSION

   Hide them and the operator loses the Stop button. Show them and the audience
   sees it. Both cannot be true at once, so this module separates the two:

     PIXELS  — in stream mode both docks are removed from the page entirely
               (`display:none`), so there is nothing to capture.

     CONTROL — the operator's device still receives input, because input is not
               pixels. Keyboard shortcuts keep working while the dock is
               invisible, and on a phone an invisible tap zone in the very
               bottom-right corner summons the dock for eight seconds and then
               puts it away again by itself.

   WHAT THE OPERATOR CAN DO WHILE THE BUTTONS ARE INVISIBLE

     Space   pause / resume the reader (resumes from the exact word)
     Esc     stop the reader, and let the scene move on immediately
     T       toggle stream mode on or off
     Corner  tap the bottom-right corner twice (phone) to show the dock for 8s

   None of these paint anything on screen, so none of them can appear in the
   stream. The corner zone is fully transparent — it is a hit area, not a
   visible control.

   WHEN IT TURNS ITSELF ON

   Entering stream mode is automatic the moment the app starts its own screen
   cast, or when the operator hides the app's panel for a clean capture, since
   both are unambiguous "I am broadcasting now" signals. It is also a single
   tap away from the dock. Turning it OFF is always a keyboard press or a
   corner tap, never automatic — a control surface must never come back on air
   on its own.
   ========================================================================== */

import { voiceReader } from './voiceReader';
import { releaseHold } from './readerSync';

const ROOT_CLASS = 'lnr-stream-mode';
const CORNER_ID = 'lnr-stream-corner';
const REVEAL_MS = 8000;
const CORNER_PX = 64;

type Listener = (on: boolean) => void;

const listeners = new Set<Listener>();
let on = false;
let installed = false;
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** True when the control surfaces are hidden from the page. */
export function isStreamMode(): boolean {
  return on;
}

export function onStreamModeChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function apply() {
  const root = document.documentElement;
  if (on) root.classList.add(ROOT_CLASS);
  else root.classList.remove(ROOT_CLASS);
  for (const cb of listeners) cb(on);
}

/** Show the dock briefly, then put it back out of sight. */
function summon() {
  if (!on) return;
  const root = document.documentElement;
  root.classList.add('lnr-stream-reveal');
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    root.classList.remove('lnr-stream-reveal');
    revealTimer = null;
  }, REVEAL_MS);
}

export function setStreamMode(next: boolean) {
  if (on === next) return;
  on = next;
  if (!on && revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
    document.documentElement.classList.remove('lnr-stream-reveal');
  }
  apply();
  // Entering stream mode must also clear the app's own chrome, or the capture
  // is only half clean. Done after `apply()` so this module's state is already
  // consistent if the click synchronously re-renders.
  if (on) hideAppChrome();
}

export function toggleStreamMode() {
  setStreamMode(!on);
}

/* ------------------------------------------------- hiding the app's chrome */

/**
 * Hide the app's own control panel by pressing its own Hide Controls button.
 *
 * This is deliberately the app's mechanism rather than extra CSS: the button
 * sets `panelHidden`, and App.tsx then stops rendering the top pill bar, the
 * stage top bar and the transport controller entirely. Nothing is left for a
 * capture to find, and there are no dead selectors to rot when the markup
 * changes.
 *
 * `.floating-show-panel-btn` is NOT touched. It is the operator's tappable way
 * back, so it must survive — see the note in docks.css.
 *
 * The button is icon-only (an EyeOff glyph, matched by its title in App.tsx's
 * own markup), so it is found by title, with a text match as a fallback in case
 * it ever gains a label.
 */
function hideAppChrome() {
  if (document.querySelector('.floating-show-panel-btn')) return; // already hidden

  const buttons = Array.from(document.querySelectorAll('button'));
  const hide =
    (buttons.find(b => /Hide Controls/i.test(b.getAttribute('title') || '')) as
      | HTMLButtonElement
      | undefined) ||
    (buttons.find(b => /Hide Panel/i.test(b.getAttribute('title') || '')) as
      | HTMLButtonElement
      | undefined);

  if (hide) {
    hide.click();
    return;
  }

  // Not on the stage (operator is in the studio gateway): nothing to hide yet.
  // Auto-detection will press it as soon as the stage chrome exists.
}

/* --------------------------------------------------------------- shortcuts */

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

function onKeyDown(e: KeyboardEvent) {
  // Never steal a key from a field, or from a browser/modifier combination.
  if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === 'Escape') {
    // Stop the voice and let the scene move on at once. This is the one
    // control the operator cannot afford to be without, so it works whether
    // or not the dock is visible.
    e.preventDefault();
    voiceReader.stop();
    releaseHold('stopped');
    return;
  }

  if (e.key === ' ' || e.code === 'Space') {
    if (voiceReader.getState() === 'playing') {
      e.preventDefault();
      voiceReader.pause();
      releaseHold('paused');
    } else if (voiceReader.getState() === 'paused') {
      e.preventDefault();
      voiceReader.resume();
    }
    return;
  }

  if (e.key === 't' || e.key === 'T') {
    if (on) {
      e.preventDefault();
      setStreamMode(false);
      // Putting the docks back also has to put the app's panel back, or the
      // operator would regain two bars and still have no studio controls.
      const restore = document.querySelector(
        '.floating-show-panel-btn'
      ) as HTMLButtonElement | null;
      if (restore) restore.click();
    }
  }
}

/* ------------------------------------------------------------- tap hotspot */

/**
 * A transparent 64px square in the bottom-right corner. It has no background,
 * no border and no text, so it contributes nothing visible to a capture; it
 * only exists so a phone (no keyboard) can still reach the controls.
 */
function installCorner() {
  if (document.getElementById(CORNER_ID)) return;

  const zone = document.createElement('button');
  zone.id = CORNER_ID;
  zone.type = 'button';
  zone.setAttribute('aria-label', 'Show broadcast controls');
  zone.tabIndex = -1;
  Object.assign(zone.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: `${CORNER_PX}px`,
    height: `${CORNER_PX}px`,
    padding: '0',
    margin: '0',
    border: '0',
    background: 'transparent',
    opacity: '0',
    zIndex: '9998',
    cursor: 'default',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation'
  });

  let lastTap = 0;
  zone.addEventListener('click', () => {
    const now = Date.now();
    // Two taps within 600ms, so a stray tap while scrolling cannot summon it.
    if (now - lastTap < 600) summon();
    lastTap = now;
  });

  document.body.appendChild(zone);
}

/* ------------------------------------------------------- auto-detection */

/**
 * Turn stream mode on when the app itself signals it is broadcasting.
 *
 * `.cast-active-pill` is rendered by App.tsx only while a screen cast is live
 * (it is inside `{isCasting && ...}`), and `.floating-show-panel-btn` only
 * appears after the operator hides the panel for a clean capture. Either one is
 * proof enough that pixels are being sent somewhere.
 *
 * DETECTION IS A MUTATION OBSERVER, NOT A POLL. A poll leaves a window of up to
 * one interval — eight hundred milliseconds of live controls already captured
 * at the start of a stream. Observing the subtree fires on the very mutation
 * that inserts the pill, so the docks are gone in the same frame the cast
 * begins.
 *
 * A slow poll (~2s) still runs alongside it as a belt-and-braces check for the
 * one case a mutation cannot cover: the app was already casting when this
 * script loaded, so the pill exists before the observer starts.
 */
function startAutoDetect() {
  if (pollTimer) return;

  const check = () => {
    if (on) return; // never auto-exit; only the operator does that
    const broadcasting =
      document.querySelector('.cast-active-pill') !== null ||
      document.querySelector('.floating-show-panel-btn') !== null;
    if (broadcasting) setStreamMode(true);
  };

  // Instant path: react to the DOM changing, not to a clock.
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (on) return;
      check();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Fallback path for state that predates the observer.
  pollTimer = setInterval(check, 2000);
  check();
}

/** Install once, at startup. Safe to call repeatedly. */
export function installStreamMode(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('DOMContentLoaded', installCorner, { once: true });
  if (document.body) installCorner();
  startAutoDetect();
  apply();
}
