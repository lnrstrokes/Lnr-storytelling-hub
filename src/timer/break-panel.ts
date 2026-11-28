/* ==========================================================================
   break-panel.ts -- the per-clip controls under the video upload panel
   --------------------------------------------------------------------------
   The switch, the clip picker, the break interval, the upload boxes and the
   status line. It reads and writes the same records the parser stores.
   ========================================================================== */

/* --- imports --- */
import { AI_PROMPT, ClipBreaks, ClipRecord, EMPTY_RECORD, SAMPLE_JSON, SAMPLE_TXT, TEXT_EXT, buildClipBreaks, finalizeBreaks, parseAny, readClipList, readRecord, saveRecord } from './break-parser';
import { getProState, openProPanel } from '../pro/license';
import { DEFAULT_ANECDOTE_NOTICE, DEFAULT_QUIZ_NOTICE, NOTICE_COPY_LIMIT, readNoticeCopy, resetNoticeCopy, saveNoticeCopy } from './notice-copy';
/* --- end imports --- */

/* --------------------------------------------------------- parsed breaks */

export const breakCache = new Map<string, { signature: string; value: ClipBreaks }>();

export function cacheKey(record: ClipRecord): string {
  return `${record.interval}\u0000${record.quiz.length}\u0000${record.anecdote.length}\u0000${record.quiz}\u0000${record.anecdote}`;
}

export function breaksFor(clipId: string, clipName?: string | null): ClipBreaks {
  const record = readRecord(clipId);
  const signature = cacheKey(record);
  const cached = breakCache.get(clipId);
  if (cached && cached.signature === signature) return cached.value;
  const value = buildClipBreaks(record, clipName ?? clipNameFor(clipId));
  breakCache.set(clipId, { signature, value });
  return value;
}

/* -------------------------------------------------------------------- panel */

export let panel: HTMLElement | null = null;
export let toggle: HTMLInputElement | null = null;
export let toggleLabel: HTMLElement | null = null;
export let switchWrap: HTMLElement | null = null;
export let locked: HTMLElement | null = null;
export let body: HTMLElement | null = null;
export let clipSelect: HTMLSelectElement | null = null;
export let attached: HTMLElement | null = null;
export let intervalSelect: HTMLSelectElement | null = null;
export let statusEl: HTMLElement | null = null;
export let noteEl: HTMLElement | null = null;
export let quizInput: HTMLInputElement | null = null;
export let anecdoteInput: HTMLInputElement | null = null;
export let quizNoticeInput: HTMLInputElement | null = null;
export let anecdoteNoticeInput: HTMLInputElement | null = null;
export let quizNoticeCount: HTMLElement | null = null;
export let anecdoteNoticeCount: HTMLElement | null = null;

export let selectedClipId = '';

export function currentRecord(): ClipRecord {
  return selectedClipId ? readRecord(selectedClipId) : { ...EMPTY_RECORD };
}

export function persist(record: ClipRecord): void {
  if (selectedClipId) saveRecord(selectedClipId, record);
}

export function flash(message: string): void {
  if (!noteEl) return;
  noteEl.textContent = message;
  noteEl.dataset.flash = '1';
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    if (noteEl) {
      noteEl.textContent = '';
      delete noteEl.dataset.flash;
    }
  }, 5000);
}
export let flashTimer = 0;

export function clipNameFor(clipId: string): string {
  const found = readClipList().find((clip) => clip.id === clipId);
  return found ? found.name : 'this clip';
}

export function refreshClipSelect(): void {
  const clips = readClipList();
  if (!clipSelect) return;

  const previous = selectedClipId;
  clipSelect.innerHTML = '';
  clips.forEach((clip) => {
    const option = document.createElement('option');
    option.value = clip.id;
    option.textContent = clip.name;
    clipSelect!.appendChild(option);
  });

  if (clips.some((clip) => clip.id === previous)) {
    selectedClipId = previous;
  } else {
    selectedClipId = clips.length ? clips[clips.length - 1].id : '';
  }

  if (selectedClipId) clipSelect.value = selectedClipId;

  const hasClips = clips.length > 0;
  if (toggle) toggle.disabled = !hasClips || !getProState().active;
  if (switchWrap) switchWrap.classList.toggle('is-disabled', !hasClips || !getProState().active);
  if (noteEl && !noteEl.dataset.flash) {
    noteEl.textContent = hasClips ? '' : 'Upload a video first to add quiz and anecdote breaks.';
  }

  renderPanel();
}

