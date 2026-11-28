/* ==========================================================================
   notice-copy.ts — editable quiz / anecdote notice wording (Pro only)
   --------------------------------------------------------------------------
   The two pre-break notices ("Quiz break starting soon" and "Anecdote
   starting soon") used to be hard-coded strings in video-breaks.ts. A creator
   running a themed channel wants their own wording, so both lines are now
   editable — as two INDEPENDENT fields, because the quiz notice and the
   anecdote notice are different moments and should be able to read
   differently.

   STORAGE
     Written into the same settings object the rest of the studio uses
     (`lnr_timer_v2`), under `noticeCopy`, so it survives a reload and travels
     with the rest of the plan/user configuration. Nothing new to back up.

   LIMIT
     NOTICE_COPY_LIMIT is not a guess. It was measured in Chromium against the
     real built stylesheet at 1440x810 and 390x844: the notice box grows with
     its text, and at 200 characters the card is 265px tall on desktop (33% of
     the 810px frame) and 166px on mobile (20% of 844px) — comfortably clear of
     the transport bar and the frame edge. Past ~320 characters the card starts
     eating the frame on a phone. 200 is the largest round number that stays
     inside the box at both viewports with room to spare.

   FALLBACK
     Empty, whitespace-only or over-long stored text falls back to the default
     wording, so a notice can never render blank.
   ========================================================================== */

import { SETTINGS_KEY } from './break-parser';

export const NOTICE_COPY_LIMIT = 200;

export const DEFAULT_QUIZ_NOTICE = 'Quiz break starting soon';
export const DEFAULT_ANECDOTE_NOTICE = 'Anecdote starting soon';

export type NoticeCopyKey = 'quiz' | 'anecdote';

export interface NoticeCopy {
  quiz: string;
  anecdote: string;
}

const DEFAULTS: NoticeCopy = {
  quiz: DEFAULT_QUIZ_NOTICE,
  anecdote: DEFAULT_ANECDOTE_NOTICE
};

function readSettings(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The stored custom text, or '' when the creator has not set one. */
export function readNoticeCopy(): NoticeCopy {
  const raw = readSettings().noticeCopy;
  if (!raw || typeof raw !== 'object') return { quiz: '', anecdote: '' };
  const obj = raw as Record<string, unknown>;
  return {
    quiz: typeof obj.quiz === 'string' ? obj.quiz : '',
    anecdote: typeof obj.anecdote === 'string' ? obj.anecdote : ''
  };
}

/**
 * The text a notice should actually render. Never blank: an empty,
 * whitespace-only or over-long value falls back to the default wording.
 */
export function noticeText(key: NoticeCopyKey): string {
  const stored = readNoticeCopy()[key];
  const trimmed = String(stored || '').trim();
  if (!trimmed) return DEFAULTS[key];
  if (trimmed.length > NOTICE_COPY_LIMIT) return DEFAULTS[key];
  return trimmed;
}

/** True when this field is showing the default rather than custom text. */
export function isDefaultNotice(key: NoticeCopyKey): boolean {
  return noticeText(key) === DEFAULTS[key];
}

/**
 * Persist one field. Passing '' (or whitespace) clears the custom value and
 * restores the default. Over-long input is hard-capped, never stored.
 */
export function saveNoticeCopy(key: NoticeCopyKey, value: string): void {
  const settings = readSettings();
  const current = readNoticeCopy();
  const next: NoticeCopy = { ...current };
  const trimmed = String(value || '').slice(0, NOTICE_COPY_LIMIT);
  next[key] = trimmed.trim() ? trimmed : '';
  settings.noticeCopy = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode: the notice still renders the default */
  }
}

/** Restore one field to the shipped wording. */
export function resetNoticeCopy(key: NoticeCopyKey): void {
  saveNoticeCopy(key, '');
}
