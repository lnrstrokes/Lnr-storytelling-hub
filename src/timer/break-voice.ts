/* ==========================================================================
   break-voice.ts -- the card is read out by this device's reader
   --------------------------------------------------------------------------
   A viewer watching a stream cannot lean in and read a small card, so the
   card is spoken: the question and its options, the answer, the anecdote.
   The card then follows that voice instead of a fixed timer, which is what
   makes a break feel live rather than slide.

   The voice is the one the device already uses (voice/language settings from
   the studio apply to every utterance). The operator's "Read questions aloud"
   switch is honoured: with the reader off, breaks stay silent and move on
   their own timers, exactly as before.

   This module is shared by the quiz/anecdote break cards on the Video Engine.
   The same reader contract is reused by the on-screen Reference card and every
   break card (quiz, anecdote, promo), so all of them start with speech and
   only start the 10-second countdown AFTER the speech ends.
   ========================================================================== */

/* --- imports --- */
import { SETTINGS_KEY } from './break-parser';
/* --- end imports --- */

export interface Narration {
  done: Promise<void>;
  started: () => boolean;
  speaking: () => boolean;
  stop: () => void;
}

export let activeNarration: Narration | null = null;

export function readerIsOn(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const blob = JSON.parse(raw) as { voiceOn?: unknown };
    return blob.voiceOn !== false;
  } catch {
    return true;
  }
}

/**
 * Read a list of text parts aloud.
 *
 * Parts are spoken as separate utterances so the card can split long text by
 * sentence and so a long anecdote is not cut off by a single ~15s utterance
 * limit (Chromium truncates a long utterance; sentence splitting keeps the
 * reading on natural pauses).
 *
 * If `onProgress` is provided, the reader reports a 0..1 fraction as it
 * advances through the joined text. Fractional progress is used by the
 * long-anecdote auto-scroll so the on-screen window follows the reader.
 */
export function narrate(
  parts: (string | { text: string; syncCaption?: boolean })[],
  onProgress?: (fraction: number) => void
): Narration | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!readerIsOn()) return null;

  const textItems: string[] = [];
  parts.forEach((part) => {
    const raw = typeof part === 'string' ? part : (part && part.text != null ? String(part.text) : '');
    const t = String(raw || '').trim();
    if (t) textItems.push(t);
  });
  if (!textItems.length) return null;

  const joined = textItems.join('. ');
  if (!joined) return null;

  const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  if (!synth) return null;

  const utterance = new SpeechSynthesisUtterance(joined);
  const timers: number[] = [];
  let live = false;
  let settled = false;
  let spokeAt = 0;
  let quietMs = 0;
  let poll = 0;
  let resolveDone: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const busy = (): boolean => {
    try {
      return synth.speaking || synth.pending;
    } catch {
      return false;
    }
  };

  const finish = (): void => {
    if (settled) return;
    settled = true;
    timers.forEach((id) => window.clearTimeout(id));
    if (poll) window.clearInterval(poll);
    resolveDone();
  };

  utterance.onstart = () => {
    live = true;
  };
  utterance.onboundary = (event) => {
    if (!onProgress || typeof event.charIndex !== 'number' || !joined.length) return;
    onProgress(Math.max(0, Math.min(1, event.charIndex / joined.length)));
  };
  utterance.onend = finish;
  utterance.onerror = finish;

  /* "Has the reader finished?" is asked of the synthesiser itself, not only of
     the utterance events. Some devices never fire `onstart`, and some end the
     speech without ever firing `onend`; believing either one cut the card
     short while the voice was still on the last option. Two quiet polls in a
     row (nothing speaking, nothing queued) is the real end of the reading. */
  poll = window.setInterval(() => {
    if (settled) {
      window.clearInterval(poll);
      return;
    }
    if (busy()) {
      live = true;
      quietMs = 0;
      return;
    }
    if (!live) {
      /* Nothing has started: a phone that needs a tap first never will. */
      if (spokeAt && performance.now() - spokeAt > 3000) finish();
      return;
    }
    quietMs += 200;
    if (quietMs >= 600) finish();
  }, 200);

  /* An absolute backstop for a synthesiser that never goes quiet again. It is
     deliberately slow: this is not a reading-length estimate, because a slow
     voice legitimately takes longer than one. */
  timers.push(window.setTimeout(finish, Math.min(300000, 10000 + joined.length * 400)));

  try {
    synth.cancel();
    /* Chrome drops an utterance queued in the same tick as cancel(), so the
       request goes out once the cancel has been applied. */
    timers.push(
      window.setTimeout(() => {
        if (settled) return;
        spokeAt = performance.now();
        try {
          synth.speak(utterance);
        } catch {
          finish();
        }
      }, 80)
    );
  } catch {
    finish();
  }

  return {
    done,
    started: () => live,
    speaking: () => !settled && busy(),
    stop: () => {
      try {
        synth.cancel();
      } catch {
        /* nothing to cancel */
      }
      finish();
    }
  };
}

