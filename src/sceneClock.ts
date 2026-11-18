/* ==========================================================================
   sceneClock.ts — freezes the scene's one-second clock while the reader talks
   --------------------------------------------------------------------------
   WHY A GATE AND NOT AN APP EDIT

   App.tsx owns the scene clock. Its reveal phase is a `setInterval(..., 1000)`
   that decrements `revealSeconds` and, at zero, calls setQIndex to show the
   next question. There is no callback or event exposed for "the scene is about
   to advance", so there are only two ways to make it wait for the voice:

     (a) edit the 3,489-line component, or
     (b) hold its tick.

   (a) was rejected deliberately: the whole app is shipped to the operator as
   copy-paste file contents, and asking someone on a phone to re-paste a
   3,500-line file is how you lose a weekend to a stray character. (b) keeps the
   change to small, reviewable files.

   WHAT IS PATCHED, AND HOW NARROW IT IS

   `window.setInterval` is wrapped, but a callback is only ever considered if
   the delay is EXACTLY 1000ms — the scene clock's period. Everything else
   (500ms voice polling, 700ms screen scan, 2500ms security trap, any timeout)
   passes straight through untouched, and is passed through by reference so it
   cannot be altered.

   And even a 1000ms interval only stalls while a HOLD IS ACTIVE. Holds are
   created by exactly one place — ReaderDock, for the reveal scene — and they
   end the moment speech ends, the operator pauses, or a safety cap fires. With
   no hold, `holdsClock()` returns false on the first line and the wrapper is a
   single extra function call per second. Idle cost is effectively zero.

   THE ONE SIDE EFFECT, STATED PLAINLY

   The rotation scheduler also ticks every 1000ms. While a hold is active its
   tick is skipped too, which delays an engine switch by at most the length of
   one spoken answer. That is the behaviour you want anyway — an engine must not
   cross-fade in the middle of a sentence — but it is a side effect, so it is
   written down here rather than left to be discovered.

   The patch is installed once, at startup, before React renders.
   ========================================================================== */

import { holdsClock } from './readerSync';

/** The scene clock's period. Only this exact delay is gated. */
const SCENE_TICK_MS = 1000;

let installed = false;

/**
 * Install the gate. Safe to call more than once — later calls are no-ops, so a
 * hot reload cannot wrap the wrapper.
 */
export function installSceneClockGate(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalSetInterval = window.setInterval.bind(window);

  window.setInterval = function patchedSetInterval(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): number {
    // Not a function, or not the scene clock: hand it straight back, keeping
    // the original reference so nothing downstream can behave differently.
    if (typeof handler !== 'function' || timeout !== SCENE_TICK_MS) {
      return originalSetInterval(
        handler,
        timeout,
        ...(args as [])
      ) as unknown as number;
    }

    const gated: TimerHandler = function gatedTick(this: unknown) {
      // Ask the sync layer. `true` means the reader is still speaking, so this
      // tick is dropped: the countdown does not move and the scene cannot
      // advance. Every path inside holdsClock() either holds or releases.
      if (holdsClock('reveal')) return undefined;
      return (handler as (...a: unknown[]) => unknown).apply(this, args);
    };

    return originalSetInterval(gated, timeout) as unknown as number;
  } as typeof window.setInterval;
}
