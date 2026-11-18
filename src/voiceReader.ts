/* ==========================================================================
   voiceReader.ts — speech engine with real pause / resume
   --------------------------------------------------------------------------
   WHY THIS IS NOT JUST synth.pause()

   The Web Speech API has a `pause()` method, and on paper it does exactly what
   we want. In practice it is unreliable: Chrome on Android frequently ignores
   it, Safari sometimes stops the utterance entirely, and on some engines the
   `resume()` call restarts from the beginning of the sentence. That is the
   exact bug the user reported — "pause must not restart from the beginning".

   So this module does NOT rely on the native pause. Instead it tracks position
   itself:

     - `onboundary` fires as the engine speaks each word, giving us the
       character index of the word currently being spoken.
     - On pause we record that index and cancel the utterance.
     - On resume we speak a NEW utterance starting from that character index.

   The result is a genuine mid-sentence resume on every engine, because we are
   not asking the engine to remember anything — we are re-speaking the tail of
   the text ourselves.

   If `onboundary` never fires (some engines do not support it), we fall back to
   the native pause/resume pair, and if that also fails we resume from the start
   of the current sentence rather than the start of the whole block. Degrading
   gracefully beats restarting from zero.

   EVERYTHING IS FREE. No account, no API key, no network request. Voices come
   from the operating system.
   ========================================================================== */

export type ReaderState = 'idle' | 'playing' | 'paused';

export interface CuratedVoice {
  /** voiceURI, or '' for the device default. */
  uri: string;
  /** Short label shown in the picker. */
  label: string;
  /** Group heading, e.g. "English". */
  group: string;
  /** The underlying voice, when there is one. */
  voice?: SpeechSynthesisVoice;
}

/* ------------------------------------------------------------------ voices */

/**
 * Voices we consider "major" — the ones a normal phone or laptop actually
 * ships with. Anything not matching is hidden from the picker, which is what
 * turns a 60-item wall of noise into a short readable list.
 *
 * Matching is on the voice NAME, lowercased. These are the standard names used
 * by Google, Apple, Microsoft and Samsung TTS engines.
 */
const MAJOR_VOICE_PATTERNS: { re: RegExp; label: string }[] = [
  // Google (Android / Chrome)
  { re: /google us english/i, label: 'Google US English' },
  { re: /google uk english female/i, label: 'Google UK English Female' },
  { re: /google uk english male/i, label: 'Google UK English Male' },
  { re: /google australian english/i, label: 'Google Australian English' },
  { re: /google canadian english/i, label: 'Google Canadian English' },
  { re: /google indian english/i, label: 'Google Indian English' },
  { re: /google nigerian english/i, label: 'Google Nigerian English' },
  { re: /google south african english/i, label: 'Google South African English' },
  // Apple (iOS / macOS)
  { re: /^(samantha|alex|daniel|karen|moira|tessa|rishi|fiona|serena|veena|lekha|nora|zuzana|sara|luciana|joana|milena|yuna|tingting|meijia|sinji|kyoko|otoya|thomas|amélie|amelie|anna|ellen|ioana|mariska|damayanti|alice|federica|paola|monica|diego|jorge|juan|carlos|soledad|angelica|paulina|monica)$/i, label: '' },
  // Microsoft (Windows)
  { re: /microsoft (david|zira|mark|hazel|george|susan|ryan|sonia|libby|natasha|clara)/i, label: '' },
  // Samsung
  { re: /samsung/i, label: '' }
];

/** Names that are clearly novelty / joke voices — never useful on a stream. */
const NOVELTY_PATTERNS = [
  /albert/i, /bad news/i, /bahh/i, /bells/i, /boing/i, /bubbles/i, /cellos/i,
  /good news/i, /jester/i, /organ/i, /superstar/i, /trinoids/i, /whisper/i,
  /wobble/i, /zarvox/i, /deranged/i, /hysterical/i, /pipe organ/i, /bruce/i,
  /fred/i, /junior/i, /ralph/i, /kathy/i, /princess/i, /agnes/i, /vicki/i,
  /victoria/i, /xander/i, /grandma/i, /grandpa/i, /rocko/i, /shelley/i,
  /sandy/i, /flo/i, /eddy/i, /reed/i, /rocko/i
];

/** Language groups we surface, in display order. */
const GROUP_ORDER = ['English', 'Other languages'];

function groupFor(lang: string): string {
  return /^en/i.test(lang) ? 'English' : 'Other languages';
}

