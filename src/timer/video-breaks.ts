/* ==========================================================================
   video-breaks.ts -- quiz & anecdote breaks inside an uploaded video
   --------------------------------------------------------------------------
   Watches the active video deck and, when a break is due, pauses the clip,
   runs a short quiz -> answer -> anecdote card sequence, then resumes the
   SAME clip at the exact second it was paused. The card is read aloud by the
   device reader (see break-voice.ts) and long anecdote text scrolls with it.

   Playback is driven from the DOM: the decks are real <video> elements with
   `data-clip-id`, and the engine exposes its phase on window.LNR_DEBUG.state.
   Everything is fail-open: any error hides the card, restores playback and
   marks the break as shown, so the video can never freeze on a break.
   ========================================================================== */

/* --- imports --- */
import { breaksFor, buildPanel } from './break-panel';
import { noticeText } from './notice-copy';
import {
  BreakItem,
  ClipBreaks,
  EngineDebug,
  QuizQ,
  globalQuizSeconds,
  readRecord
} from './break-parser';
import { getProState } from '../pro/license';
import {
  startNarration,
  stopNarration,
  waitForNarration,
  fallbackReadSeconds,
  type Narration
} from './break-voice';
/* --- end imports --- */

const shownSets = new Map<string, Set<number>>();

function engineState(): { phase?: string; paused?: boolean } | null {
  try {
    const debug = (window as unknown as { LNR_DEBUG?: EngineDebug }).LNR_DEBUG;
    return debug && typeof debug.state === 'function' ? debug.state() : null;
  } catch {
    return null;
  }
}

function isVideoPhase(): boolean {
  const state = engineState();
  return !!state && state.phase === 'video' && !state.paused;
}

let runSeq = 0;
let breakRunning = false;
let overlay: HTMLDivElement | null = null;
let overlayBody: HTMLDivElement | null = null;

const deckSeen = new WeakMap<HTMLVideoElement, { id: string; time: number }>();

function trackDeck(v: HTMLVideoElement): void {
  const id = v.getAttribute('data-clip-id') || '';
  const prev = deckSeen.get(v);
  if (id && (!prev || prev.id !== id || (v.currentTime < 0.5 && prev.time > 1.5))) {
    shownSets.set(id, new Set());
  }
  deckSeen.set(v, { id, time: v.currentTime });
}

function onDeckTime(v: HTMLVideoElement): void {
  if (breakRunning) return;
  if (!v.classList.contains('is-active') || v.hidden) return;

  const clipId = v.getAttribute('data-clip-id') || '';
  if (!clipId) return;

  trackDeck(v);

  if (!getProState().active) {
    return;
  }

  const record = readRecord(clipId);
  if (!record.on) {
    return;
  }

  const state = engineState();
  if (!state || state.phase !== 'video' || state.paused) return;

  const clipBreaks = breaksFor(clipId, clipId);
  if (!clipBreaks || !clipBreaks.items.length) {
    return;
  }

  const time = v.currentTime;
  let shown = shownSets.get(clipId);
  if (!shown) {
    shown = new Set();
    shownSets.set(clipId, shown);
  }

  const due = clipBreaks.items.find(
    (item) =>
      !shown!.has(item.key) &&
      item.time != null &&
      time >= item.time &&
      time - item.time <= 3.5
  );
  if (!due) return;

  shown.add(due.key);
  void runBreak(v, clipId, due, time, clipBreaks);
}

function onDeckSeeking(v: HTMLVideoElement): void {
  const clipId = v.getAttribute('data-clip-id') || '';
  if (!clipId) return;
  const clipBreaks = breaksFor(clipId, clipId);
  if (!clipBreaks) return;

  let shown = shownSets.get(clipId);
  if (!shown) {
    shown = new Set();
    shownSets.set(clipId, shown);
  }
  clipBreaks.items.forEach((item) => {
    if (item.time != null && item.time <= v.currentTime + 0.75) shown!.add(item.key);
  });
}

