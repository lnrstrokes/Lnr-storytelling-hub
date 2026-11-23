/**
 * stage-labels.ts — Pro: rename the category that appears on the stage.
 *
 * WHY THIS EXISTS
 * ---------------
 * The stage prints the name of a built-in pack ("World History / Trivia") in
 * two places: the frame pill at the top left and the kicker above the question.
 * A creator running a niche pack — Donghua, a specific novel, a church series —
 * is stuck with the shipped name, so viewers never learn what the round is
 * actually about.
 *
 * WHY IT IS STORED SEPARATELY
 * ---------------------------
 * The engine's own settings blob (`lnr_timer_v2`) is written and reloaded by
 * the licence gate. These labels are cosmetic and must never trigger a reload
 * or touch a broadcast, so they live in their own key and are applied by
 * `src/timer/segment-label.ts` at the DOM layer.
 *
 * Keys are the shipped names; values are what should replace them. An empty
 * value means "use the shipped name", which is why clearing a field restores
 * the default.
 */

/** The shipped segment names, in the order the fields are shown. */
export const LABEL_DEFAULTS = ['Bible / Faith', 'World History / Trivia'] as const;

/** Long enough for a niche, short enough not to wreck the stage layout. */
export const LABEL_MAX_LENGTH = 40;

const STORAGE_KEY = 'lnr_stage_labels_v1';

/** Fired after a write so the stage can re-apply without a reload. */
export const LABELS_CHANGED = 'lnr:labels-changed';

function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  /* One line only: a newline would break the frame's flex row. */
  return value.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX_LENGTH);
}

/** Overrides only — shipped names are never stored. */
export function readLabelOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    LABEL_DEFAULTS.forEach((key) => {
      const value = clean(parsed[key]);
      if (value) out[key] = value;
    });
    return out;
  } catch {
    return {};
  }
}

/** Empty value clears the override, restoring the shipped name. */
export function writeLabelOverride(key: string, value: string): void {
  const next = readLabelOverrides();
  const cleaned = clean(value);
  if (cleaned) next[key] = cleaned;
  else delete next[key];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode: the stage keeps the shipped name */
  }

  try {
    window.dispatchEvent(new CustomEvent(LABELS_CHANGED));
  } catch {
    /* no window (tests) */
  }
}
