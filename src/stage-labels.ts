/**
 * stage-labels.ts — Pro: rename the category that appears on the stage.
 *
 * WHY THIS EXISTS
 * ---------------
 * The stage prints a category name in two places: the frame pill at the top
 * left and the kicker above the question. A creator running a niche pack —
 * Donghua, a specific novel, a church series — is stuck with the shipped
 * name, so viewers never learn what the round is actually about.
 *
 * EVERY ENGINE, NOT JUST THE QUIZ
 * -------------------------------
 * The studio has four engines and each one prints its own category: the quiz
 * pack name, "Player Quiz", "Video engine", and the story archetype. A
 * creator's niche does not change because the rotation handed the stage to a
 * different engine, so every one of those strings can be replaced here. Each
 * entry in STAGE_LABEL_FIELDS is one editable field; `match` lists the shipped
 * strings that field replaces, so "Player Quiz · Clues" keeps its suffix and
 * only the category changes.
 *
 * WHY IT IS STORED SEPARATELY
 * ---------------------------
 * The engine's own settings blob (`lnr_timer_v2`) is written and reloaded by
 * the licence gate. These labels are cosmetic and must never trigger a reload
 * or touch a broadcast, so they live in their own key and are applied by
 * `src/timer/segment-label.ts` at the DOM layer.
 *
 * Values are stored per field id, so a value survives a change to the shipped
 * name. An empty value means "use the shipped name", which is why clearing a
 * field restores the default.
 */

/** One editable stage category. */
export interface StageLabelField {
  /** Storage key. Stable: the value follows the field, not the shipped text. */
  id: string;
  /** Name shown in the Pro panel. */
  label: string;
  /** Shipped stage strings this field replaces. */
  match: string[];
}

/**
 * Every category the stage can print, in the order the fields are shown.
 *
 * The story engine prints its archetype rather than a pack name, so all six
 * archetypes map to the one "Storytelling engine" field: a creator's niche is
 * the same whichever case the rotation draws.
 */
export const STAGE_LABEL_FIELDS: StageLabelField[] = [
  { id: 'bible', label: 'Bible / Faith', match: ['Bible / Faith'] },
  { id: 'history', label: 'World History / Trivia', match: ['World History / Trivia'] },
  { id: 'players', label: 'Player quiz', match: ['Player Quiz'] },
  { id: 'video', label: 'Video engine', match: ['Video engine'] },
  {
    id: 'story',
    label: 'Storytelling engine',
    match: [
      'Biblical Mystery',
      'Historical Heist',
      'Historical Anomaly',
      'Ethical Dilemma',
      'Survival Scenario',
      'Sar & Diq · Banter'
    ]
  }
];

/** Long enough for a niche, short enough not to wreck the stage layout. */
export const LABEL_MAX_LENGTH = 40;

const STORAGE_KEY = 'lnr_stage_labels_v2';
/* v1 was keyed by the shipped quiz pack name, so only those two fields exist
   there. Read once, written forward, never used again. */
const LEGACY_KEY = 'lnr_stage_labels_v1';

/** Fired after a write so the stage can re-apply without a reload. */
export const LABELS_CHANGED = 'lnr:labels-changed';

function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  /* One line only: a newline would break the frame's flex row. */
  return value.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX_LENGTH);
}

function fieldFor(id: string): StageLabelField | null {
  return STAGE_LABEL_FIELDS.find((field) => field.id === id) || null;
}

/** Stored values, keyed by field id. Empty fields are absent. */
export function readLabelValues(): Record<string, string> {
  const out: Record<string, string> = {};
  let parsed: Record<string, unknown> | null = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy) as Record<string, unknown>;
        STAGE_LABEL_FIELDS.forEach((field) => {
          /* v1 used the shipped quiz name as its key. */
          const value = clean(old[field.label]);
          if (value) out[field.id] = value;
        });
      }
    } catch {
      /* a corrupt save simply means shipped names */
    }
    /* Persist the migration so the next read is the plain one. */
    if (Object.keys(out).length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* private mode: the stage keeps the shipped name after a reload */
      }
    }
    return out;
  }

  if (typeof parsed !== 'object') return out;
  STAGE_LABEL_FIELDS.forEach((field) => {
    const value = clean(parsed[field.id]);
    if (value) out[field.id] = value;
  });
  return out;
}

/**
 * Shipped string -> replacement, for the DOM layer. Only non-empty values are
 * returned, so an untouched field leaves the stage exactly as the engine
 * wrote it.
 */
export function readLabelReplacements(): Array<[string, string]> {
  const values = readLabelValues();
  const pairs: Array<[string, string]> = [];
  STAGE_LABEL_FIELDS.forEach((field) => {
    const value = values[field.id];
    if (!value) return;
    field.match.forEach((shipped) => pairs.push([shipped, value]));
  });
  return pairs;
}

/** Empty value clears the override, restoring the shipped category. */
export function writeLabelOverride(fieldId: string, value: string): void {
  if (!fieldFor(fieldId)) return;

  const next = readLabelValues();
  const cleaned = clean(value);
  if (cleaned) next[fieldId] = cleaned;
  else delete next[fieldId];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode: the stage keeps the shipped name */
  }

  try {
    window.dispatchEvent(new CustomEvent(LABELS_CHANGED));
  } catch {
    /* no window (tests) */
  }
}
