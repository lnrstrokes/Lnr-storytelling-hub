/* ==========================================================================
   rotationDriver.ts — switch engines with no blank frame, no App.tsx edit
   --------------------------------------------------------------------------
   THE PROBLEM

   App.tsx owns the `engine` state ('quiz' | 'video'). Switching it from
   outside would normally mean editing that 3,489-line file. We do not want to.

   The app does expose the switch through its own UI: the Studio Gateway has a
   "START LIVE QUIZ" button and a "LAUNCH VIDEO STREAM LOOP" button, and the
   stage has a "Hub" button that returns to the gateway. So the switch CAN be
   driven by clicking those buttons.

   But clicking them unmounts the stage and paints the gateway for a moment.
   On a screencast that is a visible flash — exactly what we must avoid.

   THE FIX: A SNAPSHOT CURTAIN

   Before touching anything, we clone the live stage frame into an overlay that
   sits exactly on top of it, pixel for pixel. The clone is a static copy, so it
   keeps showing the old content while the real app tears down and rebuilds
   underneath. Only once the new engine has painted do we fade the curtain out.

   The viewer therefore sees: old content -> cross-fade -> new content. The
   gateway is never visible, and the frame is never empty.

   FOUR THINGS THAT ARE EASY TO GET WRONG (all four were, and are now fixed):

   1. The Hub button is rendered inside `{!panelHidden && ...}`. In the normal
      clean-broadcast state the panel IS hidden, so Hub is not in the DOM and
      a naive driver silently does nothing. We reveal the controls first, then
      re-hide them afterwards so the streamer's clean view is restored.

   2. The Hide Controls button is ICON-ONLY — an EyeOff glyph with a title
      attribute and no text. Matching it by text never works; it must be found
      by its title.

   3. Waiting for ".stage-frame exists" is not enough — the OLD frame is still
      mounted at that moment, so the wait returns instantly and the curtain
      drops before the new engine has painted. We wait for the frame to
      disappear first, then reappear.

   4. A fixed sleep after clicking is not enough. React may not have committed
      the panel by the time we look for Hub, which made the first switch after
      hiding the panel fail intermittently. We poll for the element instead.
   ========================================================================== */

import type { EngineId } from './engineRotation';

const CURTAIN_ID = 'lnr-rotation-curtain';

/** Find the live stage frame, if the stage is currently on screen. */
function stageFrame(): HTMLElement | null {
  return document.querySelector('.stage-frame');
}

/** Find a button by its visible text. */
function buttonByText(re: RegExp): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('button'));
  return (buttons.find(b => re.test((b.textContent || '').trim())) as HTMLButtonElement) || null;
}

/** Find a button by its title attribute — needed for icon-only buttons. */
function buttonByTitle(re: RegExp): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('button'));
  return (
    (buttons.find(b => re.test(b.getAttribute('title') || '')) as HTMLButtonElement) || null
  );
}

/**
 * Poll until `find()` returns something, or the timeout expires.
 *
 * A fixed sleep is not safe here: React commits on its own schedule, and a
 * delay that is generous on a fast laptop is too short on a phone that is
 * simultaneously encoding a stream. Polling is the only reliable option.
 */
function waitFor<T>(find: () => T | null, timeoutMs = 1500): Promise<T | null> {
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const found = find();
      if (found) return resolve(found);
      if (Date.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

/** True when the studio control panel is hidden (clean broadcast view). */
function isPanelHidden(): boolean {
  return document.querySelector('.floating-show-panel-btn') !== null;
}

/**
 * Make sure the Hub button is reachable. Returns true if we had to reveal the
 * panel, so the caller knows to hide it again afterwards.
 */
async function ensureControlsVisible(): Promise<boolean> {
  if (!isPanelHidden()) return false;
  const show = document.querySelector('.floating-show-panel-btn') as HTMLButtonElement | null;
  if (!show) return false;
  show.click();
  // Wait for the panel to actually commit, rather than guessing a delay.
  await waitFor(() => buttonByText(/^Hub$/i));
  return true;
}

/**
 * Put the panel back the way the streamer had it.
 *
 * The Hide Controls button is icon-only, so it has no text to match on — we
 * look it up by its title attribute, with a text match as a fallback in case
 * the markup ever gains a label.
 */
function restorePanel(hidden: boolean) {
  if (!hidden) return;
  const hide =
    buttonByTitle(/Hide Controls/i) ||
    buttonByTitle(/Clean Screen Cast/i) ||
    buttonByText(/Hide Panel/i);
  if (hide) hide.click();
}

/**
 * Freeze the current stage into an overlay.
 * Returns the overlay element, or null if there is no stage to freeze.
 */
function raiseCurtain(): HTMLElement | null {
  const frame = stageFrame();
  if (!frame) return null;

  const rect = frame.getBoundingClientRect();

  const curtain = document.createElement('div');
  curtain.id = CURTAIN_ID;
  curtain.setAttribute('aria-hidden', 'true');
  Object.assign(curtain.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '9999',
    pointerEvents: 'none',
    overflow: 'hidden',
    // Match the quiz background so any uncovered sliver is content-coloured,
    // never black.
    background: '#060a10',
    opacity: '1',
    transition: 'opacity 600ms ease-in-out'
  });

  // Clone the frame's contents. A deep clone keeps the rendered layout, text
  // and images; it does not keep video playback, so for the video engine we
  // also copy the current frame of the <video> into a canvas.
  const clone = frame.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0'
  });

  // Replace any <video> in the clone with a still of its current frame.
  const liveVideo = frame.querySelector('video');
  const clonedVideo = clone.querySelector('video');
  if (liveVideo && clonedVideo && liveVideo.videoWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = liveVideo.videoWidth;
      canvas.height = liveVideo.videoHeight;
      canvas.getContext('2d')?.drawImage(liveVideo, 0, 0);
      Object.assign(canvas.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
      });
      clonedVideo.replaceWith(canvas);
    } catch {
      /* cross-origin video: leave the element, the curtain still covers it */
    }
  }

  curtain.appendChild(clone);
  document.body.appendChild(curtain);
  return curtain;
}

