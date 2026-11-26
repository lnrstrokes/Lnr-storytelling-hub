/* ==========================================================================
   airtime-limit.ts — 2 hours of airtime per day on Free, unlimited on Pro
   --------------------------------------------------------------------------
   THE RULE

     Free  : 2 hours of broadcast airtime per calendar day, counted by the
             SERVER (/api/airtime). The server refuses to start or continue a
             session once the allowance is spent.
     Pro   : unlimited. No cap is ever applied to a licensed device.

   WHY THE SERVER OWNS THE NUMBER

   The first version of this module kept the tally in localStorage. It
   survived reloads and clock changes, but it was still the browser's own
   word: clearing site data, opening a private window, or editing the stored
   value started a fresh 2 hours. A cap the client can reset is not a cap.

   Now the browser holds only a CACHE for instant UI. Every decision that
   matters — may this session start, may it continue — is answered by
   /api/airtime, which keeps the tally against a signed httpOnly cookie in a
   network store. Clearing localStorage, editing values, reloading, opening a
   new tab or changing the system clock all keep the same identity and the
   same tally.

   WHAT COUNTS AS AIRTIME

   Only time spent on the stage with the session running and the tab visible.
   A paused broadcast does not burn the allowance, and a phone with the screen
   off (or the tab in the background) does not either — the creator is not
   airing anything a viewer can see.

   WHEN THE ALLOWANCE RUNS OUT

   Mid-broadcast, the session is stopped cleanly through the engine's own Exit
   control (never by tearing the page down), and a dialog explains the limit
   and links to Pro. Starting a new session while exhausted is blocked before
   the engine sees the click.

   OFFLINE

   If the server cannot be reached the module falls back to the cached tally
   and keeps enforcing locally, so a network blip never hands out free airtime
   and never locks a paying creator out mid-broadcast.
   ========================================================================== */

import { getProLicenseKey, getProState, PRO_CHECKOUT_URL } from '../pro/license';

/** Free plan: 2 hours of airtime per calendar day. */
export const FREE_DAILY_LIMIT_MS = 2 * 60 * 60 * 1000;

const TICK_MS = 1000;
/** A single tick longer than this is a suspended tab, not real airtime. */
const MAX_TICK_MS = 90 * 1000;
/** Send a tick to the server at most this often. */
const SYNC_EVERY_MS = 5000;
/** Re-read the server's tally at most this often. */
const REFRESH_EVERY_MS = 30000;

/** Local cache of the server's answer, so the UI is instant on load. */
const CACHE_KEY = 'lnr_airtime_cache_v2';
/** Stable per-device key, sent with every call. The server keeps a tally under
 *  this AND under the httpOnly cookie and uses the larger, so clearing one
 *  store cannot refund airtime. */
const DEVICE_KEY = 'lnr_air_device_v1';

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

interface Cache {
  day: string;
  usedMs: number;
  at: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The day an open session is spending. Empty when no session is running.
 *
 * A stream that crosses 00:00 UTC used to have its cache rejected the moment
 * the date changed (the `day` guard below), so the browser showed a fresh
 * 2 hours while the server kept counting against yesterday: the UI said there
 * was airtime left and the broadcast was cut off mid-stream, or a reload after
 * midnight handed out a second allowance. Pinning the day for the life of the
 * session keeps the client and the server telling the same story. */
let pinnedDay = '';

function activeDay(): string {
  return pinnedDay || todayKey();
}

function readCache(): Cache {
  const day = activeDay();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Cache>;
      if (
        parsed &&
        parsed.day === day &&
        typeof parsed.usedMs === 'number' &&
        Number.isFinite(parsed.usedMs) &&
        parsed.usedMs >= 0
      ) {
        return { day, usedMs: parsed.usedMs, at: Number(parsed.at) || 0 };
      }
    }
  } catch {
    /* private mode / corrupt */
  }
  return { day, usedMs: 0, at: 0 };
}

function writeCache(usedMs: number): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ day: activeDay(), usedMs: Math.round(usedMs), at: Date.now() })
    );
  } catch {
    /* quota: the server still holds the truth */
  }
}

/* ------------------------------------------------------------ server sync */

interface ServerState {
  ok: boolean;
  pro: boolean;
  usedMs: number;
  remainingMs: number | null;
  exhausted: boolean;
  allowed?: boolean;
  reason?: string;
  store?: string;
}

let lastServer: ServerState | null = null;
let serverReachable = true;

function licenseKey(): string {
  try {
    /* The key itself lives in the stored record, not on ProState — reading
       ProState.key always yielded '' and the server therefore never saw a
       licence, capping paying customers at 2 hours. */
    return getProLicenseKey();
  } catch {
    return '';
  }
}

async function callServer(action: string, extra: Record<string, unknown> = {}): Promise<ServerState | null> {
  try {
    const res = await fetch('/api/airtime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, licenseKey: licenseKey(), deviceId: deviceId(), ...extra }),
    });
    const data = (await res.json()) as ServerState;
    if (!data || typeof data.usedMs !== 'number') return null;
    serverReachable = true;
    lastServer = data;
    writeCache(data.usedMs);
    return data;
  } catch {
    serverReachable = false;
    return null;
  }
}

/** The tally to show. The server's number wins whenever we have one. */
function currentUsedMs(): number {
  if (lastServer && typeof lastServer.usedMs === 'number') return lastServer.usedMs;
  return readCache().usedMs;
}

export function airtimeUsedMs(): number {
  return currentUsedMs();
}

