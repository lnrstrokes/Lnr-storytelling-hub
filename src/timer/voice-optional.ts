/**
 * voice-optional.ts - text-to-speech is a convenience, never a requirement.
 *
 * WHY THIS EXISTS
 * ---------------
 * The reader is the phone's own text-to-speech. Plenty of operators never use
 * it: they narrate the pack themselves, upload recorded narration (Storytelling
 * Engine -> "Upload speech audio"), or run prerecorded clips. Nothing in that
 * setup needs a voice, and the engine is already correct about it - a block
 * advances on its own timers when the reader is off, and `speechBusy()` returns
 * false at once when the device has no speech synthesis at all.
 *
 * What was missing was the app saying so. Both voice panels read as if a voice
 * were mandatory, and a device without text-to-speech was left with a disabled
 * "Voice: unsupported" button and no explanation of what still works.
 *
 * This module only adds words: one short note beside each voice picker, plus a
 * plain explanation on a device that has no TTS. It touches no engine state, so
 * it cannot change timing. Delete the import and the call in TimerApp.tsx to
 * remove every trace.
 */

const OPTIONAL_NOTE =
  'Optional. If you narrate a pack yourself, switch "Read questions aloud" off ' +
  '\u2014 every block still runs on its own timers, and nothing is read in the ' +
  'phone\u2019s voice. Uploaded narration audio and prerecorded clips keep working ' +
  'either way.';

const NO_TTS_NOTE =
  'This device gives the browser no text-to-speech, so the reader is unavailable ' +
  'here. The quiz still runs: each question appears with its own timer, and you ' +
  'can read it live or upload recorded narration under Storytelling Engine ' +
  '\u2192 Upload speech audio.';

const PANELS: Array<{ select: string; key: string }> = [
  { select: 'stVoiceSelect', key: 'settings' },
  { select: 'voiceSelect', key: 'drawer' },
];

function hasSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** A note in the app's existing note style, so no stylesheet change is needed. */
function note(id: string, text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'dsec-note';
  p.id = id;
  p.textContent = text;
  return p;
}

/** One note per picker, directly under its row. Idempotent. */
function annotatePickers(): void {
  PANELS.forEach(({ select, key }) => {
    const sel = document.getElementById(select);
    if (!sel) return;
    const id = `lnrVoiceOptional-${key}`;
    if (document.getElementById(id)) return;

    const row = sel.closest('label') || sel.parentElement;
    const parent = (row || sel).parentNode;
    if (!parent) return;
    parent.insertBefore(note(id, OPTIONAL_NOTE), (row || sel).nextSibling);
  });
}

/** Explain the missing reader once, where the reader is configured. */
function explainMissingSpeech(): void {
  if (hasSpeech()) return;
  if (document.getElementById('lnrNoSpeechNote')) return;
  const card = document.getElementById('stVoiceSelect')?.closest('.settings-card');
  const target = card || document.getElementById('pageSettings');
  if (!target) return;
  target.appendChild(note('lnrNoSpeechNote', NO_TTS_NOTE));
}

export function installVoiceOptional(_host?: HTMLElement): void {
  annotatePickers();
  explainMissingSpeech();
}
