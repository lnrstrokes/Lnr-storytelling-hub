/**
 * social.ts — every way a user can reach the studio, in one place.
 *
 * WHY THIS IS A MODULE
 * --------------------
 * The support email used to be typed into three files (`timer.html`, the
 * engine, and the Pro gate) and each copy could drift. Adding X and YouTube
 * the same way would have made five places to edit. They live here instead:
 * change a handle once and every surface follows.
 *
 * THE NOTICE VERSION
 * ------------------
 * `NOTICE_VERSION` is the whole mechanism behind the "disappearing" notices.
 * A dismissed notice is remembered under `<key>_<version>`, so it stays hidden
 * for this version and comes back exactly once when a new version ships. That
 * is how an installed user learns that something changed without a popup
 * interrupting a broadcast.
 *
 * Bump `NOTICE_VERSION` only when the notice copy changes — not on every
 * build, or users will see it again for no reason.
 */

export const SUPPORT_EMAIL = 'lnrstrokes@gmail.com';

export const X_HANDLE = '@BACSBlueprint';
export const X_URL = 'https://x.com/BACSBlueprint';

export const YOUTUBE_HANDLE = '@lnrlivestreamhub';
export const YOUTUBE_URL = 'https://youtube.com/@lnrlivestreamhub';

/** Shows the notice once per added or changed line of copy. */
export const NOTICE_VERSION = 'v1';

const PREFIX = 'lnr_notice_';

function storageKey(id: string): string {
  return `${PREFIX}${id}_${NOTICE_VERSION}`;
}

/** True when the user has already dismissed this notice for this version. */
export function isNoticeDismissed(id: string): boolean {
  try {
    return localStorage.getItem(storageKey(id)) === '1';
  } catch {
    /* private mode / storage blocked: show it rather than crash */
    return false;
  }
}

/** Remember the dismissal. Never throws — a full disk must not break the app. */
export function dismissNotice(id: string): void {
  try {
    localStorage.setItem(storageKey(id), '1');
  } catch {
    /* the notice simply shows again next time */
  }
}