async function runBreak(
  v: HTMLVideoElement,
  clipId: string,
  item: BreakItem,
  resumeAt: number,
  clipBreaks: ClipBreaks
): Promise<void> {
  breakRunning = true;
  const runId = ++runSeq;
  const wasPlaying = !v.paused;
  const alive = () => runId === runSeq && isVideoPhase();

  try {
    v.pause();
  } catch {
    /* ignore */
  }

  try {
    await playBreak(item, clipBreaks, alive);
  } catch {
    /* any failure skips the break */
  }

  if (runId !== runSeq) return;

  breakRunning = false;
  hideOverlay();

  if (!wasPlaying) return;
  if (!alive()) return;
  if (v.getAttribute('data-clip-id') !== clipId || !v.classList.contains('is-active')) return;

  try {
    if (Math.abs(v.currentTime - resumeAt) > 0.3) v.currentTime = resumeAt;
  } catch {
    /* ignore */
  }
  try {
    const attempt = v.play();
    if (attempt && attempt.catch) attempt.catch(() => {});
  } catch {
    /* ignore */
  }
}

function ensureOverlay(): HTMLDivElement {
  if (overlay && overlayBody) return overlayBody;

  overlay = document.createElement('div');
  overlay.className = 'vbreak-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Quiz and anecdote break');

  overlayBody = document.createElement('div');
  overlayBody.className = 'vbreak-card vbreak-style-1';

  overlay.appendChild(overlayBody);

  const stage = document.getElementById('videoStage') || document.body;
  stage.appendChild(overlay);
  return overlayBody;
}

function hideOverlay(): void {
  stopNarration();
  if (overlay) overlay.hidden = true;
  if (overlayBody) overlayBody.innerHTML = '';
}

function flashCard(styleIndex: number): HTMLDivElement {
  stopNarration();
  const card = ensureOverlay();
  if (overlay) overlay.hidden = false;
  card.className = `vbreak-card vbreak-style-${(styleIndex % 3) + 1}`;
  card.innerHTML = '';
  return card;
}

function elm<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cardMeta(card: HTMLDivElement, clipBreaks: ClipBreaks, kicker: string): void {
  const head = elm('div', 'vbreak-card-head');
  head.appendChild(elm('span', 'vbreak-kicker', kicker));
  card.appendChild(head);

  const title =
    clipBreaks.title || (kicker.indexOf('ANECDOTE') === 0 ? 'Anecdote Source' : '');
  if (!title && !clipBreaks.church) return;

  const meta = elm('div', 'vbreak-meta');
  if (title) meta.appendChild(elm('strong', 'vbreak-meta-title', title));
  if (clipBreaks.church) meta.appendChild(elm('span', 'vbreak-meta-church', clipBreaks.church));
  card.appendChild(meta);
}

/* Matches the promo notice's lead-in exactly (PRE_AD_NOTICE_MS = 5000 in
   engine.js). All three break types now warn for the same five seconds, so the
   rhythm of the broadcast is identical whichever break is coming. */
const NOTICE_SECONDS = 5;

/* ---------------------------------------------------------------------------
   Pre-break notice, built from the PROMO notice's own anatomy.

   There are three break types in the studio - promo, quiz, anecdote - and the
   promo one already had a notice: `.studio-break-notice` in the stage, with a
   pill, a bold headline, a detail line, a seconds counter and a progress bar.
   The quiz and anecdote notices were a separate design (`.vbreak-notice-card`,
   a big centred card with its own title scale), so the same moment in the
   broadcast looked like two different products depending on which break was
   coming.

   This builds the quiz and anecdote notices out of the SAME classes, in the
   SAME bottom-right corner, at the SAME size, with the SAME 10-second
   countdown and the SAME progress bar - so all three read as one system. The
   only thing that changes is the pill text and the copy.
   --------------------------------------------------------------------------- */