export function renderAttached(record: ClipRecord): void {
  if (!attached) return;
  const name = clipNameFor(selectedClipId);
  const loaded: string[] = [];
  if (record.quiz) loaded.push('quiz file');
  if (record.anecdote) loaded.push('anecdote file');
  attached.textContent = loaded.length
    ? `Attached to ${name} · ${loaded.join(' + ')} loaded.`
    : `Files attach to ${name}.`;
}

export function describePreview(clipBreaks: ClipBreaks): string {
  const quizBreaks = clipBreaks.items.filter((item) => item.questions.length > 0).length;
  const questions = clipBreaks.items.reduce((total, item) => total + item.questions.length, 0);
  const anecdotes = clipBreaks.items.filter((item) => !!item.anecdote).length;
  const parts = [
    `Quiz: ${quizBreaks} break${quizBreaks === 1 ? '' : 's'}, ${questions} question${questions === 1 ? '' : 's'}.`,
    `Anecdotes: ${anecdotes}.`
  ];
  if (!quizBreaks && !anecdotes) {
    return 'Nothing recognised yet. Use the sample format, then try again.';
  }
  return parts.join(' ') + ' Ready.';
}

export function renderStatus(): void {
  if (!statusEl) return;
  const record = currentRecord();

  if (!record.quiz && !record.anecdote) {
    statusEl.textContent = 'No files yet. Upload a quiz file, an anecdote file, or one file containing both.';
    statusEl.dataset.state = '';
    return;
  }

  const clipBreaks = buildClipBreaks(record, clipNameFor(selectedClipId));
  const preview = describePreview(clipBreaks);
  const hasQuiz = clipBreaks.items.some((item) => item.questions.length > 0);
  const hasAnecdote = clipBreaks.items.some((item) => !!item.anecdote);
  const oneFile =
    !!record.quiz &&
    !!record.anecdote &&
    record.quiz.trim() === record.anecdote.trim();

  let message = preview;
  if (oneFile || (!record.anecdote && hasQuiz && hasAnecdote)) {
    message += ' Quiz and anecdotes found in one file.';
  }
  if (clipBreaks.issues.length) {
    message += ' ' + clipBreaks.issues.slice(0, 3).join(' ');
  }

  statusEl.textContent = message;
  statusEl.dataset.state = clipBreaks.items.length ? 'ok' : 'error';
}

/* ------------------------------------------------------- notice wording */

/**
 * Wire the two notice-copy fields.
 *
 * Pro gating is enforced in three places, not one, because a disabled input is
 * only a UI hint — the value must also be impossible to persist:
 *   1. the input is `disabled` for a free account (not focusable, not
 *      clickable, no caret, no paste target);
 *   2. the input handler returns early when not Pro, so even a programmatic
 *      `input` event cannot write;
 *   3. `saveNoticeCopy` is only ever reached through that handler.
 * A free account therefore has no path to store custom text, and the notice
 * keeps rendering the shipped wording.
 */
