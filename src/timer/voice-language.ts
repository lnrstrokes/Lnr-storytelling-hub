/**
 * voice-language.ts — read the pack in the language the phone speaks.
 *
 * WHAT WAS WRONG
 * --------------
 * Two small decisions inside `engine.js` combined into one loud bug for anyone
 * whose phone is not set to English:
 *
 *   1. `curatedVoices()` filtered the dropdown to `/^en/` voices and capped it
 *      at ten, so a Chinese phone could not SEE a Chinese voice to choose.
 *   2. `pickVoice()` returned `voiceList[0]` whenever the operator had not
 *      chosen one — and that first entry was always an English voice. So a
 *      Chinese JSON pack was read out by an English voice, on every device
 *      that had never touched the picker.
 *
 * The right place to fix that is the engine, but the engine is a 324 KB
 * single-file broadcast controller: re-uploading it whole to change two
 * functions risks the live stream for a settings default. This module does it
 * from the outside instead, the same pattern `pro-gate.ts` and
 * `segment-label.ts` already use:
 *
 *   · every installed voice is offered in both pickers, English first;
 *   · "Phone default voice" is the first entry and what an untouched device
 *     uses, so the phone's own TTS language wins (Chinese phone -> Chinese
 *     voice, English phone -> English voice);
 *   · at the moment of speaking, the stored choice is applied to the
 *     utterance — or cleared, so the phone decides.
 *
 * Delete the import and the call in `TimerApp.tsx` to remove it entirely.
 */

/** Same settings blob the engine writes (`STORE` in engine.js). */
const STORE = 'lnr_timer_v2';
const SELECT_IDS = ['voiceSelect', 'stVoiceSelect'];
const DEFAULT_LABEL = 'Phone default voice';

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

function allVoices(): SpeechSynthesisVoice[] {
  try {
    return synth()?.getVoices() || [];
  } catch {
    return [];
  }
}

/** The voice the operator picked, or '' for "let the phone decide". */
function savedVoiceName(): string {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return '';
    const blob = JSON.parse(raw) as { voiceName?: unknown };
    return typeof blob.voiceName === 'string' ? blob.voiceName : '';
  } catch {
    return '';
  }
}

/** Storage key owned by ReaderDock (the studio reader), which saves a voiceURI. */
const READER_VOICE = 'lnr_reader_voice';

/**
 * The one voice this device should speak with, or null for the phone default.
 *
 * The Voice & audio settings picker wins because it is the timer's own screen.
 * The studio ReaderDock's choice is honoured next, so clearing a voice here
 * can never silently erase a voice someone set in the dock.
 */
function chosenVoice(): SpeechSynthesisVoice | null {
  const voices = allVoices();
  const byName = savedVoiceName();
  if (byName) return voices.find((v) => v.name === byName) || null;
  try {
    const uri = localStorage.getItem(READER_VOICE) || '';
    if (uri) return voices.find((v) => v.voiceURI === uri) || null;
  } catch {
    /* private mode: fall through to the phone default */
  }
  return null;
}

/* ------------------------------------------------------------------ speaking */

/**
 * The script a line is written in, as a language prefix, or '' for Latin.
 *
 * A stored voice choice can be right for one pack and wrong for the other: an
 * English voice picked before a Chinese pack existed would otherwise read
 * every Chinese question in English, because the choice is applied to every
 * utterance unconditionally. Matching the choice against the script of the
 * text keeps that setting from fighting the pack.
 */
function scriptLang(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'ko';
  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)) return 'zh';
  return '';
}

/**
 * The voice for one utterance: the stored choice when it can speak this
 * script, otherwise the first installed voice that can, otherwise the phone's
 * own default (null). Latin text is left to the stored choice exactly as
 * before, so nothing changes for an English pack.
 */
function voiceForText(text: string): SpeechSynthesisVoice | null {
  const want = scriptLang(text);
  const chosen = chosenVoice();
  if (!want) return chosen;
  if (chosen && String(chosen.lang || '').toLowerCase().indexOf(want) === 0) return chosen;
  const match = allVoices().find(
    (v) => String(v.lang || '').toLowerCase().indexOf(want) === 0
  );
  return match || null;
}