function noticeCard(
  kicker: string,
  headline: string,
  detail: string,
  alive: () => boolean
): Promise<boolean> {
  const card = flashCard(0);
  card.classList.add('vbreak-notice-card');

  /* The promo notice's exact structure. */
  const notice = elm('div', 'studio-break-notice vbreak-notice');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const row = elm('div', 'studio-break-notice-row');
  row.appendChild(elm('span', 'studio-break-pill', kicker));

  const copy = elm('div', 'studio-break-notice-copy');
  const headlineEl = elm('b', '', headline);
  /* Render guard. The editor caps input at NOTICE_COPY_LIMIT, but a value
     written by an older build, a hand-edited localStorage entry or a future
     limit change could still be longer. Clamp here so the notice can never
     spill out of its box: the CSS also clamps to two lines as a second net. */
  headlineEl.style.display = '-webkit-box';
  headlineEl.style.webkitLineClamp = '2';
  headlineEl.style.webkitBoxOrient = 'vertical';
  headlineEl.style.overflow = 'hidden';
  copy.appendChild(headlineEl);
  copy.appendChild(elm('span', '', detail));
  row.appendChild(copy);

  const counter = elm('span', 'studio-break-notice-timer', String(NOTICE_SECONDS));
  row.appendChild(counter);
  notice.appendChild(row);

  const track = elm('div', 'studio-break-bar');
  const bar = elm('span', '');
  track.appendChild(bar);
  notice.appendChild(track);

  card.appendChild(notice);

  return new Promise<boolean>((resolve) => {
    const startedAt = performance.now();
    let lastShown = NOTICE_SECONDS;
    const tick = window.setInterval(() => {
      if (!alive()) {
        window.clearInterval(tick);
        resolve(false);
        return;
      }
      const elapsed = (performance.now() - startedAt) / 1000;
      bar.style.width = `${Math.min(100, (elapsed / NOTICE_SECONDS) * 100)}%`;
      const left = Math.max(0, Math.ceil(NOTICE_SECONDS - elapsed));
      if (left !== lastShown) {
        lastShown = left;
        counter.textContent = String(left);
      }
      if (elapsed >= NOTICE_SECONDS) {
        window.clearInterval(tick);
        resolve(true);
      }
    }, 100);
  });
}

async function playBreak(
  item: BreakItem,
  clipBreaks: ClipBreaks,
  alive: () => boolean
): Promise<void> {
  const total = item.questions.length;

  document.dispatchEvent(
    new CustomEvent('lnr:break-run', {
      detail: { item, clipBreaks, total, questions: item.questions }
    })
  );

  if (total > 0) {
    const ready = await noticeCard(
      'QUIZ BREAK',
      noticeText('quiz'),
      `The first of ${total} question${total === 1 ? '' : 's'} starts in a moment.`,
      alive
    );
    if (!ready || !alive()) return;
  }

  for (let index = 0; index < item.questions.length; index++) {
    if (!alive()) return;
    const question = item.questions[index];
    const chosen = await askQuestion(question, index, total, item, clipBreaks, alive);
    if (!alive()) return;

    const held = await revealQuestion(question, chosen, index, total, item, clipBreaks, alive);
    if (!held || !alive()) return;
  }

  if (item.anecdote && alive()) {
    const ready = await noticeCard(
      'ANECDOTE',
      noticeText('anecdote'),
      'A short story from the source starts in a moment.',
      alive
    );
    if (!ready || !alive()) return;
    await showAnecdote(item, clipBreaks, alive);
  }
}

function readingDone(
  spoken: Narration | null,
  startedAt: number,
  readSeconds: number
): boolean {
  if (!spoken) return true;
  const waited = performance.now() - startedAt;

  /* Only a finished read releases the countdown. This used to return true the
     moment `speaking()` went false while `started()` was already true — which
     happens in the gap between "Option A" and "Option B", so the clock began
     counting while the reader was still on the middle of the question and the
     scene moved on before it finished. */
  if (spoken.done()) return true;

  /* The voice has not begun yet: give it the fallback reading time, so a phone
     that needs a beat to speak is not skipped straight into the countdown. */
  if (!spoken.started()) return waited >= readSeconds * 1000;

  /* Started but never finishes — a stuck synthesis queue gets a wide margin
     and is then released, so a break can never hang on a reader. */
  return waited > (readSeconds + 30) * 1000;
}

