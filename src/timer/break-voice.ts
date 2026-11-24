/* ==========================================================================
   break-voice.ts -- the card is read out by this device's reader
   --------------------------------------------------------------------------
   A viewer watching a stream cannot lean in and read a small card, so the
   card is spoken: the question and its options, the answer, the anecdote.
   The card then follows that voice instead of a fixed timer, which is what
   makes a break feel live rather than slide.
   ========================================================================== */

/* --- imports --- */
import { SETTINGS_KEY } from './break-parser';
/* --- end imports --- */

export function sleep(ms: number, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      resolve();
    };
    const timer = window.setInterval(() => {
      if (!alive() || performance.now() - started >= ms) finish();
    }, 200);
  });
}

/* --------------------------------------------------------------------------
   Break narration
   --------------------------------------------------------------------------
   A viewer watching a stream cannot lean in and read a small card, so the
   card is read out by this device's reader: the question and its options, the
   answer, and the anecdote. The card then follows that voice instead of a
   fixed timer, which is what makes a break feel live rather than slide.

   The voice is the one the device already uses (voice-language.ts applies the
   operator's choice to every utterance), so nothing here picks a language
   from the words on the card. The operator's "Read questions aloud" switch is
   honoured: with the reader off, breaks stay silent and move on their own
   timers, exactly as before.
   -------------------------------------------------------------------------- */

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

export function narrate(parts: string[], onProgress?: (fraction: number) => void): Narration | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!readerIsOn()) return null;

  const text = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('. ');
  if (!text) return null;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
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
    if (!onProgress || typeof event.charIndex !== 'number' || !text.length) return;
    onProgress(Math.max(0, Math.min(1, event.charIndex / text.length)));
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
  timers.push(window.setTimeout(finish, Math.min(300000, 10000 + text.length * 400)));

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
  parts: string[],
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

/* Wait until the card has been up for its usual time AND the voice has
   finished, whichever ends last, with a hard cap so a stalled voice cannot
   hold the stream. */
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
