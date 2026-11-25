/* ==========================================================================
   timer-decorator.ts — installs the video-engine additions that belong with
   the TimerApp bootstrap, after the engine has bound by id.

   This pass owns:
     · the interactive-session disclaimer surface (shown even for owned clips)
     · the upper-frame "video restarts soon" notice for anecdote breaks
   ========================================================================== */

/* ==========================================================================
   timer-decorator.ts — additive hooks for the Video engine (TimerApp side).

   TimerApp already bootstraps the engine as a DOM module. This module is
   imported AFTER the engine boots and wires the same additive behavior that
   engine-decorator.ts describes, but through the React/JS boundary the timer
   app actually owns.
   ========================================================================== */

import {
  currentDisclaimer,
  getInteractiveDisclaimer,
  setInteractiveDisclaimer,
  installAnecdoteRestartNotice,
  onBreakPanelReady
} from './engine-decorator';

export const videoDisclaimer = {
  current: currentDisclaimer,
  get: getInteractiveDisclaimer,
  set: setInteractiveDisclaimer
};

export function installTimerDecorations(host: HTMLElement): void {
  // Additive and fail-open: if the stage markup is not present yet, nothing
  // breaks — the restart notice installer creates its own element lazily.
  installAnecdoteRestartNotice();
  
  // Install break card customizer (background templates & motion effects)
  // This is called after the break panel is built
  onBreakPanelReady();
}
