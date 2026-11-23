/**
 * voice-language.ts - one voice per device, chosen by the operator, never
 * decided from the words on screen.
 *
 * WHAT WAS WRONG (and why the guessing is gone)
 * ---------------------------------------------
 * An earlier version of this module inspected the script of every line just
 * before it was spoken and switched to a matching voice: any CJK character in
 * the text pulled the reader onto a Chinese voice, and the announcement around
 * a question ("Next question.", the answer line) was rewritten in Chinese to
 * match. One Chinese character inside an English question - a name, a quoted
 * word, a borrowed phrase - was therefore enough to change the language of a
 * live service mid-stream and never change back.
 *
 * Language must not be inferred. It is a decision, and the only place it is
 * allowed to come from is this device.
 *
 * WHAT REMAINS
 * ------------
 *   - both pickers list every installed voice, English first, so a Chinese
 *     voice can actually be chosen on a Chinese phone;
 *   - the chosen voice is applied to every utterance, unchanged, whatever the
 *     text says - no per-line decisions, no rewriting of the spoken words;
 *   - with nothing chosen ("Phone default voice"), the utterance is left to
 *     the phone's own text-to-speech, which is a device setting too.
 *
 * Nothing here reads text, sets a language, or reacts to a pack. Delete the
 * import and the call in TimerApp.tsx to remove it entirely.
 */

/** Same settings blob the engine writes (`STORE` in engine.js). */
const STORE = 'lnr_timer_v2';
const SELECT_IDS = ['voiceSelect', 'stVoiceSelect'];
const DEFAULT_LABEL = 'Phone default voice';

/** Storage key owned by ReaderDock (the studio reader), which saves a voiceURI. */
const READER_VOICE = 'lnr_reader_voice';

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

/** The voice this device remembers, or '' for "let the phone decide". */
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
 * Apply the device's choice to every utterance.
 *
 * No text is inspected and no `lang` is assigned: the voice is the same for
 * every line of every pack, so the reader cannot change language part-way
 * through a service. With no choice stored the utterance keeps no voice at
 * all, which leaves it to the phone's own text-to-speech setting.
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
      u.voice = chosenVoice();
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
 * voices shows 40 plus the default, which is a dropdown you scroll - far
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
    ...english.concat(rest).map((v) => ({ value: v.name, label: `${v.name} \u00b7 ${v.lang}` }))
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

/* ----------------------------------------------------------------------- note */

/**
 * The onboarding note under the picker still told people to download English
 * voices. One sentence above it explains what the setting means now.
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
      'text-to-speech is set to. Pick a named voice to force a language or accent; ' +
      'the reader keeps that voice for the whole session and never changes it by itself. ';
    note.insertBefore(lead, note.firstChild);
  });
}

/* --------------------------------------------------------------------- install */

export function installVoiceLanguages(_host?: HTMLElement): void {
  patchSpeak();
  fillPickers();
  watchPickers();
  annotateGuide();
}