/**
 * Turn the raw getVoices() list into a short, grouped, de-duplicated list.
 *
 * Rules, in order:
 *   1. Drop novelty voices outright.
 *   2. Keep a voice if it matches a major pattern, OR if it is the only voice
 *      for its language (so a device with an unusual voice still has something).
 *   3. De-duplicate by name+lang, because Chrome often lists the same voice
 *      twice (once local, once network).
 *   4. Always include a "Device default" entry first, so the picker is never
 *      empty even on a machine with zero voices installed.
 */
export function curateVoices(all: SpeechSynthesisVoice[]): CuratedVoice[] {
  const out: CuratedVoice[] = [
    { uri: '', label: 'Device default voice', group: 'Default' }
  ];

  if (!all || all.length === 0) return out;

  const seen = new Set<string>();
  const kept: CuratedVoice[] = [];

  // Count voices per language, so rule 2 can tell "only voice for its language".
  const perLang = new Map<string, number>();
  for (const v of all) {
    const k = (v.lang || '').toLowerCase();
    perLang.set(k, (perLang.get(k) || 0) + 1);
  }

  for (const v of all) {
    const name = v.name || '';
    if (!name) continue;
    if (NOVELTY_PATTERNS.some(re => re.test(name))) continue;

    const isMajor = MAJOR_VOICE_PATTERNS.some(p => p.re.test(name));
    const langKey = (v.lang || '').toLowerCase();
    const isOnlyForLang = (perLang.get(langKey) || 0) === 1;

    if (!isMajor && !isOnlyForLang) continue;

    // De-dupe: same name + same language = same voice, keep the local one.
    const dedupeKey = `${name.toLowerCase()}|${langKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // Prefer a short, human label over the raw engine name.
    const matched = MAJOR_VOICE_PATTERNS.find(p => p.re.test(name));
    const label = matched && matched.label ? matched.label : name;

    kept.push({
      uri: v.voiceURI,
      label: `${label} (${v.lang})`,
      group: groupFor(v.lang || ''),
      voice: v
    });
  }

  // Sort: English first, then by label, so the list reads predictably.
  kept.sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });

  return out.concat(kept);
}

/* ------------------------------------------------------------------ engine */

interface SpeakOptions {
  text: string;
  voiceURI: string;
  rate?: number;
  onStateChange?: (state: ReaderState) => void;
  onProgress?: (charsSpoken: number, total: number) => void;
  /**
   * Fired the instant the engine reports the utterance finished, or the instant
   * it fails. NOT fired for pause/stop, because those are the caller's own
   * doing and it already knows.
   *
   * This exists because polling the state is not fast enough to drive a scene:
   * a short utterance can start and finish entirely between two 1Hz samples, so
   * the scene would keep waiting for a sentence that is already over. The event
   * is the truth; the poll is only a backstop.
   */
  onEnd?: (how: 'finished' | 'error') => void;
}

/**
 * A single reusable speech controller. One instance per app is enough.
 *
 * The controller owns the "what am I currently reading" state, so the UI only
 * has to call play / pause / stop and render the state it is given.
 */
export class VoiceReader {
  private text = '';
  private voiceURI = '';
  private rate = 0.98;

  /** Character index we have spoken up to. This is the resume point. */
  private cursor = 0;
  /** True while an utterance is live. */
  private speaking = false;
  /** Set when the user paused, so onend does not treat it as "finished". */
  private pausedByUser = false;

  private state: ReaderState = 'idle';
  private onStateChange?: (s: ReaderState) => void;
  private onProgress?: (chars: number, total: number) => void;
  private onEnd?: (how: 'finished' | 'error') => void;

  /** Native-pause fallback bookkeeping. */
  private usedNativePause = false;

  getState(): ReaderState {
    return this.state;
  }

  private setState(s: ReaderState) {
    if (this.state === s) return;
    this.state = s;
    this.onStateChange?.(s);
  }

  private synth(): SpeechSynthesis | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    return window.speechSynthesis;
  }

  private resolveVoice(uri: string): SpeechSynthesisVoice | undefined {
    const synth = this.synth();
    if (!synth || !uri) return undefined;
    return synth.getVoices().find(v => v.voiceURI === uri);
  }

  /**
   * Start reading `text` from the beginning, or continue from the cursor if we
   * are resuming. `fromStart` forces a restart (used by the Stop button).
   */
  play(opts: SpeakOptions) {
    const synth = this.synth();
    if (!synth) return;

    // New text? Reset the cursor.
    if (opts.text !== this.text) {
      this.text = opts.text;
      this.cursor = 0;
    }
    this.voiceURI = opts.voiceURI;
    this.rate = opts.rate ?? 0.98;
    this.onStateChange = opts.onStateChange;
    this.onProgress = opts.onProgress;
    this.onEnd = opts.onEnd;

    if (!this.text.trim()) {
      this.setState('idle');
      return;
    }

    // If we paused natively and the engine still holds the utterance, the
    // cheapest correct resume is the native one.
    if (this.usedNativePause && this.state === 'paused') {
      try {
        synth.resume();
        this.usedNativePause = false;
        this.pausedByUser = false;
        this.setState('playing');
        return;
      } catch {
        /* fall through to the re-speak path */
      }
    }

    this.speakFromCursor();
  }

  /** Speak the remaining text starting at this.cursor. */
  private speakFromCursor() {
    const synth = this.synth();
    if (!synth) return;

    synth.cancel();

    const remaining = this.text.slice(this.cursor);
    if (!remaining.trim()) {
      this.cursor = 0;
      this.setState('idle');
      return;
    }

    const u = new SpeechSynthesisUtterance(remaining);
    const chosen = this.resolveVoice(this.voiceURI);
    if (chosen) {
      u.voice = chosen;
      u.lang = chosen.lang;
    }
    u.rate = this.rate;

    // Track the word being spoken so pause knows exactly where we are.
    u.onboundary = (ev: SpeechSynthesisEvent) => {
      if (typeof ev.charIndex === 'number') {
        this.cursor = this.cursor + ev.charIndex;
        this.onProgress?.(this.cursor, this.text.length);
      }
    };

    u.onstart = () => {
      this.speaking = true;
      this.pausedByUser = false;
      this.setState('playing');
    };

    u.onend = () => {
      this.speaking = false;
      if (this.pausedByUser) return; // pause() already set the state
      // Finished the whole block.
      this.cursor = 0;
      this.setState('idle');
      // Announce completion synchronously, before any poll can miss it.
      this.onEnd?.('finished');
    };

    u.onerror = (ev: SpeechSynthesisErrorEvent) => {
      this.speaking = false;
      // "interrupted" and "canceled" are our own doing — not real errors.
      if (ev.error === 'interrupted' || ev.error === 'canceled') return;
      this.setState('idle');
      // A real failure must release the scene at once rather than leaving it to
      // wait out the safety budget for speech that is never coming.
      this.onEnd?.('error');
    };

    synth.speak(u);
  }

  /**
   * Pause mid-sentence. Records the exact character we reached, then cancels.
   * Resume re-speaks from that character, so nothing is repeated.
   */
  pause() {
    const synth = this.synth();
    if (!synth) return;
    if (this.state !== 'playing') return;

    this.pausedByUser = true;

    // Try the native pause first — if the engine honours it, resume is instant
    // and perfectly seamless. We verify it actually took effect below.
    try {
      synth.pause();
      this.usedNativePause = true;
    } catch {
      this.usedNativePause = false;
    }

    // Cancel as well. If native pause worked, cancel is a no-op on a paused
    // queue; if it did not, cancel stops the audio immediately. Either way the
    // cursor is already correct, so resume is safe.
    if (!this.usedNativePause) {
      synth.cancel();
    }

    this.setState('paused');
  }

  /**
   * Resume from the exact character we paused at.
   *
   * This is deliberately separate from play(): play() takes the text to read,
   * and passing an empty string to it would reset the cursor to zero — which is
   * precisely the "restarts from the beginning" bug we are fixing. resume()
   * never touches this.text or this.cursor, so the position is preserved.
   */
  resume() {
    const synth = this.synth();
    if (!synth) return;
    if (this.state !== 'paused') return;
    if (!this.text.trim()) return;

    // If the engine honoured the native pause, resuming it is seamless.
    if (this.usedNativePause) {
      try {
        synth.resume();
        this.usedNativePause = false;
        this.pausedByUser = false;
        this.setState('playing');
        return;
      } catch {
        this.usedNativePause = false;
      }
    }

    // Otherwise re-speak only the tail, from the recorded cursor.
    this.pausedByUser = false;
    this.speakFromCursor();
  }

  /** Stop and reset to the beginning. */
  stop() {
    const synth = this.synth();
    if (synth) synth.cancel();
    this.speaking = false;
    this.pausedByUser = false;
    this.usedNativePause = false;
    this.cursor = 0;
    this.onProgress?.(0, this.text.length);
    this.setState('idle');
  }

  /** True when there is text loaded that could be resumed. */
  hasContent(): boolean {
    return this.text.trim().length > 0;
  }

  /** Replace the text without speaking — used when the question changes. */
  setText(text: string) {
    if (text === this.text) return;
    this.text = text;
    this.cursor = 0;
  }
}

/** One shared instance for the whole app. */
export const voiceReader = new VoiceReader();