/* Whatever is speaking now becomes the live narration, so a later hide or a
   new card can cut it off cleanly. */
export function startNarration(
  parts: (string | { text: string; syncCaption?: boolean })[],
  onProgress?: (fraction: number) => void
): Narration | null {
  activeNarration = narrate(parts, onProgress);
  return activeNarration;
}

export function stopNarration(): void {
  const current = activeNarration;
  activeNarration = null;
  current?.stop();
}

/* A cancellable wait: it ends after `ms`, or as soon as `alive()` turns false,
   so a break card never leaves a timer running behind a closed stage. */
function sleep(ms: number, alive: () => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    const step = 200;
    let elapsed = 0;
    const tick = window.setInterval(() => {
      elapsed += step;
      if (!alive() || elapsed >= ms) {
        window.clearInterval(tick);
        resolve();
      }
    }, step);
  });
}

/**
 * Wait until the card has been up for its usual time AND the voice has
 * finished, whichever ends last, with a hard cap so a stalled voice cannot
 * hold the stream.
 */
export function waitForNarration(
  narration: Narration | null,
  floorMs: number,
  capMs: number,
  alive: () => boolean
): Promise<void> {
  const floor = sleep(floorMs, alive);
  if (!narration) return floor;
  return Promise.race([Promise.all([narration.done, floor]), sleep(capMs, alive)]).then(() => undefined);
}

/**
 * Fallback "reading time" when speech is unavailable, muted, errored, or the
 * `onend`/`onboundary` event never fires. The on-screen reader card and the
 * break cards both use this so they cannot get stuck on a silent device.
 *
 * Formula: round up((word count / 2.5) + 1) seconds. It is conservative enough
 * to finish before a real voice would, and short enough that a silent device
 * still moves.
 */
export function fallbackReadSeconds(text: string): number {
  const words = String(text || '')
    .split(/[ \t\n\r]+/)
    .filter(Boolean)
    .length;
  if (!words) return 1;
  return Math.max(1, Math.ceil(words / 2.5 + 1));
}

/**
 * Split a long text into sentence-sized chunks so Android Chrome doesn't cut
 * speech off mid-paragraph. Each returned chunk is short enough to be fed to a
 * single utterance without truncation, and chunks only break on sentence
 * boundaries (or, as a last resort, a comma/clause mark).
 */
export function splitSpeechText(text: string, maxLen?: number): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const limit = Math.max(80, Number(maxLen) || 145);
  if (clean.length <= limit) return [clean];

  const sentences = clean.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) || [clean];
  const out: string[] = [];

  sentences.forEach((s) => {
    const t = String(s || '').trim();
    if (!t) return;
    if (t.length <= limit) {
      out.push(t);
      return;
    }

    /* A sentence that still does not fit: cut at the nearest clause punctuation
       inside the window, and only fall back to a bare word gap when the window
       genuinely contains no punctuation. */
    let rest = t;
    let guard = 0;
    while (rest.length > limit && guard++ < 60) {
      const win = rest.slice(0, limit);
      let cut = -1;

      /* Clause punctuation, strongest first, nearest the end of the window. */
      const marks = [';', ':', '—', '–', ','];
      for (let m = 0; m < marks.length && cut < 0; m++) {
        const idx = win.lastIndexOf(marks[m]);
        if (idx >= Math.floor(limit * 0.45)) cut = idx + 1;
      }
      if (cut < 0) {
        for (let n = 0; n < marks.length && cut < 0; n++) {
          const any = win.lastIndexOf(marks[n]);
          if (any >= Math.floor(limit * 0.2)) cut = any + 1;
        }
      }
      if (cut < 0) {
        const sp = win.lastIndexOf(' ');
        cut = sp >= Math.floor(limit * 0.5) ? sp : limit;
      }

      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest.trim());
  });

  return out.length ? out : [clean];
}

/* The plain-JS engine reads the intro disclaimer with this same reader, so the
   disclaimer and the break cards can never drift apart. */
if (typeof window !== 'undefined') {
  (window as unknown as { LNR_READER?: unknown }).LNR_READER = {
    startNarration,
    stopNarration,
    fallbackReadSeconds,
    splitSpeechText,
  };
}