export function airtimeRemainingMs(): number {
  return Math.max(0, FREE_DAILY_LIMIT_MS - currentUsedMs());
}

export function isPro(): boolean {
  return getProState().active;
}

/** True when a Free device has used its allowance for today. */
export function isAirtimeExhausted(): boolean {
  if (isPro()) return false;
  if (lastServer && lastServer.pro) return false;
  return airtimeRemainingMs() <= 0;
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
  const pro = isPro() || !!(lastServer && lastServer.pro);
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
    'Your quizzes, stories and settings stay saved — the allowance resets at midnight UTC, ' +
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

  /* --- ask the server for the real tally on load ------------------------ */
  void callServer('status').then(() => updateCopy());

  /* --- block Start when the day is spent -------------------------------- */
  /* The click is intercepted in the capture phase, BEFORE the engine's own
     handler, and the server is asked for a final verdict. A stale cache can
     never let a spent day go live. */
  /* The allowed click has to be replayed, because this listener already
     stopped the original one. Without this flag the replay is caught by THIS
     listener again, which replayes again: an endless loop of /api/airtime
     calls in which the engine's Start handler is never reached. */
  let replayingStart = false;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.id !== 'startBtn') return;
    /* Our own replay: let it through to the engine untouched. */
    if (replayingStart) {
      replayingStart = false;
      return;
    }
    if (isPro()) return;

    /* Optimistic local block: instant, and correct in the common case. */
    if (airtimeRemainingMs() <= 0) {
      event.preventDefault();
      event.stopPropagation();
      showLimitDialog();
      return;
    }

    /* Confirm with the server. If it refuses, cancel the click. */
    event.preventDefault();
    event.stopPropagation();
    void callServer('start').then((state) => {
      updateCopy();
      if (state && state.allowed === false) {
        showLimitDialog();
        return;
      }
      /* Allowed (or the server is unreachable and the cache says there is
         time left): replay the click so the engine starts normally. */
      const btn = document.getElementById('startBtn') as HTMLButtonElement | null;
      if (btn) {
        replayingStart = true;
        btn.click();
      }
    });
  }, true);

  /* --- pin the day while a session is open ------------------------------ */
  /* The stage class is the engine's own signal that a broadcast is running.
     Everything in this module already keys off it, so the day pin follows it
     too: set when the stage appears, cleared when it goes away. A session that
     crosses midnight therefore keeps spending the day it started on, in the
     browser as well as on the server. */
  let stageWasUp = inSession();
  const syncSessionDay = () => {
    const up = inSession();
    if (up === stageWasUp) return;
    stageWasUp = up;
    if (up) {
      if (!pinnedDay) {
        /* The day the running tally belongs to. readCache() already answers
           under activeDay(), which is todayKey() until a pin exists, so this
           is "the day this session started on". */
        pinnedDay = todayKey();
      }
    } else {
      /* Leaving the stage closes the session: the next broadcast is judged on
         whatever day it starts. */
      pinnedDay = '';
      void callServer('stop');
    }
    updateCopy();
  };

  /* --- meter the stage -------------------------------------------------- */
  let lastTickAt = Date.now();
  let unsyncedMs = 0;
  let lastSyncAt = 0;
  let lastRefreshAt = 0;

  const recordTick = () => {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;

    syncSessionDay();

    if (!inSession() || document.hidden || sessionPaused() || isPro()) return;
    if (delta <= 0 || delta > MAX_TICK_MS) return;

    /* Local cache advances immediately so the UI is honest between syncs. */
    const cached = readCache();
    writeCache(cached.usedMs + delta);
    unsyncedMs += delta;

    if (now - lastSyncAt >= SYNC_EVERY_MS) {
      lastSyncAt = now;
      const send = unsyncedMs;
      unsyncedMs = 0;
      void callServer('tick', { deltaMs: send }).then((state) => {
        if (state && state.allowed === false) enforce();
        updateCopy();
      });
    }

    enforce();
  };

  window.setInterval(() => {
    recordTick();
    updateCopy();
  }, TICK_MS);

  /* Periodic re-read, so a second tab or another device on the same identity
     is reflected here without a reload. */
  window.setInterval(() => {
    if (Date.now() - lastRefreshAt < REFRESH_EVERY_MS) return;
    lastRefreshAt = Date.now();
    if (isPro()) return;
    void callServer('status').then(() => {
      updateCopy();
      enforce();
    });
  }, REFRESH_EVERY_MS);

  /* Leaving the tab must not be counted as airtime, and returning must not
     count the gap either. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && unsyncedMs > 0) {
      const send = unsyncedMs;
      unsyncedMs = 0;
      void callServer('tick', { deltaMs: send });
    }
    lastTickAt = Date.now();
    updateCopy();
  });

  /* Day rollover, or a Pro licence changing hands, re-evaluates the cap. */
  window.addEventListener('lnr:pro-changed', () => {
    lastTickAt = Date.now();
    void callServer('status').then(() => updateCopy());
  });

  /* No dialog on load: an exhausted day is reported in the hint line, and the
     dialog appears when the operator actually tries to go live. */
  updateCopy();
}

/* Exposed for the browser test harness. */
(window as unknown as { LNR_AIRTIME?: unknown }).LNR_AIRTIME = {
  used: () => airtimeUsedMs(),
  remaining: () => airtimeRemainingMs(),
  exhausted: () => isAirtimeExhausted(),
  server: () => lastServer,
  reachable: () => serverReachable,
  refresh: () => callServer('status'),
};