function wireNoticeCopy(): void {
  const fields: Array<{ key: 'quiz' | 'anecdote'; input: HTMLInputElement | null; count: HTMLElement | null; reset: string }> = [
    { key: 'quiz', input: quizNoticeInput, count: quizNoticeCount, reset: '#vbreakQuizNoticeReset' },
    { key: 'anecdote', input: anecdoteNoticeInput, count: anecdoteNoticeCount, reset: '#vbreakAnecdoteNoticeReset' }
  ];

  fields.forEach(({ key, input, count, reset }) => {
    if (!input) return;

    const paintCount = () => {
      if (!count) return;
      const len = input.value.length;
      count.textContent = `${len} / ${NOTICE_COPY_LIMIT}`;
      count.dataset.state = len >= NOTICE_COPY_LIMIT ? 'limit' : '';
    };

    input.addEventListener('input', () => {
      if (!getProState().active) {
        /* Belt and braces: a disabled input cannot fire this, but a script
           could. Never persist for a free account. */
        input.value = readNoticeCopy()[key];
        paintCount();
        return;
      }
      /* Hard cap on typing AND paste. `maxlength` covers most of it; this
         catches a paste that arrives through a path maxlength misses. */
      if (input.value.length > NOTICE_COPY_LIMIT) {
        input.value = input.value.slice(0, NOTICE_COPY_LIMIT);
      }
      saveNoticeCopy(key, input.value);
      paintCount();
    });

    /* Paste is capped before the browser inserts it, so the caret never jumps
       and the counter never shows an over-limit value. */
    input.addEventListener('paste', (event) => {
      if (!getProState().active) return;
      const text = event.clipboardData?.getData('text') || '';
      if (!text) return;
      event.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const merged = (input.value.slice(0, start) + text + input.value.slice(end)).slice(0, NOTICE_COPY_LIMIT);
      input.value = merged;
      saveNoticeCopy(key, merged);
      paintCount();
    });

    const resetBtn = panel?.querySelector<HTMLElement>(reset);
    resetBtn?.addEventListener('click', () => {
      if (!getProState().active) return;
      resetNoticeCopy(key);
      input.value = '';
      paintCount();
      flash('Notice wording restored to the default.');
    });

    paintCount();
  });
}

/** Reflect the stored values and the Pro gate into the two fields. */
function renderNoticeCopy(): void {
  const pro = getProState().active;
  const stored = readNoticeCopy();

  const pairs: Array<{ key: 'quiz' | 'anecdote'; input: HTMLInputElement | null; count: HTMLElement | null }> = [
    { key: 'quiz', input: quizNoticeInput, count: quizNoticeCount },
    { key: 'anecdote', input: anecdoteNoticeInput, count: anecdoteNoticeCount }
  ];

  pairs.forEach(({ key, input, count }) => {
    if (!input) return;
    /* A free account sees the field, greyed and inert, holding the default
       wording — so it is obvious what the notice says and that editing is a
       Pro feature. It is never focusable and never writable. */
    input.disabled = !pro;
    input.value = pro ? stored[key] : '';
    input.placeholder = key === 'quiz' ? DEFAULT_QUIZ_NOTICE : DEFAULT_ANECDOTE_NOTICE;
    input.setAttribute('aria-readonly', pro ? 'false' : 'true');
    if (count) {
      const len = pro ? stored[key].length : 0;
      count.textContent = `${len} / ${NOTICE_COPY_LIMIT}`;
      count.dataset.state = len >= NOTICE_COPY_LIMIT ? 'limit' : '';
    }
  });

  const block = panel?.querySelector<HTMLElement>('.vbreak-notice-copy-block');
  if (block) block.classList.toggle('is-locked', !pro);
}

export function renderPanel(): void {
  if (!panel) return;
  const pro = getProState().active;
  const clips = readClipList();
  const record = currentRecord();

  if (locked) locked.hidden = pro;
  if (toggle) {
    toggle.checked = pro && !!record.on;
    toggle.disabled = !pro || clips.length === 0;
  }
  if (toggleLabel) toggleLabel.textContent = toggle && toggle.checked ? 'On' : 'Off';
  if (switchWrap) {
    switchWrap.hidden = !pro;
    switchWrap.classList.toggle('is-on', !!toggle && toggle.checked);
    switchWrap.classList.toggle('is-disabled', !pro || clips.length === 0);
  }
  if (clipSelect) clipSelect.disabled = !pro || clips.length === 0;
  if (intervalSelect) {
    intervalSelect.value = String(record.interval);
    intervalSelect.disabled = !pro || !record.on;
  }

  if (body) body.hidden = !pro || !record.on || clips.length === 0;

  renderAttached(record);
  if (statusEl) renderStatus();
  renderNoticeCopy();

  // Update the video stage break indicator
  const clipBreaks = record.on ? buildClipBreaks(record, clipNameFor(selectedClipId)) : null;
  const breakItemsCount = clipBreaks ? clipBreaks.items.length : 0;
  updateBreakIndicator(pro, record.on, clips.length > 0, breakItemsCount);
}

