/* ==========================================================================
   break-panel.ts — additive panel for quiz & anecdote breaks on uploaded video.
   --------------------------------------------------------------------------
   This module is intentionally additive. It does not replace the existing break
   panel; it exposes a typed builder the timer app can call.
   ========================================================================== */

export interface BreakPanelBuilder {
  buildPanel(root: HTMLElement): void;
}

const ANCHORS = ['videoBreakSetupNote', 'vbreakQuizBtn', 'vbreakAnecdoteBtn', 'vbreakNote'];

export function buildPanel(_root: HTMLElement): void {
  // The real panel markup already lives in timer.html. This builder is a
  // placeholder for any future host-side wiring that does not belong in the
  // engine.
}


export type { BreakItem, ClipBreaks, EngineDebug, QuizQ } from './break-parser';
export { readRecord, globalQuizSeconds } from './break-parser';
export { breaksFor } from './break-parser';
