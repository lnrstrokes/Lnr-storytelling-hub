/* ==========================================================================
   ReaderDock.tsx — onscreen voice reader, v3
   --------------------------------------------------------------------------
   WHAT CHANGED FROM v2, AND WHY

   v2 could read, pause and stop, but it narrated on its own clock and nothing
   connected it to the scene. It also defaulted to "Auto Off", so it did
   nothing until someone pressed a button. Both are fixed here:

   1. AUTO ON BY DEFAULT. The reader speaks as soon as a question is on screen,
      with no tap. If the operator has switched it off before, that choice is
      remembered and respected.

   2. THE SCENE WAITS FOR THE VOICE. Reveal text is read answer first, then the
      reference, and a HOLD is registered before speaking (see readerSync.ts).
      While that hold is live the scene's one-second clock is frozen, so the
      next question cannot appear until the sentence has finished. The hold is
      released on finish, on pause, on stop, or by a safety cap — never held
      open on a broken voice engine.

   3. STREAM-SAFE. A control turns the docks off the page entirely so a
      screencast cannot capture them, while keyboard shortcuts keep them
      operable. See streamMode.ts for how the operator keeps control while the
      buttons are invisible.

   The reader reads what is on screen; it does not own the content. Symbols are
   stripped before speaking so the voice never says "star" or "dash".
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Volume2, Radio, Ear } from 'lucide-react';
import {
  voiceReader,
  curateVoices,
  type CuratedVoice,
  type ReaderState
} from './voiceReader';
import { beginHold, releaseHold, onHoldChange, onRelease, isHolding } from './readerSync';
import { isStreamMode, setStreamMode, onStreamModeChange } from './streamMode';

const STORAGE_VOICE = 'lnr_reader_voice';
const STORAGE_AUTO = 'lnr_reader_auto';

/**
 * The screen scan interval.
 *
 * 400ms rather than the old 700ms: the reveal card appears at the same instant
 * the scene clock starts its 6-second countdown, so every millisecond before
 * the voice starts is a millisecond of the countdown spent in silence. At 400ms
 * the voice is always speaking well before the first tick could matter. The
 * scan itself is three querySelectors, so the cost is negligible.
 */
const SCAN_MS = 400;

