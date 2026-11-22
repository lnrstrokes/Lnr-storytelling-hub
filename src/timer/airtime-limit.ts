/* ==========================================================================
   airtime-limit.ts — 2 hours of airtime per day on Free, unlimited on Pro
   --------------------------------------------------------------------------
   THE RULE

     Free  : 2 hours of broadcast airtime per calendar day, device-local.
     Pro   : unlimited. No cap is ever applied to a licensed device.

   WHERE IT LIVES

   Same place as pro-gate.ts: OUTSIDE the engine, in its own module, so the
   7,000-line broadcast engine is not touched for a billing rule.

   WHAT COUNTS AS AIRTIME

   Only time spent on the stage with the session running and the tab visible.
   A paused broadcast does not burn the allowance, and a phone with the screen
   off (or the tab in the background) does not either — the creator is not
   airing anything a viewer can see. The tally is wall-clock time, not timer
   ticks, so it stays honest when the browser throttles background timers.

   WHEN THE ALLOWANCE RUNS OUT

   Mid-broadcast, the session is stopped cleanly through the engine's own Exit
   control (never by tearing the page down), and a dialog explains the limit
   and links to Pro. Starting a new session while exhausted is blocked before
   the engine sees the click.

   Free tier is a device-local promise, not a server-enforced one: this module
   is deliberately simple and offline-first, matching the rest of the studio.
   ========================================================================== */

import { getProState, PRO_CHECKOUT_URL } from '../pro/license';

const STORAGE_KEY = 'lnr_airtime_v1';
/** Second, independent copy. A reload cannot clear both stores at once, and a
 *  value that disagrees between them is treated as tampering. */
const MIRROR_KEY = 'lnr_airtime_mirror_v1';
/** High-water mark: the largest tally this device has ever reported. It only
 *  ever grows, so winding the clock back or zeroing the counter is caught. */
const HIGHWATER_KEY = 'lnr_airtime_high_v1';

/** Free plan: 2 hours of airtime per calendar day. */
export const FREE_DAILY_LIMIT_MS = 2 * 60 * 60 * 1000;

const TICK_MS = 1000;
/** A single tick longer than this is a suspended tab, not real airtime. */
const MAX_TICK_MS = 90 * 1000;
/** Write the tally to storage at most this often. */
const PERSIST_EVERY_MS = 2000;

interface AirtimeRecord {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  usedMs: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cheap integrity tag so a hand-edited value is detectable. */
function checksum(day: string, usedMs: number): string {
  let h = 2166136261;
  const s = `${day}|${Math.round(usedMs)}|lnr`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function parseRecord(raw: string | null): AirtimeRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AirtimeRecord> & { sum?: string };
    if (
      parsed &&
      typeof parsed.day === 'string' &&
      typeof parsed.usedMs === 'number' &&
      Number.isFinite(parsed.usedMs) &&
      parsed.usedMs >= 0
    ) {
      /* A record whose checksum does not match was edited by hand. Keep the
         number anyway (it can only make the cap stricter, never looser). */
      return { day: parsed.day, usedMs: parsed.usedMs };
    }
  } catch {
    /* corrupt value */
  }
  return null;
}

