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
import { startNarration, stopNarration, waitForNarration } from './break-voice';
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

  if (!getProState().active) return;

  const record = readRecord(clipId);
  if (!record.on) return;

  const state = engineState();
  if (!state || state.phase !== 'video' || state.paused) return;

  const clipBreaks = breaksFor(clipId);
  if (!clipBreaks || !clipBreaks.items.length) return;

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
function cardMeta(card: HTMLDivElement, clipBreaks: ClipBreaks, kicker: string, counter: string): void {
  const head = elm('div', 'vbreak-card-head');
  head.appendChild(elm('span', 'vbreak-kicker', kicker));
  head.appendChild(elm('span', 'vbreak-counter', counter));
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

  /* A notice before the break, in the same visual language as the promo
     notice (#adNotice): same pill, same copy rhythm, same 5s countdown bar.
     Without it the clip simply stopped and a quiz appeared with no warning,
     which read as a glitch rather than a planned segment. */
  if (total > 0) {
    const shown = await showBreakNotice(
      'QUIZ',
      'Quiz break starting soon',
      total === 1
        ? 'One question, then the clip resumes where it left off'
        : `${total} questions, then the clip resumes where it left off`,
      alive
    );
    if (!shown || !alive()) return;
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
    const shown = await showBreakNotice(
      'ANECDOTE',
      'Anecdote break starting soon',
      'A short story from this chapter, then the clip resumes',
      alive
    );
    if (!shown || !alive()) return;
    await showAnecdote(item, clipBreaks, alive);
  }
}

/* --------------------------------------------------------------------------
   Pre-break notice
   --------------------------------------------------------------------------
   Mirrors the promo notice exactly: a pill, a bold title, one line of
   supporting copy, a live countdown and a progress bar. It is rendered inside
   the same overlay the break card uses, so placement and readability are
   identical across all three break types.
   -------------------------------------------------------------------------- */
const NOTICE_MS = 5000;

function showBreakNotice(
  pill: string,
  title: string,
  sub: string,
  alive: () => boolean
): Promise<boolean> {
  const card = flashCard(0);
  card.classList.add('vbreak-notice-card');

  const notice = elm('div', 'studio-break-notice vbreak-notice');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const row = elm('div', 'studio-break-notice-row');
  row.appendChild(elm('span', 'studio-break-pill', pill));

  const copy = elm('div', 'studio-break-notice-copy');
  copy.appendChild(elm('b', '', title));
  copy.appendChild(elm('span', '', sub));
  row.appendChild(copy);

  const timer = elm('span', 'studio-break-notice-timer', '5s');
  row.appendChild(timer);
  notice.appendChild(row);

  const bar = elm('div', 'studio-break-bar');
  const fill = elm('span', '');
  bar.appendChild(fill);
  notice.appendChild(bar);

  card.appendChild(notice);

  const started = performance.now();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearInterval(tick);
      resolve(ok);
    };
    const tick = window.setInterval(() => {
      if (!alive()) {
        finish(false);
        return;
      }
      const elapsed = performance.now() - started;
      const left = Math.max(0, NOTICE_MS - elapsed);
      timer.textContent = Math.max(1, Math.ceil(left / 1000)) + 's';
      fill.style.width = Math.min(100, (elapsed / NOTICE_MS) * 100).toFixed(1) + '%';
      if (left <= 0) finish(true);
    }, 100);
  });
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
  cardMeta(card, clipBreaks, total > 1 ? `QUIZ · ${index + 1} OF ${total}` : 'QUIZ BREAK', `${item.key + 1}`);

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
     something the viewer hears rather than a card they have to squint at. */
  startNarration([
    `Question ${index + 1} of ${total}.`,
    question.prompt,
    ...question.options.map((text, optIndex) => `Option ${String.fromCharCode(65 + optIndex)}. ${text}`)
  ]);

  const clock = elm('span', 'vbreak-clock', '');
  card.appendChild(clock);

  const seconds = question.countdown && question.countdown > 0 ? question.countdown : globalQuizSeconds();
  let remaining = seconds;
  clock.textContent = `${remaining}s`;

  return new Promise<number | null>((resolve) => {
    let settled = false;
    let timer = 0;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      stopNarration();
      buttons.forEach((button) => {
        button.disabled = true;
      });
      resolve(value);
    };

    buttons.forEach((button, optIndex) => {
      button.addEventListener('click', () => {
        button.classList.add('is-chosen');
        finish(optIndex);
      });
    });

    timer = window.setInterval(() => {
      if (!alive()) {
        finish(null);
        return;
      }
      remaining -= 0.2;
      clock.textContent = `${Math.max(0, Math.ceil(remaining))}s`;
      if (remaining <= 0) finish(null);
    }, 200);
  });
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

  return waitForNarration(spoken, 6000, 18000, alive).then(() => alive());
}

async function showAnecdote(item: BreakItem, clipBreaks: ClipBreaks, alive: () => boolean): Promise<void> {
  const anecdote = item.anecdote;
  if (!anecdote) return;

  const card = flashCard(item.key + 2);
  cardMeta(card, clipBreaks, 'ANECDOTE', `${item.key + 1}`);

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
     heard is the line on screen. That is why it no longer races ahead of the
     eye. With the reader off (or a phone that refuses to speak), it drifts
     down on its own at a slow, steady pace instead. */
  const narration = startNarration([anecdote.title || '', anecdote.text], (fraction) => {
    const overflow = scroller.scrollHeight - scroller.clientHeight;
    if (overflow <= 0) return;
    const lead = anecdote.title
      ? (anecdote.title.length + 2) / (anecdote.title.length + 2 + anecdote.text.length)
      : 0;
    const share = lead >= 1 ? 1 : Math.max(0, Math.min(1, (fraction - lead) / (1 - lead)));
    scroller.scrollTop = overflow * share;
  });

  /* Layout first: the overflow is only known once the card is on screen. */
  window.requestAnimationFrame(() => {
    if (!narration) {
      autoScroll(scroller, holdMs);
      return;
    }
    /* A voice that never starts is a blocked voice; let the text still travel. */
    window.setTimeout(() => {
      if (!narration.started()) autoScroll(scroller, holdMs);
    }, 3500);
  });

  await waitForNarration(narration, holdMs, 90000, alive);
  stopNarration();
}

/* Slow, steady read-along scroll for text taller than the card. The travel
   time is derived from the overflow so a short story holds still and a long
   one still reaches its last line before the card closes. */
function autoScroll(box: HTMLElement, holdMs: number): void {
  if (!box.isConnected) return;
  const overflow = box.scrollHeight - box.clientHeight;
  if (overflow <= 4) return;

  /* Roughly twice as slow as the first pass: at ~90ms per pixel a line sits
     still for a few seconds, which is how long it takes to read it. */
  const travelMs = Math.max(6000, Math.min(holdMs - 4000, overflow * 90));
  if (travelMs <= 0) return;

  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  box.addEventListener('pointerdown', stop, { passive: true });
  box.addEventListener('wheel', stop, { passive: true });
  box.addEventListener('touchstart', stop, { passive: true });
  box.addEventListener('keydown', stop);

  const started = performance.now();
  const step = () => {
    if (stopped || !box.isConnected) return;
    const progress = Math.min(1, (performance.now() - started) / travelMs);
    box.scrollTop = overflow * progress;
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
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