/** Strip characters a speech engine would either read out or choke on. */
function speakable(s: string): string {
  return s
    .replace(/[\u2726\u2727\u2022\u25aa\u25cf\u2013\u2014\u00b7]/g, ' ') // ✦ • ▪ ● – — ·
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Read the question and the four answers currently inside the quiz viewport. */
function readQuizFromScreen(): string {
  const box = document.querySelector('.quiz-viewport-stage');
  if (!box) return '';
  const q = box.querySelector('.quiz-question-text');
  const parts: string[] = [];
  if (q && q.textContent) parts.push(speakable(q.textContent));
  box.querySelectorAll('.quiz-opt-btn').forEach(btn => {
    const badge = btn.querySelector('.opt-badge');
    const text = btn.querySelector('.quiz-opt-text');
    if (text && text.textContent) {
      const letter = badge && badge.textContent ? badge.textContent.trim() : '';
      const body = speakable(text.textContent);
      parts.push(letter ? `Option ${letter}. ${body}` : body);
    }
  });
  return parts.filter(Boolean).join('. ');
}

/**
 * Read the revealed answer AND its reference.
 *
 * This is the text the user reported being cut off, so the order matters: the
 * answer first, then the citation, joined by a full stop so the engine pauses
 * between them instead of running them together.
 */
function readRevealFromScreen(): string {
  const card = document.querySelector('.quiz-reveal-card');
  if (!card) return '';

  const answerEl = card.querySelector('.reveal-answer');
  const refEl = card.querySelector('.reveal-scripture-ref');

  const parts: string[] = [];
  if (answerEl && answerEl.textContent) {
    // "Option B: ..." — worth hearing on a stream, it tells a viewer which
    // letter won.
    parts.push(speakable(answerEl.textContent));
  }
  if (refEl && refEl.textContent) {
    // Drop the "Source / Reference:" label the UI prints before the citation.
    const ref = speakable(refEl.textContent).replace(/^Source\s*\/?\s*Reference\s*:?\s*/i, '');
    if (ref) parts.push(ref);
  }
  return parts.filter(Boolean).join('. ');
}

export default function ReaderDock() {
  const [voices, setVoices] = useState<CuratedVoice[]>([
    { uri: '', label: 'Device default voice', group: 'Default' }
  ]);
  const [voiceURI, setVoiceURI] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_VOICE) || ''; } catch { return ''; }
  });

  /**
   * AUTO ON unless the operator has explicitly turned it off before. v2
   * defaulted to OFF, which is why the reader never started on its own.
   */
  const [autoRead, setAutoRead] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTO);
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const [state, setState] = useState<ReaderState>('idle');
  const [progress, setProgress] = useState({ chars: 0, total: 0 });
  const [supported, setSupported] = useState(true);
  const [holding, setHolding] = useState(false);
  const [streaming, setStreaming] = useState(isStreamMode());
  /** Set when the engine never starts, so the operator is told, not left guessing. */
  const [blocked, setBlocked] = useState(false);

  const lastQuestion = useRef<string>('');
  const lastReveal = useRef<string>('');
  const autoRef = useRef(autoRead);
  useEffect(() => { autoRef.current = autoRead; }, [autoRead]);

  /* ---------------------------------------------------------------- voices */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    const load = () => {
      const raw = window.speechSynthesis.getVoices();
      if (raw.length) setVoices(curateVoices(raw));
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    // Safari often never fires voiceschanged, so poll briefly as a backup.
    const poll = setInterval(load, 500);
    const stopPoll = setTimeout(() => clearInterval(poll), 4000);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      clearInterval(poll);
      clearTimeout(stopPoll);
    };
  }, []);

  /* -------------------------------------------------------------- persist */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_VOICE, voiceURI);
      localStorage.setItem(STORAGE_AUTO, autoRead ? '1' : '0');
    } catch {}
  }, [voiceURI, autoRead]);

  /* -------------------------------------------------- hold / stream status */
  useEffect(() => onHoldChange(setHolding), []);
  useEffect(() => onStreamModeChange(setStreaming), []);

  /**
   * If a hold was released because the voice engine never started, say so. The
   * reader is still on, so this is not the operator's mistake — it is almost
   * always a device that needs one tap before it will speak.
   */
  useEffect(() => onRelease(reason => {
    if (reason === 'never-started') setBlocked(true);
  }), []);

  /* -------------------------------------------------------- speak helpers */
  const speak = useCallback((text: string) => {
    if (!text) return;
    setBlocked(false);
    voiceReader.play({
      text,
      voiceURI,
      onStateChange: setState,
      onProgress: (chars, total) => setProgress({ chars, total }),
      // Release the scene the moment the engine says it has finished, rather
      // than waiting for the next 1Hz sample of the scene clock. Without this a
      // short answer could start and end between two samples, and the scene
      // would sit waiting for a sentence that is already over.
      onEnd: how => releaseHold(how === 'finished' ? 'finished' : 'stopped')
    });
  }, [voiceURI]);

  /* ------------------------------------------- watch the screen and narrate */
  useEffect(() => {
    const tick = () => {
      const reveal = readRevealFromScreen();

      /* ---- reveal scene: answer + reference ---------------------------- */
      if (reveal && reveal !== lastReveal.current) {
        lastReveal.current = reveal;
        // Register the hold BEFORE speaking. If the engine is slow to start,
        // the hold is already in place and the scene is already waiting.
        if (autoRef.current) {
          beginHold('reveal', reveal);
          speak(reveal);
        }
        return;
      }

      if (!reveal) {
        lastReveal.current = '';
        // The reveal card is gone, so any hold for it is stale. Releasing here
        // is what lets the next question appear if the voice stalled.
        if (isHolding()) releaseHold('replaced');
      }

      /* ---- thinking scene: the question itself ------------------------ */
      const question = readQuizFromScreen();
      if (question && question !== lastQuestion.current) {
        lastQuestion.current = question;
        // A new question invalidates any paused position.
        voiceReader.stop();
        if (autoRef.current) speak(question);
      }
      if (!question) lastQuestion.current = '';
    };

    tick();
    const id = setInterval(tick, SCAN_MS);
    return () => clearInterval(id);
  }, [speak]);

  // Stop talking if the page is hidden (screen lock, tab switch). The hold is
  // released by readerSync's own visibilitychange listener.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) voiceReader.stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  if (!supported) return null;

  const currentText = () => readRevealFromScreen() || readQuizFromScreen();

  const handlePlayPause = () => {
    if (state === 'playing') {
      voiceReader.pause();
      releaseHold('paused');
      return;
    }
    if (state === 'paused') {
      // Resume from the exact character we stopped at. resume() never touches
      // the stored text or cursor, so nothing is repeated.
      voiceReader.resume();
      return;
    }
    const text = currentText();
    if (!text) return;
    // Re-read from the top: hold the scene again so the sentence can finish.
    if (readRevealFromScreen()) beginHold('reveal', text);
    speak(text);
  };

  const handleStop = () => {
    voiceReader.stop();
    releaseHold('stopped');
    setProgress({ chars: 0, total: 0 });
  };

  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';

  // Group the curated list for <optgroup> rendering.
  const groups = new Map<string, CuratedVoice[]>();
  for (const v of voices) {
    if (!groups.has(v.group)) groups.set(v.group, []);
    groups.get(v.group)!.push(v);
  }

  const pct = progress.total > 0 ? Math.round((progress.chars / progress.total) * 100) : 0;

  const status = blocked
    ? 'Voice blocked — tap Play once to unlock it on this device'
    : isPlaying
      ? holding
        ? `Reading to the end — next question waits${pct ? ` · ${pct}%` : ''}`
        : `Reading… ${pct}%`
      : isPaused
        ? `Paused at ${pct}% — Resume continues from here`
        : autoRead
          ? 'Waiting for the next scene'
          : 'Auto is off — press Play to read';

  return (
    <div className="reader-dock">
      <div className="reader-dock-inner">
        <p className="reader-dock-label">
          <Volume2 size={14} />
          <span>Reader</span>
        </p>

        {/* Play / Pause — one button, label and icon follow the state. */}
        <button
          className={`reader-btn reader-btn-play ${isPlaying ? 'is-playing' : ''} ${isPaused ? 'is-paused' : ''}`}
          onClick={handlePlayPause}
          aria-label={isPlaying ? 'Pause reading' : isPaused ? 'Resume reading' : 'Start reading'}
          title={isPlaying ? 'Pause (resumes where it stopped)' : isPaused ? 'Resume from where it stopped' : 'Start reading'}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          <span>{isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}</span>
        </button>

        {/* Stop / reset to the beginning. */}
        <button
          className="reader-btn reader-btn-stop"
          onClick={handleStop}
          disabled={state === 'idle' && progress.chars === 0}
          aria-label="Stop and reset"
          title="Stop and start over from the beginning"
        >
          <Square size={13} />
          <span>Stop</span>
        </button>

        <select
          id="reader-voice"
          aria-label="Reader voice"
          value={voiceURI}
          onChange={e => {
            setVoiceURI(e.target.value);
            // Changing voice mid-sentence: stop cleanly rather than switching
            // engines halfway through a word.
            voiceReader.stop();
            releaseHold('stopped');
          }}
        >
          {[...groups.entries()].map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map(v => (
                <option key={v.uri || 'default'} value={v.uri}>
                  {v.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          className={`reader-btn ${autoRead ? 'is-on' : ''}`}
          onClick={() => setAutoRead(a => !a)}
          title={autoRead ? 'Stop reading new questions automatically' : 'Read each new question automatically'}
        >
          {autoRead ? 'Auto On' : 'Auto Off'}
        </button>

        {/* Stream-safe: hides both docks from the captured frame. */}
        <button
          className={`reader-btn reader-btn-stream ${streaming ? 'is-on' : ''}`}
          onClick={() => {
            setStreamMode(true);
            // A visible confirmation the operator can trust, since the dock
            // itself is about to disappear.
            const note = document.createElement('div');
            note.textContent =
              'Controls hidden from stream — press T or double-tap the bottom-right corner to bring them back';
            Object.assign(note.style, {
              position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
              zIndex: '10001', background: '#0e1621', border: '1px solid #f7d896',
              color: '#f7d896', borderRadius: '10px', padding: '10px 14px',
              font: '700 12px/1.4 "DM Sans", system-ui, sans-serif', maxWidth: '88vw',
              textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.6)'
            });
            document.body.appendChild(note);
            setTimeout(() => note.remove(), 4200);
          }}
          title="Hide all controls so they are not captured in the broadcast"
        >
          <Radio size={13} />
          <span>Stream Safe</span>
        </button>

        <span className="reader-dock-sub" aria-live="polite">
          {holding && <Ear size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />}
          {status}
        </span>
      </div>

      {/* Thin progress line: visible proof that resume continues, not restarts. */}
      <div className="reader-progress-track" aria-hidden="true">
        <div className="reader-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
