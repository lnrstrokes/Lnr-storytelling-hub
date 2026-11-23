/**
 * segment-label.ts — Pro: put the creator's category on the stage.
 *
 * WHY THE DOM AND NOT THE ENGINE
 * ------------------------------
 * The name comes from a constant inside `engine.js` (`SEGMENTS`), read in about
 * eleven places — the frame pill, the question kicker, the milestone badge,
 * toasts and the session plan. Editing that 7,293-line file for a cosmetic
 * label would put a text feature one typo away from a broken broadcast.
 *
 * So the engine keeps writing what it always wrote, and this module replaces
 * the shipped name with the creator's own inside the two elements the viewer
 * actually reads. The " · Milestone" and " · Medium" suffixes the engine adds
 * are part of those strings, so the substitution keeps them intact:
 *
 *     World History / Trivia · Medium   ->   Donghua / Renegade Immortal · Medium
 *
 * The engine's own writes keep working, because the observer simply re-applies
 * after each one. A write that changes nothing is skipped, so it cannot loop.
 *
 * Pro only, checked on every pass, so a lapsed licence falls back to the
 * shipped name without a reload. Delete the import and the call in TimerApp.tsx
 * to remove the feature entirely.
 */

import { LABELS_CHANGED, readLabelOverrides } from '../stage-labels.ts';
import { getProState } from '../pro/license.ts';

/** The two viewer-facing surfaces: frame pill and question kicker. */
const TARGET_IDS = ['segLabel', 'qKicker'];

function applyTo(el: HTMLElement, overrides: Record<string, string>): void {
  const before = el.textContent || '';
  if (!before) return;

  let after = before;
  Object.keys(overrides).forEach((shipped) => {
    if (after.indexOf(shipped) === -1) return;
    /* split/join, not RegExp: a label may contain regex metacharacters. */
    after = after.split(shipped).join(overrides[shipped]);
  });

  if (after !== before) el.textContent = after;
}

export function installSegmentLabels(host: HTMLElement): void {
  const apply = (): void => {
    if (!getProState().active) return;
    const overrides = readLabelOverrides();
    if (!Object.keys(overrides).length) return;

    TARGET_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) applyTo(el, overrides);
    });
  };

  apply();

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(apply);
    TARGET_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  window.addEventListener(LABELS_CHANGED, apply);
  window.addEventListener('lnr:pro-changed', apply);

  /* The stage lives inside the mounted host; nothing else needs watching. */
  void host;
}
