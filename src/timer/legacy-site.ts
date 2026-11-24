/*
 * The address printed under "Run your own stream".
 *
 * That line shows the studio's saved site setting (`S.site` in lnr_timer_v2).
 * The project used to run at lnr-studio-247-livestream-engine.vercel.app, so a
 * studio created back then still carries that host - and the stage kept
 * advertising an address that no longer serves the app, right under the CTA
 * that is meant to send viewers to it.
 *
 * The saved value is migrated once, before the engine boots, to the address
 * the app actually lives at. An address the creator typed themselves is left
 * alone.
 */

const STORE = 'lnr_timer_v2';
const DEFAULT_SITE = 'lnr-storytelling-hub.vercel.app';
const LEGACY_HOST = /^lnr-studio-247[a-z0-9-]*\.vercel\.app$/i;

export function installLegacySiteFix(): void {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const state = parsed as { site?: unknown };
    const site = typeof state.site === 'string' ? state.site.trim() : '';
    if (!LEGACY_HOST.test(site)) return;

    state.site = DEFAULT_SITE;
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* private mode or a corrupt save: the engine falls back to its own
       default, which is already the live address. */
  }
}
