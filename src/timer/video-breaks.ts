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
import { BreakItem, ClipBreaks, EngineDebug, QuizQ, globalQuizSeconds, readRecord } from './break-parser';
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

  // Debug: log why breaks might not trigger
  if (!getProState().active) {
    // Silent: break requires Pro. The panel already shows the locked notice.
    return;
  }

  const record = readRecord(clipId);
  if (!record.on) {
    // Silent: break toggle is off. The panel shows the toggle state.
    return;
  }

  const state = engineState();
  if (!state || state.phase !== 'video' || state.paused) return;

  const clipBreaks = breaksFor(clipId);
  if (!clipBreaks || !clipBreaks.items.length) {
    // Silent: no break items for this clip. The panel shows the upload status.
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
  const clipBreaks = breaksFor(clipId);
  if (!clipBreaks) return;

  let shown = shownSets.get(clipId);
  if (!shown) {
    shown = new Set();
    shownSets.set(clipId, shown);
  }
  /* Seeking past a break skips it silently. */
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
  /* The engine may have handed the stage to another clip (a promo, or the
     next loop). Never touch a deck that is no longer the active one. */
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
  /* A new card takes the floor: whatever the old one was saying stops. */
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

/* The card no longer carries a source tag: "Quiz Source" under every question
   was a label nobody needed, and the uploaded file name ("81367.mp4") meant
   nothing to a viewer. A title the creator wrote is still shown; with no title
   the head alone is enough, so no empty row is rendered. */
function cardMeta(card: HTMLDivElement, clipBreaks: ClipBreaks, kicker: string): void {
  const head = elm('div', 'vbreak-card-head');
  head.appendChild(elm('span', 'vbreak-kicker', kicker));
  card.appendChild(head);

  const title = clipBreaks.title || (kicker.indexOf('ANECDOTE') === 0 ? 'Anecdote Source' : '');
  if (!title && !clipBreaks.church) return;

  const meta = elm('div', 'vbreak-meta');
  if (title) meta.appendChild(elm('strong', 'vbreak-meta-title', title));
  if (clipBreaks.church) meta.appendChild(elm('span', 'vbreak-meta-church', clipBreaks.church));
  card.appendChild(meta);
}



async function playBreak(item: BreakItem, clipBreaks: ClipBreaks, alive: () => boolean): Promise<void> {
  const total = item.questions.length;

  /* No extra text between the video and the cards. The reference disclaimer is
     shown once, as the intro notice before the clip starts (engine.js), and
     everything from here on is content the viewer is meant to read. The old
     per-break REFERENCE card and the two "break starting soon" notices were
     the overlays nobody needed — and every one of them raced the reader. */

  for (let index = 0; index < item.questions.length; index++) {
    if (!alive()) return;
    const question = item.questions[index];
    const chosen = await askQuestion(question, index, total, item, clipBreaks, alive);
    if (!alive()) return;

    const held = await revealQuestion(question, chosen, index, total, item, clipBreaks, alive);
    if (!held || !alive()) return;
  }

  if (item.anecdote && alive()) {
    await showAnecdote(item, clipBreaks, alive);
  }
}

/* --------------------------------------------------------------------------
   Reader-first gate for a card that is being spoken
   --------------------------------------------------------------------------
   A card must never count down while it is still being read: the question
   would disappear mid-sentence, which reads as a glitch rather than a break.
   The synthesiser is asked directly whether it is still speaking, so a device
   that never fires `onend` cannot end the reading early. When no voice ever
   starts (reader off, muted, blocked, or silent), the fallback reading time —
   words / 2.5 plus one second — is used, so a silent device still moves on and
   the card can never get stuck.
   -------------------------------------------------------------------------- */
function readingDone(spoken: Narration | null, startedAt: number, readSeconds: number): boolean {
  if (!spoken) return true;
  const waited = performance.now() - startedAt;
  const speaking = typeof spoken.speaking === 'function' ? spoken.speaking() : false;
  if (speaking) return waited > (readSeconds + 30) * 1000;
  const heard = typeof spoken.started === 'function' ? spoken.started() : false;
  if (heard) return true;
  return waited >= readSeconds * 1000;
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

  /* Read the question and its options as they appear, so the break is
     something the viewer hears rather than a card they have to squint at.
     The narration is kept: the countdown below does not run while the
     question is still being read. */
  const spoken = startNarration([
    { text: `Question ${index + 1} of ${total}.`, syncCaption: false },
    { text: question.prompt, syncCaption: false },
    ...question.options.map(
      (text, optIndex) => ({ text: `Option ${String.fromCharCode(65 + optIndex)}. ${text}`, syncCaption: false } as { text: string; syncCaption: false })
    )
  ]);

  const clock = elm('span', 'vbreak-clock', '');
  card.appendChild(clock);

  const seconds = question.countdown && question.countdown > 0 ? question.countdown : globalQuizSeconds();

  /* The reader owns this card. Show "Reading…" while speech is active and
     keep the progress bar empty, then run the real countdown AFTER the reader
     finishes. If speech is unavailable / muted / failed / never fires its end
     event, fall back to (word count / 2.5) + 1 seconds, then start the
     countdown. The countdown can never reach 0 before reading finishes. */
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

  /* The reader owns this card. While the question is being spoken the clock
     says "Reading…" and no time passes; the real countdown starts only once the
     voice has finished, so it can never reach zero first. */
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
  /* Re-render the same question state, then mark the answer. */
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

  /* The answer is spoken too, and the card waits for it instead of a fixed
     12 seconds: a short answer moves on quickly, a long explanation is heard
     to its end (capped so the clip always resumes). */
  const spoken = startNarration([
    `Answer: ${String.fromCharCode(65 + question.correct)}. ${question.options[question.correct]}.`,
    question.explanation || ''
  ]);

  void index;
  void total;
  void item;
  void clipBreaks;

  /* The cap is generous: the reader may take a minute on a long explanation,
     and cutting it off is exactly the race this card exists to avoid. The
     narration ends on its own when the voice goes quiet. */
  return waitForNarration(spoken, 6000, 90000, alive).then(() => alive());
}

async function showAnecdote(item: BreakItem, clipBreaks: ClipBreaks, alive: () => boolean): Promise<void> {
  const anecdote = item.anecdote;
  if (!anecdote) return;

  const card = flashCard(item.key + 2);
  cardMeta(card, clipBreaks, 'ANECDOTE');

  /* A long anecdote used to run past the bottom of the stage, and a viewer
     watching a livestream cannot scroll: the rest of the story was simply
     lost. The text now sits in its own window that glides down by itself at
     reading speed, so the whole story is shown, and it stops moving the
     moment the host touches it or scrolls it by hand. */
  card.classList.add('vbreak-anecdote-card');

  if (anecdote.title) card.appendChild(elm('h4', 'vbreak-anecdote-title', anecdote.title));

  const scroller = elm('div', 'vbreak-anecdote-scroll');
  scroller.appendChild(elm('p', 'vbreak-anecdote-text', anecdote.text));
  card.appendChild(scroller);

  if (item.hostNote) card.appendChild(elm('p', 'vbreak-host-note', item.hostNote));

  const words = anecdote.text.split(/\s+/).filter(Boolean).length;
  const holdMs = Math.min(25, Math.max(12, words * 0.3 + 4)) * 1000;

  /* The story is read aloud, and the card follows the reading: every spoken
     word moves the window by the same share of the story, so the line being
     heard is the line on screen. Movement is eased frame by frame, so the
     text glides instead of jumping a line per word — and when this device
     reports no word markers at all, the window keeps drifting at the same
     gentle pace instead of sitting still on the first paragraph. */
  const lead = anecdote.title
    ? (anecdote.title.length + 2) / (anecdote.title.length + 2 + anecdote.text.length)
    : 0;
  let voiceShare = 0;
  let voiceAt = 0;

  const narration = startNarration([anecdote.title || '', anecdote.text], (fraction) => {
    const share = lead >= 1 ? 1 : Math.max(0, Math.min(1, (fraction - lead) / (1 - lead)));
    voiceShare = Math.max(voiceShare, share);
    voiceAt = performance.now();
  });

  /* From the next frame on: the card has a height by then, so the overflow is
     known and the window can start moving. */
  const stopFollow = followReading(
    scroller,
    narration,
    holdMs,
    () => voiceShare,
    () => voiceAt
  );

  /* Long enough for a two-minute story to be read to its last line before the
     clip resumes; the drift pace still reaches the end by the floor hold. */
  await waitForNarration(narration, holdMs, 150000, alive);
  stopFollow();
  stopNarration();
}

/* The story window follows the reader.

   A viewer cannot scroll a livestream, so the text has to travel by itself.
   Three things move it, in this order of authority:

     1. the voice, while it reports word positions — the line being spoken is
        the line on screen;
     2. a gentle drift when the voice is speaking but reports no markers (some
        phones never fire `onboundary`), so the story never stalls halfway;
     3. the same drift when the reader is off or blocked.

   The window is eased toward that position every frame, so the movement is
   an animation rather than a jump, and it is measured each frame because the
   card can reflow after the first paint. The host may take over by hand; a
   viewer has no way to, which is why the text must not depend on scrolling. */
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

  /* The whole story in the time the card is held, so a short story barely
     moves and a long one still reaches its last line. */
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

    /* Ease toward the target: ~120ms of smoothing, so the text glides. */
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

/**
 * Call once after the timer markup is in the DOM. Injects the per-clip panel
 * under the video upload list and wires break playback to the video decks.
 */
export function installVideoBreaks(root: HTMLElement): void {
  if (installed) return;
  installed = true;

  buildPanel(root);

  const stage = root.querySelector('#videoStage');
  if (stage) {
    stage.querySelectorAll<HTMLVideoElement>('video').forEach(attachDeck);
  } else {
    document.querySelectorAll<HTMLVideoElement>('#stageVideo, #stageVideoB').forEach(attachDeck);
  }

  /* The engine may move a clip to the other deck; listeners live on both decks
     for the life of the page, so nothing else is needed here. */
}
