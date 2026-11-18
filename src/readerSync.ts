/* ==========================================================================
   readerSync.ts — makes the scene wait for the voice
   --------------------------------------------------------------------------
   THE BUG THIS FIXES

   App.tsx advances the scene on two fixed one-second clocks:

     thinking phase: 20 ticks, then reveal
     reveal phase:    6 ticks, then next question

   Neither clock knows that a voice is speaking. The reveal clock starts the
   instant the answer appears and fires 6 seconds later no matter what, so any
   answer plus reference that takes longer than six seconds to read aloud is
   cut off mid-sentence. Long references were worst: the reader would get
   through "Correct answer: ..." and die halfway through the citation.

   The 6 seconds is not a guess — it is `setRevealSeconds(6)` in App.tsx, and
   it is the ONLY thing that decides when the next question appears. The voice
   runs on a completely separate clock (the operating system's speech engine),
   and nothing connected the two.

   WHAT THIS MODULE DOES

   It sits between the two clocks. Before the scene is allowed to tick, it is
   asked "is the reader still talking?". If the answer is yes, the tick is
   dropped and the countdown simply does not move. The scene therefore cannot
   advance while a sentence is in flight.

   HOLDING IS OPTIMISTIC BUT NEVER UNBOUNDED

   A gate that waits for a voice engine is a gate that can wait forever. Speech
   synthesis fails in perfectly ordinary ways, so every one of these is handled
   explicitly and each has its own exit:

     - The engine never starts (blocked, no voices installed, silent failure).
       We wait only START_GRACE_MS after asking, then give up and let the
       scene run. A viewer sees at most 2.6s of extra dwell, never a stall.
     - The engine starts and then dies mid-sentence without firing onend.
       The per-text budget expires and releases the scene.
     - The engine reports an error. voiceReader goes idle; if it never played,
       that is the "never started" case above.
     - The operator pauses or stops the reader. We release IMMEDIATELY — the
       scene then advances on its normal timer, which is what was asked for.
     - The tab goes to the background (phone screen lock, app switch). We
       release instead of holding a scene nobody can see.
     - The text is empty. Nothing to read, nothing to wait for.

   The budget is derived from the text length at a deliberately slow narration
   pace, so it is always comfortably longer than the read itself but never
   unbounded.
   ========================================================================== */

import { voiceReader } from './voiceReader';

export type ScenePhase = 'thinking' | 'reveal';

/** Why the scene was released. Shown to the operator, and useful in tests. */
export type ReleaseReason =
  | 'finished' // the reader reached the end of the text
  | 'budget' // safety cap hit — engine hung
  | 'never-started' // engine never began speaking
  | 'paused' // operator paused the reader
  | 'stopped' // operator stopped the reader, or a new scene replaced this one
  | 'empty' // nothing to read
  | 'hidden' // tab went to the background
  | 'replaced'; // a newer hold took over

/* --------------------------------------------------------------- constants */

/**
 * How long we wait for speech that has been requested but has not begun.
 * Chrome on Android can take over a second to spin up an utterance, so this
 * cannot be tight; but a blocked engine fails silently, so it cannot be
 * generous either. 2.6s covers a slow start and bounds the worst case.
 */
const START_GRACE_MS = 2600;

/** Absolute ceiling on any single hold. No scene can ever wait longer. */
const MAX_HOLD_MS = 45_000;

/** Floor, so a two-word answer still gets a beat before the next question. */
const MIN_HOLD_MS = 3_500;

/**
 * Conservative narration pace at the reader's default rate of 0.98.
 *
 * Real engines run at roughly 16 characters/second (about 175 words per minute
 * at 5.5 characters per word). This is set well below that on purpose: the cap
 * exists to catch a HUNG engine, and the cost of guessing too low is only that
 * a broken engine holds the scene a few seconds longer. The cost of guessing
 * too high is the bug we are fixing — a slow voice cut off mid-reference on a
 * live stream. So the estimate is deliberately pessimistic.
 */
const CHARS_PER_SEC = 11;

/** Room for the final syllable to actually land before the scene cuts. */
const TAIL_PAD_MS = 800;

/** The safety budget for a given block of text. */
export function budgetFor(text: string): number {
  const raw = (text.length / CHARS_PER_SEC) * 1000 + TAIL_PAD_MS;
  return Math.min(MAX_HOLD_MS, Math.max(MIN_HOLD_MS, raw));
}

/* ------------------------------------------------------------------- state */