/**
 * Decide the voice on the utterance itself, right before it is spoken.
 *
 * With no saved choice the engine's inherited `u.voice` is cleared: an
 * utterance with no voice and no lang uses the phone's default TTS voice and
 * language, which is exactly the behaviour a Chinese phone needs for a
 * Chinese pack. With a saved choice, that exact voice is applied — matching by
 * name across every installed voice, not just the English ones.
 */
function patchSpeak(): void {
  const s = synth();
  if (!s) return;
  const tagged = s as SpeechSynthesis & { __lnrVoicePatched?: boolean };
  if (tagged.__lnrVoicePatched) return;
  tagged.__lnrVoicePatched = true;

  const original = s.speak.bind(s);
  s.speak = function patchedSpeak(u: SpeechSynthesisUtterance): void {
    try {
      const voice = voiceForText(String(u.text || ''));
      if (voice) {
        u.voice = voice;
        if (voice.lang) u.lang = voice.lang;
      } else {
        u.voice = null;
        u.lang = '';
      }
    } catch {
      /* a failed override must never stop the narration */
    }
    original(u);
  };
}

/* -------------------------------------------------------------------- pickers */

interface Option {
  value: string;
  label: string;
}

/**
 * Every installed voice, English first, then the rest by language code.
 *
 * The list is de-duplicated by name+lang because Chrome often reports the same
 * voice twice (local and network). Nothing is filtered out: a phone with 40
 * voices shows 40 plus the default, which is a dropdown you scroll — far
 * better than a list that hides the language you are broadcasting in.
 */
