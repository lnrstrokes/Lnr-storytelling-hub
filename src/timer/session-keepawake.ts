/**
 * session-keepawake.ts - a phone should not sleep in the middle of a question.
 *
 * WHY THIS EXISTS
 * ---------------
 * The studio runs on the phone that is also casting the screen. Screen Wake
 * Lock keeps the display on while a broadcast is on the stage, so the quiz does
 * not freeze behind a lock screen halfway through a block. Browsers drop the
 * lock whenever the page is hidden, so it is re-requested on return.
 *
 * The signal is the class the engine already puts on <body> for a live session
 * (`screen-stage`, the same one airtime-limit.ts uses to know it is on air), so
 * the lock is held only while broadcasting - never on the setup pages.
 *
 * Fail-open everywhere: an unsupported browser, a refused request or a released
 * sentinel changes nothing except that the screen is allowed to dim.
 */

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

const ON_STAGE = 'screen-stage';

let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;

function api(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const wl = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
  return wl && typeof wl.request === 'function' ? wl : null;
}

async function acquire(): Promise<void> {
  if (!wanted || sentinel || document.visibilityState !== 'visible') return;
  const wl = api();
  if (!wl) return;
  try {
    const held = await wl.request('screen');
    sentinel = held;
    held.addEventListener('release', () => {
      if (sentinel === held) sentinel = null;
    });
  } catch {
    /* denied, low battery, or no user gesture yet: the screen may dim */
  }
}

function release(): void {
  const held = sentinel;
  sentinel = null;
  if (!held || held.released) return;
  try {
    void held.release().catch(() => {});
  } catch {
    /* already gone */
  }
}

function sync(): void {
  wanted = document.body.classList.contains(ON_STAGE);
  if (wanted) void acquire();
  else release();
}

export function installSessionKeepAwake(_host?: HTMLElement): void {
  if (!api() || typeof document === 'undefined') return;

  sync();

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* The browser drops the lock when the page is hidden; re-request on return. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sentinel = null;
      void acquire();
    } else {
      sentinel = null;
    }
  });
}