/** Fade the curtain out and remove it. */
function dropCurtain(curtain: HTMLElement | null, fadeMs: number) {
  if (!curtain) return;
  requestAnimationFrame(() => {
    curtain.style.opacity = '0';
  });
  window.setTimeout(() => curtain.remove(), fadeMs + 120);
}

/**
 * Wait for the stage to be torn down and rebuilt.
 *
 * Waiting only for "a stage frame exists" is wrong: the OLD frame is still
 * mounted at that instant, so the promise resolves immediately and the curtain
 * drops before the new engine has painted. We therefore wait for the frame to
 * go away first, then come back.
 */
function waitForRepaint(timeoutMs = 5000): Promise<boolean> {
  return new Promise(resolve => {
    const started = Date.now();
    let sawGap = false;

    const check = () => {
      const present = stageFrame() !== null;

      if (!present) {
        sawGap = true;
      } else if (sawGap) {
        // Gone and back: this is the new engine.
        return resolve(true);
      }

      if (Date.now() - started > timeoutMs) {
        // Timed out. If a frame is present at all, treat it as good enough —
        // better to reveal something than to leave a curtain up forever.
        return resolve(present);
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Switch to `target` engine, keeping the frame visually continuous.
 *
 * Returns true if the switch was performed. If the app is not on the stage
 * (e.g. the user is in the gateway), it returns false and does nothing — we
 * never hijack the UI while the streamer is setting things up.
 */
export async function switchEngine(target: EngineId, fadeMs = 600): Promise<boolean> {
  const frame = stageFrame();
  if (!frame) return false; // not on the stage — leave the user alone

  // Which engine are we on now? The stage title tells us. Match on
  // 'BROADCAST LOOP' rather than 'BROADCAST', so a quiz category that happens
  // to contain the word "video" is not misread as the video engine.
  const title = document.querySelector('.stage-title-wrap h2')?.textContent || '';
  const current: EngineId = /BROADCAST LOOP/i.test(title) ? 'video' : 'quiz';
  if (current === target) return true;

  // 1. Freeze what the viewer currently sees.
  const curtain = raiseCurtain();

  // 2. The Hub button only exists when the control panel is visible.
  const revealed = await ensureControlsVisible();

  const hub = buttonByText(/^Hub$/i);
  if (!hub) {
    restorePanel(revealed);
    dropCurtain(curtain, fadeMs);
    return false;
  }
  hub.click();

  // 3. Wait for the gateway to commit, then launch the target engine.
  const launch = await waitFor(() =>
    target === 'quiz'
      ? buttonByText(/START LIVE QUIZ/i)
      : buttonByText(/LAUNCH VIDEO STREAM LOOP/i)
  );

  if (!launch) {
    restorePanel(revealed);
    dropCurtain(curtain, fadeMs);
    return false;
  }
  launch.click();

  // 4. Wait for the new stage to actually paint, then reveal it.
  await waitForRepaint();
  // One extra frame so the new content is definitely composited.
  await new Promise(r => requestAnimationFrame(() => r(null)));

  // 5. Put the streamer's clean view back the way it was.
  restorePanel(revealed);

  dropCurtain(curtain, fadeMs);
  return true;
}

/** True when the stage is on screen (so rotation is meaningful). */
export function isOnStage(): boolean {
  return stageFrame() !== null;
}