function desiredOptions(): Option[] {
  const seen = new Set<string>();
  const english: SpeechSynthesisVoice[] = [];
  const rest: SpeechSynthesisVoice[] = [];

  allVoices().forEach((v) => {
    if (!v || !v.name) return;
    const key = `${v.name}|${v.lang || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (/^en(-|_|$)/i.test(v.lang || '')) english.push(v);
    else rest.push(v);
  });

  rest.sort((a, b) => {
    const la = String(a.lang || '');
    const lb = String(b.lang || '');
    if (la !== lb) return la < lb ? -1 : 1;
    const na = String(a.name || '');
    const nb = String(b.name || '');
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  return [
    { value: '', label: DEFAULT_LABEL },
    ...english.concat(rest).map((v) => ({ value: v.name, label: `${v.name} · ${v.lang}` }))
  ];
}

/** Fill one select, but only when its list is not already the right one. */
function reconcile(sel: HTMLSelectElement): void {
  const wanted = desiredOptions();
  const current = Array.from(sel.options);

  const same =
    current.length === wanted.length &&
    wanted.every((w, i) => current[i].value === w.value && current[i].textContent === w.label);

  if (!same) {
    const chosen = savedVoiceName();
    sel.innerHTML = '';
    wanted.forEach((w) => {
      const o = document.createElement('option');
      o.value = w.value;
      o.textContent = w.label;
      sel.appendChild(o);
    });
    sel.value = chosen && wanted.some((w) => w.value === chosen) ? chosen : '';
  }
}

function fillPickers(): void {
  SELECT_IDS.forEach((id) => {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (sel) reconcile(sel);
  });
}

/**
 * The engine writes its English-only list on boot and again whenever
 * `voiceschanged` fires. Watching the two selects means our list wins the race
 * without touching the engine, and re-applying only when the options actually
 * differ keeps it from looping.
 */
function watchPickers(): void {
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => fillPickers());
    SELECT_IDS.forEach((id) => {
      const sel = document.getElementById(id);
      if (sel) observer.observe(sel, { childList: true });
    });
  }
  synth()?.addEventListener('voiceschanged', fillPickers);
  /* Some engines publish voices a moment after boot, with no event at all. */
  [300, 1200, 3000].forEach((ms) => window.setTimeout(fillPickers, ms));
}

/* ---------------------------------------------------------------- spoken text */

/** Any CJK character means the pack is not English. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

interface QuizLike {
  q?: string;
  opts?: string[];
  correct?: number;
  ref?: string;
  insight?: string;
}

const LETTER = ['A', 'B', 'C', 'D'];

/** "Next question." / "The answer is B." — in the language of the question. */
function cjkQuestionParts(q: QuizLike, opts?: { announceNext?: boolean }): string[] {
  const announce = !opts || opts.announceNext !== false;
  const parts: string[] = [];
  if (announce) parts.push('\u4e0b\u4e00\u9898\u3002');
  if (q.q) parts.push(q.q);
  (q.opts || []).forEach((o, i) => {
    const letter = LETTER[i] || String(i + 1);
    parts.push(`${letter}\u3001${o}`);
  });
  return parts.filter((p) => p.trim());
}

function cjkRevealParts(q: QuizLike): string[] {
  const parts: string[] = [];
  const letter = LETTER[q.correct ?? -1] || '';
  const answer = (q.opts || [])[q.correct ?? -1] || '';
  parts.push(`\u6b63\u786e\u7b54\u6848\u662f ${letter}\u3002${answer}`);
  if (q.ref) parts.push(`\u51fa\u5904\uff1a${q.ref}`);
  if (q.insight) parts.push(q.insight);
  return parts.filter((p) => p.trim());
}

/**
 * Leave a Chinese script alone when building the spoken text.
 *
 * `speech.js` deliberately speaks digits, years and verse references as English
 * words ("1851" -> "eighteen fifty-one") and prefixes questions with "Next
 * question." — correct for an English pack, and the reason a Chinese pack was
 * still partly read in English even once the voice was right. The module is
 * captured by the engine at boot, so replacing the two entry points on that
 * same object changes what the narrator says without touching the engine. The
 * English path is passed straight through to the original functions.
 */
function patchSpeechApi(): void {
  const api = (window as unknown as { LNR_SPEECH?: Record<string, unknown> }).LNR_SPEECH;
  if (!api || api.__lnrCjk === true) return;
  api.__lnrCjk = true;

  const originalQuestion = api.questionParts as (q: QuizLike, o?: unknown) => string[];
  const originalReveal = api.revealParts as (q: QuizLike) => string[];

  if (typeof originalQuestion === 'function') {
    api.questionParts = (q: QuizLike, o?: unknown): string[] =>
      q && CJK.test(String(q.q || ''))
        ? cjkQuestionParts(q, o as { announceNext?: boolean })
        : originalQuestion.call(api, q, o);
  }

  if (typeof originalReveal === 'function') {
    api.revealParts = (q: QuizLike): string[] => {
      const stem = q ? String(q.q || '') + String((q.opts || []).join(' ')) + String(q.ref || '') : '';
      return q && CJK.test(stem) ? cjkRevealParts(q) : originalReveal.call(api, q);
    };
  }
}

/* ----------------------------------------------------------------------- note */

/**
 * The onboarding note under the picker still told people to download English
 * voices. One sentence above it explains the new default instead of shipping a
 * 65 KB HTML file again.
 */
function annotateGuide(): void {
  const notes = Array.from(document.querySelectorAll<HTMLElement>('.schema-note'));
  notes.forEach((note) => {
    if (note.dataset.lnrVoice === '1') return;
    if (!/Android \(Samsung\)/.test(note.textContent || '')) return;
    note.dataset.lnrVoice = '1';
    const lead = document.createElement('span');
    lead.innerHTML =
      '<strong>Phone default voice</strong> uses whatever language your phone\u2019s ' +
      'text-to-speech is set to \u2014 a Chinese pack reads in Chinese on a Chinese phone. ' +
      'Pick a named voice only to force a language or accent. ';
    note.insertBefore(lead, note.firstChild);
  });
}

/* --------------------------------------------------------------------- install */

export function installVoiceLanguages(_host?: HTMLElement): void {
  patchSpeechApi();
  patchSpeak();
  fillPickers();
  watchPickers();
  annotateGuide();
}