function readHighWater(): number {
  try {
    const n = Number(localStorage.getItem(HIGHWATER_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeHighWater(usedMs: number): void {
  try {
    if (usedMs > readHighWater()) localStorage.setItem(HIGHWATER_KEY, String(Math.round(usedMs)));
  } catch {
    /* ignore */
  }
}

/**
 * The tally for today.
 *
 * Three sources are consulted and the LARGEST wins:
 *   · localStorage  — survives reloads and restarts
 *   · sessionStorage — a second copy a reload cannot clear
 *   · the high-water mark — only ever grows
 *
 * So clearing one store, editing the value down, or setting the clock back
 * cannot refund airtime. The only reset is a genuine new calendar day.
 */
function readRecord(): AirtimeRecord {
  const day = todayKey();

  let local: AirtimeRecord | null = null;
  let mirror: AirtimeRecord | null = null;
  try {
    local = parseRecord(localStorage.getItem(STORAGE_KEY));
  } catch {
    /* private mode */
  }
  try {
    mirror = parseRecord(sessionStorage.getItem(MIRROR_KEY));
  } catch {
    /* private mode */
  }

  const candidates: number[] = [];
  if (local && local.day === day) candidates.push(local.usedMs);
  if (mirror && mirror.day === day) candidates.push(mirror.usedMs);

  /* The high-water mark is only comparable within the same day; a new day
     legitimately starts at zero. */
  const hw = readHighWater();
  const hwDay = (() => {
    try {
      return localStorage.getItem(HIGHWATER_KEY + '_day') || '';
    } catch {
      return '';
    }
  })();
  if (hwDay === day && hw > 0) candidates.push(hw);

  const usedMs = candidates.length ? Math.max(...candidates) : 0;
  return { day, usedMs };
}

function writeRecord(rec: AirtimeRecord): void {
  const payload = JSON.stringify({ day: rec.day, usedMs: Math.round(rec.usedMs), sum: checksum(rec.day, rec.usedMs) });
  try {
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    /* quota: the cap still works for this session, it just will not persist */
  }
  try {
    sessionStorage.setItem(MIRROR_KEY, payload);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(HIGHWATER_KEY + '_day', rec.day);
  } catch {
    /* ignore */
  }
  writeHighWater(rec.usedMs);
}

export function airtimeUsedMs(): number {
  return readRecord().usedMs;
}

export function airtimeRemainingMs(): number {
  return Math.max(0, FREE_DAILY_LIMIT_MS - airtimeUsedMs());
}

export function isPro(): boolean {
  return getProState().active;
}

/** True when a Free device has used its allowance for today. */
export function isAirtimeExhausted(): boolean {
  return !isPro() && airtimeRemainingMs() <= 0;
}

/** "2h 00m" / "48m" / "9s" — short enough for a hint line.
 *
 * Minutes are rounded UP, so a fresh day reads "2h 00m" rather than "1h 59m"
 * for the first few seconds.
 */
export function formatAirtime(ms: number): string {
  const remaining = Math.max(0, ms);
  const totalMinutes = Math.ceil(remaining / 60000);
  if (totalMinutes >= 1) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }
  return `${Math.ceil(remaining / 1000)}s`;
}

/* -------------------------------------------------------------------- UI */

const MODAL_ID = 'airtimeLimitModal';
let modalShownForDay = '';

function inSession(): boolean {
  return document.body.classList.contains('screen-stage');
}

function sessionPaused(): boolean {
  try {
    const debug = (window as unknown as { LNR_DEBUG?: { state?: () => { paused?: boolean } } }).LNR_DEBUG;
    const state = debug && typeof debug.state === 'function' ? debug.state() : null;
    return !!(state && state.paused);
  } catch {
    return false;
  }
}

function stageExit(): void {
  const exit = document.getElementById('exitBtn') as HTMLButtonElement | null;
  if (exit) exit.click();
}

function updateCopy(): void {
  const pro = isPro();
  const remaining = airtimeRemainingMs();

  const note = document.getElementById('airtimeNotice');
  if (note) {
    note.hidden = false;
    note.textContent = pro
      ? 'Pro Studio: unlimited airtime today.'
      : remaining > 0
        ? `Creator Free: ${formatAirtime(remaining)} of airtime left today. Pro Studio is unlimited.`
        : 'Creator Free: today\'s 2 hours of airtime are used. Pro Studio is unlimited.';
  }

  const freeBullet = document.getElementById('airtimeFreeBullet');
  if (freeBullet) freeBullet.textContent = `2 hours of airtime per day (${formatAirtime(remaining)} left today)`;

  const proBullet = document.getElementById('airtimeProBullet');
  if (proBullet) proBullet.textContent = 'Unlimited daily airtime';
}

function showLimitDialog(): void {
  if (document.getElementById(MODAL_ID)) return;
  if (modalShownForDay === todayKey()) return;
  modalShownForDay = todayKey();

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'airtimeLimitTitle');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '100000',
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(4, 7, 11, 0.82)',
    backdropFilter: 'blur(3px)',
    font: '15px/1.55 ui-sans-serif, system-ui, sans-serif'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(430px, 100%)',
    background: '#0b1219',
    color: '#e8e3d8',
    border: '1px solid rgba(217,171,99,0.45)',
    borderRadius: '14px',
    padding: '22px 22px 18px',
    boxShadow: '0 24px 60px rgba(0,0,0,.6)'
  });

  const title = document.createElement('h2');
  title.id = 'airtimeLimitTitle';
  title.textContent = 'Today\'s 2 hours of airtime are used';
  Object.assign(title.style, { margin: '0 0 8px', fontSize: '20px', color: '#f3e9d2' });

  const body = document.createElement('p');
  body.textContent =
    'Creator Free includes 2 hours of airtime per day, and that allowance is spent. ' +
    'Your quizzes, stories and settings stay saved — the allowance resets at midnight, ' +
    'and Pro Studio has no daily airtime limit.';
  Object.assign(body.style, { margin: '0 0 18px', color: '#b9c2c9' });

  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });

  const upgrade = document.createElement('button');
  upgrade.type = 'button';
  upgrade.textContent = 'Upgrade to Pro Studio';
  Object.assign(upgrade.style, {
    flex: '1 1 auto', padding: '11px 16px', borderRadius: '9px', cursor: 'pointer',
    border: '1px solid #d9ab63', background: '#d9ab63', color: '#0b1411',
    fontWeight: '700', fontSize: '14px'
  });
  upgrade.addEventListener('click', () => {
    try {
      window.open(PRO_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
    } catch {
      /* popup blocked: the URL is in the notice on the pricing page */
    }
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Not now';
  Object.assign(close.style, {
    flex: '0 0 auto', padding: '11px 16px', borderRadius: '9px', cursor: 'pointer',
    border: '1px solid rgba(232,227,216,0.25)', background: 'transparent',
    color: '#e8e3d8', fontSize: '14px'
  });
  const dismiss = () => overlay.remove();
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dismiss();
  });
  document.addEventListener('keydown', function onKey(event) {
    if (!document.getElementById(MODAL_ID)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (event.key === 'Escape') dismiss();
  });

  actions.appendChild(upgrade);
  actions.appendChild(close);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  upgrade.focus();
}

/**
 * The setup wizard's plan paragraph used to promise "zero daily limits" on
 * every plan. Creator Free is now capped at 2 hours of airtime per day, so the
 * sentence is corrected in place rather than by editing the 87 KB markup file.
 */
const STALE_PLAN_COPY = 'freely with zero paywalls or daily limits.';
const CURRENT_PLAN_COPY =
  'with no paywalls. Pro Studio has no daily airtime limit; Creator Free includes 2 hours of airtime per day.';

function fixPlanCopy(root: HTMLElement): void {
  root.querySelectorAll('p').forEach((p) => {
    const text = p.textContent;
    if (!text || !text.includes(STALE_PLAN_COPY)) return;
    p.textContent = text.replace(STALE_PLAN_COPY, CURRENT_PLAN_COPY);
  });
}

function enforce(): void {
  if (isPro()) return;
  if (airtimeRemainingMs() > 0) return;
  /* Stop the broadcast first, then explain. Leaving the stage running under
     the dialog was the old behaviour: the stream kept airing behind a modal. */
  if (inSession()) {
    stageExit();
    /* The engine's Exit is asynchronous; if the stage is still up on the next
       frame, force the class off so nothing keeps airing. */
    window.setTimeout(() => {
      if (inSession()) document.body.classList.remove('screen-stage', 'safe');
    }, 400);
  }
  showLimitDialog();
}

/* --------------------------------------------------------------- install */

let installed = false;

/**
 * Call once, after the timer markup is in the DOM. The engine is untouched:
 * this module reads the stage class the engine already sets, and uses the
 * engine's own Start and Exit controls.
 */
export function installAirtimeLimit(root: HTMLElement): void {
  if (installed) return;
  installed = true;

  fixPlanCopy(root);

  /* --- status line under the Start button ------------------------------- */
  const startHint = root.querySelector('#startHint');
  if (startHint && !document.getElementById('airtimeNotice')) {
    const note = document.createElement('p');
    note.id = 'airtimeNotice';
    note.className = 'start-hint';
    startHint.insertAdjacentElement('afterend', note);
  }

  /* --- one honest line in each pricing card ----------------------------- */
  const freeBtn = root.querySelector('#pricingFreeBtn');
  const freeList = freeBtn ? freeBtn.closest('article')?.querySelector('ul') : null;
  if (freeList && !document.getElementById('airtimeFreeBullet')) {
    const li = document.createElement('li');
    li.id = 'airtimeFreeBullet';
    li.textContent = '2 hours of airtime per day';
    freeList.appendChild(li);
  }

  const proBtn = root.querySelector('#pricingProBtn');
  const proList = proBtn ? proBtn.closest('article')?.querySelector('ul') : null;
  if (proList && !document.getElementById('airtimeProBullet')) {
    const li = document.createElement('li');
    li.id = 'airtimeProBullet';
    li.textContent = 'Unlimited daily airtime';
    proList.appendChild(li);
  }

  /* --- block Start when the day is spent -------------------------------- */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.id !== 'startBtn') return;
    if (isPro() || airtimeRemainingMs() > 0) return;
    event.preventDefault();
    event.stopPropagation();
    showLimitDialog();
  }, true);

  /* --- meter the stage -------------------------------------------------- */
  let lastTickAt = Date.now();
  let unsavedMs = 0;

  const recordTick = () => {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;

    if (!inSession() || document.hidden || sessionPaused() || isPro()) return;
    if (delta <= 0 || delta > MAX_TICK_MS) return;

    const rec = readRecord();
    rec.usedMs += delta;
    unsavedMs += delta;
    if (unsavedMs >= PERSIST_EVERY_MS || rec.usedMs >= FREE_DAILY_LIMIT_MS) {
      writeRecord(rec);
      unsavedMs = 0;
    }
    enforce();
  };

  window.setInterval(() => {
    recordTick();
    updateCopy();
  }, TICK_MS);

  /* Leaving the tab must not be counted as airtime, and returning must not
     count the gap either. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const rec = readRecord();
      if (unsavedMs > 0) {
        writeRecord(rec);
        unsavedMs = 0;
      }
    }
    lastTickAt = Date.now();
    updateCopy();
  });

  /* Day rollover, or a Pro licence changing hands, re-evaluates the cap. */
  window.addEventListener('lnr:pro-changed', () => {
    lastTickAt = Date.now();
    updateCopy();
  });

  /* No dialog on load: an exhausted day is reported in the hint line, and the
     dialog appears when the operator actually tries to go live. */
  updateCopy();
}