function askQuestion(
  question: QuizQ,
  index: number,
  total: number,
  item: BreakItem,
  clipBreaks: ClipBreaks,
  alive: () => boolean
): Promise<number | null> {
  const card = flashCard(item.key + index);
  cardMeta(card, clipBreaks, total > 1 ? `QUIZ · ${index + 1} OF ${total}` : 'QUIZ BREAK');

  card.appendChild(elm('p', 'vbreak-q', question.prompt));

  const options = elm('div', 'vbreak-options');
  const buttons: HTMLButtonElement[] = question.options.map((text, optIndex) => {
    const button = elm('button', 'vbreak-opt');
    button.type = 'button';
    button.appendChild(elm('span', 'vbreak-opt-badge', String.fromCharCode(65 + optIndex)));
    button.appendChild(elm('span', 'vbreak-opt-text', text));
    options.appendChild(button);
    return button;
  });
  card.appendChild(options);

  const spoken = startNarration([
    { text: `Question ${index + 1} of ${total}.`, syncCaption: false },
    { text: question.prompt, syncCaption: false },
    ...question.options.map(
      (text, optIndex) =>
        ({
          text: `Option ${String.fromCharCode(65 + optIndex)}. ${text}`,
          syncCaption: false
        } as { text: string; syncCaption: false })
    )
  ]);

  const clock = elm('span', 'vbreak-clock', '');
  card.appendChild(clock);

  const seconds =
    question.countdown && question.countdown > 0 ? question.countdown : globalQuizSeconds();

  const questionText = [question.prompt, ...question.options].join(' ');
  const readSeconds = fallbackReadSeconds(questionText);
  let reading = !!spoken;

  let settled = false;
  let answerWith: (value: number | null) => void = () => {};
  const answered = new Promise<number | null>((resolve) => {
    answerWith = resolve;
  });

  const finish = (value: number | null) => {
    if (settled) return;
    settled = true;
    window.clearInterval(timer);
    stopNarration();
    buttons.forEach((button) => {
      button.disabled = true;
    });
    answerWith(value);
  };

  buttons.forEach((button, optIndex) => {
    button.addEventListener('click', () => {
      button.classList.add('is-chosen');
      finish(optIndex);
    });
  });

  const readStartTime = performance.now();
  let countdownStartAt = 0;

  const timer = window.setInterval(() => {
    if (!alive()) {
      finish(null);
      return;
    }

    if (reading) {
      if (!readingDone(spoken, readStartTime, readSeconds)) {
        clock.textContent = 'Reading…';
        return;
      }
      reading = false;
      countdownStartAt = performance.now();
    }

    if (!countdownStartAt) countdownStartAt = performance.now();
    const left = Math.max(0, seconds - (performance.now() - countdownStartAt) / 1000);
    clock.textContent = `${Math.max(0, Math.ceil(left))}s`;
    if (left <= 0) finish(null);
  }, 200);

  return answered;
}

function revealQuestion(
  question: QuizQ,
  chosen: number | null,
  index: number,
  total: number,
  item: BreakItem,
  clipBreaks: ClipBreaks,
  alive: () => boolean
): Promise<boolean> {
  const card = ensureOverlay();
  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('.vbreak-opt'));
  buttons.forEach((button, optIndex) => {
    button.disabled = true;
    if (optIndex === question.correct) button.classList.add('is-correct');
    else if (chosen != null && optIndex === chosen) button.classList.add('is-wrong');
  });

  const clock = card.querySelector('.vbreak-clock');
  clock?.remove();

  const reveal = elm('div', 'vbreak-reveal');
  reveal.appendChild(
    elm(
      'p',
      'vbreak-answer',
      `Answer: ${String.fromCharCode(65 + question.correct)}) ${question.options[question.correct]}`
    )
  );
  if (question.explanation) reveal.appendChild(elm('p', 'vbreak-explain', question.explanation));
  card.appendChild(reveal);

  const spoken = startNarration([
    `Answer: ${String.fromCharCode(65 + question.correct)}. ${question.options[question.correct]}.`,
    question.explanation || ''
  ]);

  return waitForNarration(spoken, 6000, 90000, alive).then(() => alive());
}

