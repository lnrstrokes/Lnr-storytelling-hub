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
   fixed timer, which is what makes the break feel live rather than slide.

   The voice is the one the device already uses (voice-language.ts applies the
   operator's choice to every utterance), so nothing here picks a language
   from the words on the card. The operator's "Read questions aloud" switch is
   honoured: with the reader off, breaks stay silent and move on their own
   timers, exactly as before.
   -------------------------------------------------------------------------- */

export interface Narration {
  done: Promise<void>;
  started: () => boolean;
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
  let resolveDone: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (): void => {
    if (settled) return;
    settled = true;
    timers.forEach((id) => window.clearTimeout(id));
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

  /* A phone that silently refuses to start (no tap yet) must not hold the card
     open forever, and some engines never fire onend at all. */
  timers.push(
    window.setTimeout(() => {
      if (!live) finish();
    }, 3000)
  );
  timers.push(window.setTimeout(finish, Math.min(120000, 5000 + text.length * 110)));

  try {
    synth.cancel();
    synth.speak(utterance);
  } catch {
    finish();
  }

  return {
    done,
    started: () => live,
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