interface Hold {
  phase: ScenePhase;
  /** The text being read, kept for diagnostics and tests. */
  text: string;
  startedAt: number;
  budget: number;
  /** True once we have actually observed the engine speaking. */
  sawPlaying: boolean;
}

let hold: Hold | null = null;
let lastReason: ReleaseReason | null = null;

const holdListeners = new Set<(holding: boolean) => void>();
const releaseListeners = new Set<(reason: ReleaseReason) => void>();

/** Subscribe to "is the scene being held right now". Returns an unsubscribe. */
export function onHoldChange(cb: (holding: boolean) => void): () => void {
  holdListeners.add(cb);
  return () => {
    holdListeners.delete(cb);
  };
}

/** Subscribe to every release, with its reason. */
export function onRelease(cb: (reason: ReleaseReason) => void): () => void {
  releaseListeners.add(cb);
  return () => {
    releaseListeners.delete(cb);
  };
}

/** Why the most recent hold ended. `null` if nothing has been held yet. */
export function lastReleaseReason(): ReleaseReason | null {
  return lastReason;
}

/** True when the scene is currently frozen waiting for speech. */
export function isHolding(): boolean {
  return hold !== null;
}

function emitHold(holding: boolean) {
  for (const cb of holdListeners) cb(holding);
}

/** Drop the hold and tell everyone why. Idempotent. */
export function releaseHold(reason: ReleaseReason) {
  if (!hold) return;
  hold = null;
  lastReason = reason;
  emitHold(false);
  for (const cb of releaseListeners) cb(reason);
}

/**
 * A new scene is on screen and its text is about to be read.
 *
 * Called by ReaderDock immediately before it asks the voice engine to speak.
 * Calling it twice for the same scene simply restarts the window, which is
 * what we want when the reader re-reads after a pause.
 */
export function beginHold(phase: ScenePhase, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    // Nothing to read: never hold, and clear any previous hold so a stale
    // scene cannot keep the clock frozen.
    releaseHold('empty');
    return;
  }
  hold = {
    phase,
    text: trimmed,
    startedAt: Date.now(),
    budget: budgetFor(trimmed),
    sawPlaying: false
  };
  lastReason = null;
  emitHold(true);
}

/** Drop any hold belonging to a scene that is no longer on screen. */
export function releaseStale(phase: ScenePhase) {
  if (hold && hold.phase !== phase) releaseHold('replaced');
}

/**
 * THE GATE. Asked once per second by the scene clock in App.tsx.
 *
 * `true` means "the reader is still talking — do not advance the scene".
 * Every path through this function either returns that, or releases the hold
 * and returns `false`, so it can never trap the clock.
 */
export function holdsClock(phase: ScenePhase): boolean {
  if (!hold) return false;

  // A hold started for the other phase is stale by definition.
  if (hold.phase !== phase) {
    releaseHold('replaced');
    return false;
  }

  const now = Date.now();
  const elapsed = now - hold.startedAt;
  const state = voiceReader.getState();

  // The absolute cap, checked first: a hung engine that still reports
  // 'playing' must not be able to freeze the stream.
  if (elapsed >= hold.budget) {
    // Stop the stuck utterance so it cannot talk over the next scene.
    try {
      voiceReader.stop();
    } catch {
      /* the engine is already broken; nothing useful to do */
    }
    releaseHold('budget');
    return false;
  }

  // The operator paused. They want the scene to move on its own timer now.
  if (state === 'paused') {
    releaseHold('paused');
    return false;
  }

  if (state === 'playing') {
    hold.sawPlaying = true;
    return true;
  }

  // state === 'idle'
  if (hold.sawPlaying) {
    // It spoke and has now stopped: the sentence is finished.
    releaseHold('finished');
    return false;
  }

  // Never started. Give the engine its grace period, then move on.
  if (elapsed >= START_GRACE_MS) {
    releaseHold('never-started');
    return false;
  }

  // Still inside the grace window: keep the scene still for a moment longer.
  return true;
}

/* -------------------------------------------------------- ambient releases */

/**
 * If the tab is hidden the scene is not being watched, and ReaderDock stops
 * the voice on hide anyway. Release rather than hold a clock nobody sees.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && hold) releaseHold('hidden');
  });
}

/* ------------------------------------------------------------------- tests */

/**
 * Reset for automated tests. Not used by the app.
 */
export function _resetForTests() {
  hold = null;
  lastReason = null;
}

/** Inspect the current hold without touching it. Test helper. */
export function _peekForTests() {
  return hold ? { ...hold, ageMs: Date.now() - hold.startedAt } : null;
}