function updateBreakIndicator(pro: boolean, breaksOn: boolean, hasClips: boolean, breakItemsCount: number): void {
  /* Host-only status: this chip lives in the setup panel, never on the
     video stage, so it can never be captured in the broadcast. */
  const indicator = document.getElementById('vbreakBreakChip');
  if (!indicator) return;

  if (!pro || !hasClips || breakItemsCount === 0) {
    indicator.hidden = true;
    return;
  }

  indicator.hidden = false;
  indicator.textContent = breaksOn ? `Breaks ready · ${breakItemsCount} scheduled` : 'Breaks off';
  indicator.classList.toggle('is-on', breaksOn);
}

export function buildPanel(root: HTMLElement): void {
  const host = root.querySelector('#clipList');
  if (!host || document.getElementById('vbreakPanel')) return;

  panel = document.createElement('section');
  panel.id = 'vbreakPanel';
  panel.className = 'vbreak-panel';
  panel.setAttribute('aria-labelledby', 'vbreakTitle');
  panel.innerHTML = `
    <div class="vbreak-head">
      <div class="vbreak-heading">
        <h3 class="vbreak-title" id="vbreakTitle">Quiz and anecdote breaks</h3>
        <p class="vbreak-sub">Pause the video at set times for a short quiz and anecdote, then resume from the same second.</p>
        <p class="vbreak-chip" id="vbreakBreakChip" hidden></p>
      </div>
      <label class="vbreak-switch" id="vbreakSwitch">
        <input type="checkbox" id="vbreakToggle" />
        <span class="vbreak-switch-track" aria-hidden="true"></span>
        <span class="vbreak-switch-label" id="vbreakToggleLabel">Off</span>
      </label>
    </div>
    <div class="vbreak-locked" id="vbreakLocked" hidden>
      <p>Quiz and anecdote breaks are a Pro feature.</p>
      <a href="#" id="vbreakUpgrade">Upgrade to Pro</a>
    </div>
    <div class="vbreak-body" id="vbreakBody" hidden>
      <div class="vbreak-row">
        <label class="vbreak-field" for="vbreakClip">Attach to clip</label>
        <select class="vbreak-select" id="vbreakClip"></select>
      </div>
      <p class="vbreak-attached" id="vbreakAttached"></p>
      <div class="vbreak-actions">
        <button type="button" class="vbreak-btn" id="vbreakQuizBtn">Upload quiz file</button>
        <button type="button" class="vbreak-btn" id="vbreakAnecdoteBtn">Upload anecdote file</button>
      </div>
      <input type="file" id="vbreakQuizInput" class="vbreak-file" accept=".txt,.md,.markdown,.json,.srt,.vtt,text/plain,application/json" hidden />
      <input type="file" id="vbreakAnecdoteInput" class="vbreak-file" accept=".txt,.md,.markdown,.json,.srt,.vtt,text/plain,application/json" hidden />
      <div class="vbreak-row">
        <label class="vbreak-field" for="vbreakInterval">Break every</label>
        <select class="vbreak-select" id="vbreakInterval">
          <option value="5">5 minutes</option>
          <option value="8" selected>8 minutes</option>
          <option value="10">10 minutes</option>
          <option value="15">15 minutes</option>
        </select>
      </div>
      <p class="vbreak-status" id="vbreakStatus" role="status"></p>
    </div>
    <div class="vbreak-notice-copy-block">
        <div class="vbreak-notice-copy-head">
          <h4>Notice wording</h4>
          <span class="vbreak-notice-copy-tag">Pro</span>
        </div>
        <p class="vbreak-notice-copy-help">
          Change the headline shown on the short notice before each break. The quiz notice and the anecdote notice are separate, so each can read differently.
          This is a Pro feature &mdash; free accounts keep the default wording. Up to <b>${NOTICE_COPY_LIMIT} characters</b> per field, which keeps the text fully inside the notice box on desktop and mobile.
          Clear a field, or press <b>Restore default</b>, to go back to the shipped wording.
        </p>

        <label class="vbreak-notice-copy-field" for="vbreakQuizNotice">
          <span>Quiz notice</span>
          <input type="text" id="vbreakQuizNotice" maxlength="${NOTICE_COPY_LIMIT}" placeholder="${DEFAULT_QUIZ_NOTICE}" autocomplete="off" />
          <em class="vbreak-notice-copy-count" id="vbreakQuizNoticeCount">0 / ${NOTICE_COPY_LIMIT}</em>
        </label>
        <div class="vbreak-notice-copy-actions">
          <button type="button" class="vbreak-link" id="vbreakQuizNoticeReset">Restore default</button>
        </div>

        <label class="vbreak-notice-copy-field" for="vbreakAnecdoteNotice">
          <span>Anecdote notice</span>
          <input type="text" id="vbreakAnecdoteNotice" maxlength="${NOTICE_COPY_LIMIT}" placeholder="${DEFAULT_ANECDOTE_NOTICE}" autocomplete="off" />
          <em class="vbreak-notice-copy-count" id="vbreakAnecdoteNoticeCount">0 / ${NOTICE_COPY_LIMIT}</em>
        </label>
        <div class="vbreak-notice-copy-actions">
          <button type="button" class="vbreak-link" id="vbreakAnecdoteNoticeReset">Restore default</button>
        </div>
    </div>
    <div class="vbreak-footer">
      <button type="button" class="vbreak-link" id="vbreakCopyPrompt">Copy AI prompt</button>
      <span class="vbreak-dot" aria-hidden="true">·</span>
      <button type="button" class="vbreak-link" id="vbreakSample">Download sample</button>
    </div>
    <p class="vbreak-note" id="vbreakNote" role="status"></p>
  `;

  host.insertAdjacentElement('afterend', panel);

  toggle = panel.querySelector<HTMLInputElement>('#vbreakToggle');
  toggleLabel = panel.querySelector<HTMLElement>('#vbreakToggleLabel');
  switchWrap = panel.querySelector<HTMLElement>('#vbreakSwitch');
  locked = panel.querySelector<HTMLElement>('#vbreakLocked');
  body = panel.querySelector<HTMLElement>('#vbreakBody');
  clipSelect = panel.querySelector<HTMLSelectElement>('#vbreakClip');
  attached = panel.querySelector<HTMLElement>('#vbreakAttached');
  intervalSelect = panel.querySelector<HTMLSelectElement>('#vbreakInterval');
  statusEl = panel.querySelector<HTMLElement>('#vbreakStatus');
  noteEl = panel.querySelector<HTMLElement>('#vbreakNote');
  quizInput = panel.querySelector<HTMLInputElement>('#vbreakQuizInput');
  anecdoteInput = panel.querySelector<HTMLInputElement>('#vbreakAnecdoteInput');
  quizNoticeInput = panel.querySelector<HTMLInputElement>('#vbreakQuizNotice');
  anecdoteNoticeInput = panel.querySelector<HTMLInputElement>('#vbreakAnecdoteNotice');
  quizNoticeCount = panel.querySelector<HTMLElement>('#vbreakQuizNoticeCount');
  anecdoteNoticeCount = panel.querySelector<HTMLElement>('#vbreakAnecdoteNoticeCount');

  wireNoticeCopy();

  const upgrade = panel.querySelector('#vbreakUpgrade');
  upgrade?.addEventListener('click', (event) => {
    event.preventDefault();
    openProPanel();
  });

  clipSelect?.addEventListener('change', () => {
    selectedClipId = clipSelect ? clipSelect.value : '';
    renderPanel();
  });

  intervalSelect?.addEventListener('change', () => {
    const record = currentRecord();
    record.interval = Number(intervalSelect?.value) || 8;
    persist(record);
    breakCache.clear();
    renderPanel();
  });

  toggle?.addEventListener('change', () => {
    const record = currentRecord();
    record.on = !!toggle?.checked;
    persist(record);
    renderPanel();
    if (record.on) flash('Quiz and anecdote breaks on for this clip.');
  });

  panel.querySelector('#vbreakQuizBtn')?.addEventListener('click', () => quizInput?.click());
  panel.querySelector('#vbreakAnecdoteBtn')?.addEventListener('click', () => anecdoteInput?.click());

  quizInput?.addEventListener('change', () => {
    void handleFile(quizInput, 'quiz');
  });
  anecdoteInput?.addEventListener('change', () => {
    void handleFile(anecdoteInput, 'anecdote');
  });

  panel.querySelector('#vbreakCopyPrompt')?.addEventListener('click', () => {
    void copyPrompt();
  });
  panel.querySelector('#vbreakSample')?.addEventListener('click', () => downloadSamples());

  refreshClipSelect();

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => refreshClipSelect());
    observer.observe(host, { childList: true });
  }

  window.addEventListener('lnr:pro-changed', () => {
    refreshClipSelect();
    renderPanel();
  });
}