async function showAnecdote(
  item: BreakItem,
  clipBreaks: ClipBreaks,
  alive: () => boolean
): Promise<void> {
  const anecdote = item.anecdote;
  if (!anecdote) return;

  const card = flashCard(item.key + 2);
  cardMeta(card, clipBreaks, 'ANECDOTE');

  card.classList.add('vbreak-anecdote-card');

  if (anecdote.title) card.appendChild(elm('h4', 'vbreak-anecdote-title', anecdote.title));

  const scroller = elm('div', 'vbreak-anecdote-scroll');
  scroller.appendChild(elm('p', 'vbreak-anecdote-text', anecdote.text));
  card.appendChild(scroller);

  if (item.hostNote) card.appendChild(elm('p', 'vbreak-host-note', item.hostNote));

  const words = anecdote.text.split(/\s+/).filter(Boolean).length;
  const holdMs = Math.min(25, Math.max(12, words * 0.3 + 4)) * 1000;

  const narration = startNarration([anecdote.title || '', anecdote.text]);

  const stopFollow = followReading(
    scroller,
    narration,
    holdMs,
    () => 0,
    () => 0
  );

  /* Fire the "stage is ending" warning 10 seconds BEFORE the read completes,
     not after it. The decorator's banner is a 10-second countdown, so it has to
     start while the anecdote is still on screen — dispatching only on
     `lnr:anecdote-finished` meant the banner appeared as the card was already
     being torn down. A timer is used rather than a second wait so the warning
     lands at a predictable point regardless of how long the voice runs. */
  const endingTimer = window.setTimeout(() => {
    if (!alive()) return;
    document.dispatchEvent(new CustomEvent('lnr:anecdote-ending'));
  }, Math.max(0, holdMs - 10000));

  await waitForNarration(narration, holdMs, 150000, alive);
  window.clearTimeout(endingTimer);
  stopFollow();
  stopNarration();

  // Signal that the anecdote has finished and video will restart soon
  document.dispatchEvent(new CustomEvent('lnr:anecdote-finished'));
}

function followReading(
  box: HTMLElement,
  narration: Narration | null,
  holdMs: number,
  share: () => number,
  shareAt: () => number
): () => void {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  box.addEventListener('pointerdown', stop, { passive: true });
  box.addEventListener('wheel', stop, { passive: true });
  box.addEventListener('touchstart', stop, { passive: true });
  box.addEventListener('keydown', stop);

  const pace = 1 / Math.max(6000, holdMs - 2500);
  let target = 0;
  let shown = 0;
  let lastFrame = performance.now();

  const frame = () => {
    if (stopped || !box.isConnected) return;

    const current = performance.now();
    const dt = Math.min(120, Math.max(0, current - lastFrame));
    lastFrame = current;

    const overflow = Math.max(0, box.scrollHeight - box.clientHeight);
    const heard = Math.max(0, Math.min(1, share()));
    const speaking = !!narration && narration.started();
    const markerAt = shareAt();
    const fresh = speaking && markerAt > 0 && current - markerAt <= 1200;

    if (overflow > 0) {
      if (fresh) target = Math.max(target, heard);
      else target = Math.min(1, Math.max(target, heard) + dt * pace);
    }

    const ease = Math.min(0.2, dt / 120);
    shown += (target - shown) * ease;
    if (Math.abs(target - shown) < 0.0004) shown = target;
    if (overflow > 0) box.scrollTop = overflow * shown;

    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
  return stop;
}

function attachDeck(v: HTMLVideoElement): void {
  v.addEventListener('timeupdate', () => onDeckTime(v));
  v.addEventListener('seeking', () => onDeckSeeking(v));
}

let installed = false;

export function installVideoBreaks(root: HTMLElement): void {
  if (installed) return;
  installed = true;

  buildPanel(root);

  const stage = root.querySelector('#videoStage');
  if (stage) {
    stage.querySelectorAll<HTMLVideoElement>('video').forEach(attachDeck);
  } else {
    document.querySelectorAll<HTMLVideoElement>('#stageVideo, #stageVideoB').forEach(
      attachDeck
    );
  }
}
