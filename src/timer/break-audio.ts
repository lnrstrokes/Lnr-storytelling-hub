/* ==========================================================================
   break-audio.ts — keeps sound in the room during a quiz/anecdote break
   --------------------------------------------------------------------------
   A break pauses the clip, so the video's own audio stops and the stream
   drops into silence for 20-40 seconds. That silence is what makes viewers
   leave. This module fills it with a quiet, slow music bed.

   Why generated instead of an MP3 file:

     · nothing to download, so it works offline in the installed PWA
     · no licence, no extra asset in the build
     · it can follow the video: fade in with the break card and fade out
       just before the clip resumes, so there is never a hard cut

   Four soft pad voices (Fmaj7 -> G -> Am -> C) through a low-pass filter,
   two sparse bell notes per chord, and a short delay for space. Master level
   is deliberately low: it sits under the speaker, not over him.

   Everything is fail-open. If Web Audio is missing or the context cannot
   start, the break simply runs as it did before — silent, never stuck.
   ========================================================================== */

const CHORDS: number[][] = [
  /* Fmaj7 */ [174.61, 261.63, 329.63, 440.0],
  /* G     */ [196.0, 293.66, 392.0, 493.88],
  /* Am    */ [220.0, 329.63, 440.0, 523.25],
  /* C     */ [261.63, 392.0, 523.25, 659.25]
];

/* One chord every 7.5s — slow enough to read a question over. */
const CHORD_SECONDS = 7.5;
const PAD_LEVEL = 0.05;
const BELL_LEVEL = 0.03;
const MASTER_LEVEL = 0.85;

let ctx: AudioContext | null = null;
let filter: BiquadFilterNode | null = null;
let bus: GainNode | null = null;
let pumpTimer = 0;
let nextChordAt = 0;
let chordIndex = 0;
let running = false;

function makeGraph(context: AudioContext): void {
  filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500;
  filter.Q.value = 0.4;

  bus = context.createGain();
  bus.gain.value = 0.0001;

  /* A single short delay with a little feedback gives the pad a room. */
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.32;
  const feedback = context.createGain();
  feedback.gain.value = 0.26;
  const wet = context.createGain();
  wet.gain.value = 0.2;

  filter.connect(bus);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(bus);
  bus.connect(context.destination);
}

function padNote(freq: number, start: number, kind: OscillatorType): void {
  if (!ctx || !filter) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind;
  osc.frequency.value = freq;
  osc.detune.value = kind === 'sine' ? -4 : 5;

  const attack = 1.6;
  const hold = CHORD_SECONDS - 0.8;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(PAD_LEVEL, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + hold);

  osc.connect(gain);
  gain.connect(filter);
  osc.start(start);
  osc.stop(start + hold + 0.05);
}

function bellNote(freq: number, start: number): void {
  if (!ctx || !filter) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(BELL_LEVEL, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);
  osc.connect(gain);
  gain.connect(filter);
  osc.start(start);
  osc.stop(start + 2.5);
}

function scheduleChord(start: number, notes: number[]): void {
  notes.forEach((freq, i) => padNote(freq, start, i === 0 ? 'sine' : 'triangle'));
  /* Two quiet bells, an octave up, never on the downbeat. */
  bellNote(notes[2] * 2, start + 1.6);
  bellNote(notes[3] * 2, start + 4.2);
}

function pump(): void {
  if (!running || !ctx) return;
  const horizon = ctx.currentTime + CHORD_SECONDS + 1;
  let guard = 0;
  while (nextChordAt < horizon && guard < 4) {
    scheduleChord(nextChordAt, CHORDS[chordIndex % CHORDS.length]);
    chordIndex += 1;
    nextChordAt += CHORD_SECONDS;
    guard += 1;
  }
}

/** Fades the bed in and keeps it looping until stopBreakBed(). */
export function startBreakBed(): void {
  try {
    if (running) return;
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    if (!ctx) {
      ctx = new Ctor();
      makeGraph(ctx);
    }
    if (!ctx || !bus) return;
    if (ctx.state === 'suspended') {
      const resumed = ctx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
    }

    running = true;
    chordIndex = 0;
    const now = ctx.currentTime;
    nextChordAt = now + 0.2;

    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(MASTER_LEVEL, now + 1.5);

    pump();
    pumpTimer = window.setInterval(pump, 1500);
  } catch {
    running = false;
  }
}

/** Fades the bed out. Idempotent, and safe if the bed never started. */
export function stopBreakBed(): void {
  try {
    if (pumpTimer) {
      window.clearInterval(pumpTimer);
      pumpTimer = 0;
    }
    if (!running || !ctx || !bus) {
      running = false;
      return;
    }
    running = false;
    const now = ctx.currentTime;
    const level = Math.max(0.0001, bus.gain.value);
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(level, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + 0.9);

    /* Let the fade finish, then park the context so it costs nothing while
       the video plays. */
    window.setTimeout(() => {
      if (running || !ctx || ctx.state !== 'running') return;
      const idle = ctx.suspend();
      if (idle && typeof idle.catch === 'function') idle.catch(() => {});
    }, 1100);
  } catch {
    running = false;
  }
}