async function handleFile(input: HTMLInputElement | null, slot: 'quiz' | 'anecdote'): Promise<void> {
  if (!input) return;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (!TEXT_EXT.test(file.name) || /\.(pdf|docx?|pptx?|rtf|odt)$/i.test(file.name)) {
    if (statusEl) {
      statusEl.textContent = 'Please save or copy your content as a .txt file.';
      statusEl.dataset.state = 'error';
    }
    return;
  }

  let text = '';
  try {
    text = await file.text();
  } catch {
    if (statusEl) {
      statusEl.textContent = `Could not read ${file.name}. Try saving it as a .txt file.`;
      statusEl.dataset.state = 'error';
    }
    return;
  }

  if (!text.trim()) {
    if (statusEl) {
      statusEl.textContent = `${file.name} is empty.`;
      statusEl.dataset.state = 'error';
    }
    return;
  }

  const preview = parseAny(text);
  const probe = finalizeBreaks(preview.breaks, []);
  if (!probe.length) {
    if (statusEl) {
      statusEl.textContent =
        `Nothing recognised in ${file.name}. Use a "BREAK 1 [08:00]" heading, "Q1:", "A)" options, ` +
        '"ANSWER:" and "ANECDOTE:". Download the sample to see the exact format.';
      statusEl.dataset.state = 'error';
    }
    return;
  }

  const record = currentRecord();
  record[slot] = text;
  persist(record);
  breakCache.clear();
  renderPanel();
  renderStatus();
}

/* --------------------------------------------------------- copy & download */

async function copyPrompt(): Promise<void> {
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(AI_PROMPT);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    try {
      const area = document.createElement('textarea');
      area.value = AI_PROMPT;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand('copy');
      area.remove();
    } catch {
      copied = false;
    }
  }

  flash(
    copied
      ? 'Copied. Paste it into any AI chat with your sermon transcript.'
      : 'Copy failed. Select the prompt from the sample file instead.'
  );
}

export function download(name: string, content: string, type: string): void {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    /* download blocked: nothing else to do */
  }
}

export function downloadSamples(): void {
  download('sample.txt', SAMPLE_TXT, 'text/plain;charset=utf-8');
  window.setTimeout(() => download('sample.json', SAMPLE_JSON, 'application/json;charset=utf-8'), 250);
  flash('Sample files downloaded: sample.txt and sample.json.');
}

/* --------------------------------------------------------------- playback */

/* ------------------------------------------------------------- re-exports */
/* Kept so the rest of the timer app can keep importing these from here. */
export type { BreakItem, ClipBreaks, EngineDebug, QuizQ } from './break-parser';
export { readRecord, globalQuizSeconds } from './break-parser';
