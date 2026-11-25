/* ============================================================
   LNR Timer — video clip title store
   Persists editable display titles per clip id in localStorage.
   keyed by clip id (string). Falls back to the uploaded filename
   (without extension) when no title has been saved.
   ============================================================ */

const CLIP_TITLES_STORE = 'lnr_video_clip_titles_v1';

export function loadClipTitles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLIP_TITLES_STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function saveClipTitles(titles: Record<string, string>): void {
  try {
    localStorage.setItem(CLIP_TITLES_STORE, JSON.stringify(titles));
  } catch {
    /* quota / private mode: the title edit is still usable for this session;
       the fallback filename will show instead of the saved title. */
  }
}

/**
 * The display title for a clip. If the user has saved a custom title for the
 * clip id, use it (trimmed, max 60 chars). Otherwise derive one from the
 * uploaded filename: strip the extension and any leading path, then trim.
 *
 * If the resulting string is empty, fall back to the filename without
 * extension (or the raw filename if that is also empty).
 */
export function clipDisplayName(clipId: string, filename: string): string {
  const titles = loadClipTitles();
  const saved = titles[clipId];
  if (typeof saved === 'string') {
    const trimmed = saved.trim();
    if (trimmed.length > 0) {
      return trimmed.length > 60 ? trimmed.slice(0, 60) : trimmed;
    }
  }

  /* Derive a default from the uploaded filename: drop the extension and any
     leading path/URL component, then trim. */
  const base = filename.split('/').pop()?.split('\\').pop() || filename;
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const derived = withoutExt.trim();
  if (derived.length > 0) {
    return derived.length > 60 ? derived.slice(0, 60) : derived;
  }
  return base.length > 60 ? base.slice(0, 60) : base;
}

/**
 * Save a (possibly edited) display title for a clip. The same trimming and
 * 60-char cap used by `clipDisplayName` applies, so a malicious/very long edit
 * can never blow up the stage label or the break card meta.
 *
 * If the value trims to empty, we do NOT persist an empty title — instead we
 * remove any saved title for that id so future reads fall back to the filename
 * (which the requirement says to do when the user clears it).
 */
export function saveClipDisplayName(clipId: string, value: string): string {
  const trimmed = String(value || '').trim();
  if (trimmed.length === 0) {
    const titles = loadClipTitles();
    delete titles[clipId];
    saveClipTitles(titles);
    return '';
  }
  const capped = trimmed.length > 60 ? trimmed.slice(0, 60) : trimmed;
  const titles = loadClipTitles();
  titles[clipId] = capped;
  saveClipTitles(titles);
  return capped;
}

/**
 * Publish the title helpers for the plain-JS engine (src/timer/engine.js),
 * which cannot import a TS module. Imported once from TimerApp, before the
 * engine boots.
 */
export function publishClipTitles(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { LNR_CLIP_TITLES?: unknown }).LNR_CLIP_TITLES = {
    clipDisplayName,
    saveClipDisplayName,
  };
}
