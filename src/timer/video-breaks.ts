/* ==========================================================================
   video-breaks.ts — quiz & anecdote breaks for uploaded videos
   --------------------------------------------------------------------------
   The app never generates content. The streamer writes a quiz/anecdote file
   in any AI chat (or by hand) and uploads it here. This module:

     · adds the per-clip controls under the video upload panel
     · reads .txt / .md / .json / .srt / .vtt as UTF-8 and parses it tolerantly
     · watches the active video deck and, when a break is due, pauses the clip,
       runs a short quiz -> answer -> anecdote card sequence, then resumes the
       SAME clip at the exact second it was paused

   The engine stays untouched apart from `data-clip-id` on rendered clips.
   Playback is driven from the DOM: the decks are real <video> elements with
   `data-clip-id`, and the engine exposes its phase on `window.LNR_DEBUG.state`.

   Everything is fail-open: any error hides the card, restores playback and
   marks the break as shown, so the video can never freeze on a break.
   ========================================================================== */

import { getProState, openProPanel } from '../pro/license';

const STORAGE_KEY = 'lnr_video_breaks_v1';
const SETTINGS_KEY = 'lnr_timer_v2';
const TEXT_EXT = /\.(txt|md|markdown|json|srt|vtt)$/i;

const AI_PROMPT = `Create a quiz and anecdote file for a sermon video. Output plain text only, no markdown symbols.
SETTINGS (edit): Sermon title: [TITLE] | Church/channel: [NAME] | Break every: [8] minutes | Questions per break: [2], max 3
RULES:
1. Split the transcript into segments of about the break length, ending at a sentence end. One break per segment.
2. If the transcript has timestamps, put the segment end time after the break label, like [08:00]. If not, omit it.
3. Use ONLY what the speaker said. Never invent scripture references, quotes, statistics or doctrine. If unsure, write fewer questions.
4. Every question must refer to a specific point in that segment. No generic filler. Rotate question types: recall, what came next, application, true/false, scripture reference.
5. Exactly 3 options per question. Vary which is correct. Add a one-line explanation.
6. Anecdote: 40-70 words, an illustration connected to the segment. Rotate the style: short story, modern parallel, historical parallel, reflection prompt. Never present it as something the speaker said.
7. Never start two consecutive items with the same words.
FORMAT, exactly:
BREAK 1 [08:00]
Q1: question text
A) option
B) option
C) option
ANSWER: B
WHY: one line
Q2: ...
ANECDOTE TITLE: short title
ANECDOTE: 40-70 words
BREAK 2 [16:00]
...
TRANSCRIPT:
[PASTE TRANSCRIPT HERE]`;

const SAMPLE_TXT = `BREAK 1 [08:00]
Q1: What did the speaker say happens when a seed falls on good soil?
A) It withers in the sun
B) It bears fruit
C) It is carried away by birds
ANSWER: B
WHY: The good soil was described as the heart that hears the word and bears fruit.
Q2: True or false: the speaker said growth is instant.
A) True
B) False
C) Not mentioned
ANSWER: B
WHY: Growth was described as slow and patient.
ANECDOTE TITLE: The patient gardener
ANECDOTE: A gardener in a small town planted a single oak sapling and watered it every morning for thirty years. Visitors asked why he bothered when he would never sit in its shade. He said the shade was never the point: the next family would need it, and they would not know who planted it.

BREAK 2 [16:00]
Q1: Which image did the speaker use to describe hope?
A) A lamp
B) An anchor
C) A bridge
ANSWER: B
WHY: Hope was pictured as an anchor that holds through the storm.
Q2: What did the speaker ask the congregation to do this week?
A) Memorise the passage
B) Write a letter of encouragement
C) Fast for a day
ANSWER: B
WHY: The closing challenge was to write one letter of encouragement.
ANECDOTE TITLE: The letter in the drawer
ANECDOTE: A woman found an old letter in her father's desk, written to him by a teacher fifty years earlier. The teacher had only said she believed in him. She kept it in the drawer where she would see it every morning, and said it had carried her through the hardest year of her life.`;

const SAMPLE_JSON = JSON.stringify(
  {
    title: 'Sample sermon',
    church: 'Sample Church',
    breaks: [
      {
        at_seconds: 480,
        label: 'Break 1',
        questions: [
          {
            prompt: 'What did the speaker say happens when a seed falls on good soil?',
            options: ['It withers in the sun', 'It bears fruit', 'It is carried away by birds'],
            correct_index: 1,
            countdown_sec: 10,
            explanation: 'The good soil was described as the heart that hears the word and bears fruit.'
          }
        ],
        anecdote: {
          title: 'The patient gardener',
          text: 'A gardener planted a single oak sapling and watered it every morning for thirty years. Visitors asked why he bothered when he would never sit in its shade. He said the shade was never the point: the next family would need it, and they would not know who planted it.',
          label: 'Anecdote'
        },
        host_note: 'Take a breath before resuming.'
      }
    ]
  },
  null,
  2
);

/* ------------------------------------------------------------------ types */

interface QuizQ {
  prompt: string;
  options: string[];
  correct: number;
  countdown: number | null;
  explanation: string;
  line?: number;
  answerRaw?: string;
}

interface Anecdote {
  title: string;
  text: string;
}

interface RawBreak {
  line: number;
  label: string;
  at: number | null;
  questions: QuizQ[];
  anecdote: Anecdote | null;
  hostNote: string;
}

interface ParsedFile {
  title: string;
  church: string;
  breaks: RawBreak[];
}

interface BreakItem {
  key: number;
  time: number | null;
  label: string;
  questions: QuizQ[];
  anecdote: Anecdote | null;
  hostNote: string;
}

interface ClipBreaks {
  title: string;
  church: string;
  clipName: string;
  items: BreakItem[];
  issues: string[];
}

interface ClipRecord {
  on: boolean;
  quiz: string;
  anecdote: string;
  interval: number;
}

type Store = Record<string, ClipRecord>;

type EngineDebug = {
  state?: () => {
    phase?: string;
    paused?: boolean;
  };
};

const EMPTY_RECORD: ClipRecord = { on: false, quiz: '', anecdote: '', interval: 8 };

/* ----------------------------------------------------------------- parsing */

function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d{1,3})?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] != null ? Number(m[3]) : null;
  if (c == null) return a * 60 + b;
  return a * 3600 + b * 60 + c;
}

function extractTime(line: string): number | null {
  const bracket = line.match(/\[([^\]]+)\]/);
  if (bracket) {
    const t = parseClock(bracket[1]);
    if (t != null) return t;
  }
  const tokens = line.match(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/g) || [];
  for (const token of tokens) {
    const t = parseClock(token);
    if (t != null) return t;
  }
  return null;
}

function resolveIndex(raw: string | undefined, options: string[]): number {
  const value = (raw || '').trim();
  if (!value) return 0;
  const letter = value.match(/^(?:option\s*)?\(?([A-Da-d])\)?[.):]?$/);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }
  const byText = options.findIndex((o) => o.trim().toLowerCase() === value.toLowerCase());
  if (byText >= 0) return byText;
  // "B) option text" style answer
  const letterPrefix = value.match(/^([A-Da-d])[).:]\s*(.*)$/);
  if (letterPrefix) {
    const idx = letterPrefix[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
    const rest = options.findIndex((o) => o.trim().toLowerCase() === letterPrefix[2].trim().toLowerCase());
    if (rest >= 0) return rest;
  }
  return 0;
}

const BREAK_HEAD = /^(break|part|segment)\b/i;
const TIMING_LINE = /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->/;
const QUESTION_LINE = /^(?:Q\s*\d*\s*[:.)]|Q\d+\s*[:.)]|\d+[.)])\s*(.*)$/i;
const OPTION_LINE = /^\(?([A-Da-d])[).:]\s*(.+)$/;
const ANSWER_LINE = /^(?:answer|correct|ans)\s*[:\-]\s*(.+)$/i;
const EXPLAIN_LINE = /^(?:why|explanation|insight|note)\s*[:\-]\s*(.+)$/i;
const ANECDOTE_TITLE_LINE = /^anecdote\s+title\s*[:\-]\s*(.+)$/i;
const ANECDOTE_LINE = /^anecdote\s*[:\-]\s*(.*)$/i;
const HOST_NOTE_LINE = /^host\s*note\s*[:\-]\s*(.+)$/i;

function parseText(raw: string): ParsedFile {
  const file: ParsedFile = { title: '', church: '', breaks: [] };
  const lines = raw.split(/\r?\n/);

  let cur: RawBreak | null = null;
  let question: QuizQ | null = null;
  let mode: 'none' | 'anecdote' = 'none';

  const flushQuestion = () => {
    if (cur && question) cur.questions.push(question);
    question = null;
  };

  const openBreak = (line: number, label: string, at: number | null) => {
    flushQuestion();
    const hadContent = cur && (cur.questions.length > 0 || !!(cur.anecdote && cur.anecdote.text.trim()));
    if (cur && hadContent) file.breaks.push(cur);
    cur = {
      line,
      label: label || `Break ${file.breaks.length + 1}`,
      at,
      questions: [],
      anecdote: null,
      hostNote: ''
    };
    mode = 'none';
  };

  const ensureBreak = (line: number): RawBreak => {
    if (!cur) openBreak(line, '', null);
    return cur as RawBreak;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line) {
      const active = cur as RawBreak | null;
      if (mode === 'anecdote' && active && active.anecdote && active.anecdote.text) {
        active.anecdote.text += '\n';
      }
      continue;
    }

    const timing = line.match(TIMING_LINE);
    if (timing) {
      openBreak(lineNo, '', parseClock(timing[1]));
      continue;
    }

    if (BREAK_HEAD.test(line) || /^-{3,}$/.test(line) || /^\[?\d{1,2}:\d{2}(?::\d{2})?\]?$/.test(line)) {
      const at = extractTime(line);
      const isRule = /^-{3,}$/.test(line);
      const label = isRule ? '' : line.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
      openBreak(lineNo, label, at);
      continue;
    }

    const anTitle = line.match(ANECDOTE_TITLE_LINE);
    if (anTitle) {
      const b = ensureBreak(lineNo);
      b.anecdote = b.anecdote || { title: '', text: '' };
      b.anecdote.title = anTitle[1].trim();
      mode = 'none';
      continue;
    }

    const anecdote = line.match(ANECDOTE_LINE);
    if (anecdote) {
      const b = ensureBreak(lineNo);
      b.anecdote = b.anecdote || { title: '', text: '' };
      const rest = anecdote[1].trim();
      if (rest) b.anecdote.text = rest;
      mode = 'anecdote';
      continue;
    }

    const hostNote = line.match(HOST_NOTE_LINE);
    if (hostNote) {
      ensureBreak(lineNo).hostNote = hostNote[1].trim();
      mode = 'none';
      continue;
    }

    const qLine = line.match(QUESTION_LINE);
    if (qLine) {
      ensureBreak(lineNo);
      flushQuestion();
      question = {
        prompt: (qLine[1] || '').trim(),
        options: [],
        correct: 0,
        countdown: null,
        explanation: '',
        line: lineNo
      };
      mode = 'none';
      continue;
    }

    const answer = line.match(ANSWER_LINE);
    if (answer && question) {
      question.answerRaw = answer[1].trim();
      mode = 'none';
      continue;
    }

    const explain = line.match(EXPLAIN_LINE);
    if (explain && question) {
      question.explanation = explain[1].trim();
      mode = 'none';
      continue;
    }

    const option = line.match(OPTION_LINE);
    if (option && question) {
      question.options.push(option[2].trim());
      mode = 'none';
      continue;
    }

    const anec = cur as RawBreak | null;
    if (mode === 'anecdote' && anec && anec.anecdote) {
      anec.anecdote.text += (anec.anecdote.text ? ' ' : '') + line;
      continue;
    }
    if (question && question.options.length === 0) {
      question.prompt = (question.prompt ? question.prompt + ' ' : '') + line;
    }
  }

  flushQuestion();
  if (cur) {
    const c = cur as RawBreak;
    if (c.questions.length > 0 || (c.anecdote && c.anecdote.text.trim())) file.breaks.push(c);
  }

  return file;
}

function jsonString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function jsonNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const clock = parseClock(value);
    if (clock != null) return clock;
    const n = Number(value);
    if (isFinite(n)) return n;
  }
  return null;
}

function jsonQuestion(input: unknown): QuizQ | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const prompt = jsonString(raw.prompt) || jsonString(raw.question) || jsonString(raw.q);
  const source = raw.options ?? raw.opts ?? raw.answers;
  if (!prompt || !Array.isArray(source)) return null;
  const options = source
    .map((o) => {
      if (typeof o === 'string') return o.trim();
      if (o && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        return jsonString(rec.text) || jsonString(rec.option) || jsonString(rec.label);
      }
      return '';
    })
    .filter(Boolean);
  if (options.length < 2) return null;

  const answerRaw = raw.correct_index ?? raw.correct ?? raw.answer_index ?? raw.answer;
  let correct = 0;
  if (typeof answerRaw === 'number' && isFinite(answerRaw)) {
    correct = answerRaw;
  } else if (typeof answerRaw === 'string') {
    correct = resolveIndex(answerRaw, options);
  }
  if (correct < 0 || correct >= options.length) correct = 0;

  const countdown = jsonNumber(raw.countdown_sec ?? raw.countdown ?? raw.sec);

  return {
    prompt,
    options,
    correct,
    countdown: countdown != null && countdown > 0 ? countdown : null,
    explanation:
      jsonString(raw.explanation) || jsonString(raw.insight) || jsonString(raw.why) || jsonString(raw.ref)
  };
}

function parseJsonFile(data: unknown): ParsedFile | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  if (!Array.isArray(root.breaks)) return null;

  const file: ParsedFile = {
    title: jsonString(root.title) || jsonString(root.sermon) || jsonString(root.sermon_title),
    church: jsonString(root.church) || jsonString(root.channel) || jsonString(root.site),
    breaks: []
  };

  root.breaks.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const raw = entry as Record<string, unknown>;
    const questions = Array.isArray(raw.questions)
      ? (raw.questions.map(jsonQuestion).filter(Boolean) as QuizQ[])
      : [];

    let anecdote: Anecdote | null = null;
    const anRaw = raw.anecdote;
    if (typeof anRaw === 'string' && anRaw.trim()) {
      anecdote = { title: jsonString(raw.anecdote_title), text: anRaw.trim() };
    } else if (anRaw && typeof anRaw === 'object') {
      const rec = anRaw as Record<string, unknown>;
      const text = jsonString(rec.text) || jsonString(rec.body) || jsonString(rec.story);
      if (text) anecdote = { title: jsonString(rec.title), text };
    }

    file.breaks.push({
      line: index + 1,
      label: jsonString(raw.label) || jsonString(raw.title) || `Break ${index + 1}`,
      at: jsonNumber(raw.at_seconds ?? raw.at ?? raw.time ?? raw.start),
      questions,
      anecdote,
      hostNote: jsonString(raw.host_note) || jsonString(raw.hostNote)
    });
  });

  return file;
}

function parseAny(raw: string): ParsedFile {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = parseJsonFile(JSON.parse(trimmed));
      if (parsed) return parsed;
    } catch {
      /* not valid JSON: fall through to the text parser */
    }
  }
  return parseText(raw);
}

/* --------------------------------------------------------- build & schedule */

function finalizeBreaks(raw: RawBreak[], issues: string[]): BreakItem[] {
  const items: BreakItem[] = [];

  raw.forEach((rb) => {
    const questions: QuizQ[] = [];
    rb.questions.slice(0, 3).forEach((q) => {
      const prompt = q.prompt.trim();
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      if (!prompt || options.length < 2) {
        issues.push(`Line ${q.line ?? rb.line}: skipped a question with no clear options.`);
        return;
      }
      questions.push({
        prompt,
        options,
        /* JSON questions arrive with a resolved index; text questions carry
           the raw ANSWER: value that still has to be matched to an option. */
        correct:
          q.answerRaw != null
            ? resolveIndex(q.answerRaw, options)
            : q.correct >= 0 && q.correct < options.length
              ? q.correct
              : 0,
        countdown: q.countdown,
        explanation: q.explanation
      });
    });

    const anecdote =
      rb.anecdote && rb.anecdote.text.trim()
        ? { title: rb.anecdote.title.trim(), text: rb.anecdote.text.trim() }
        : null;

    if (!questions.length && !anecdote) {
      issues.push(`Line ${rb.line}: skipped a break with no questions or anecdote.`);
      return;
    }

    items.push({ key: 0, time: rb.at, label: rb.label, questions, anecdote, hostNote: rb.hostNote });
  });

  return items;
}

function scheduleItems(items: BreakItem[], intervalMin: number): BreakItem[] {
  let auto = 0;
  let last = 0;
  const copy = items.map((item) => ({ ...item }));
  copy.forEach((item) => {
    if (item.time == null) {
      auto += 1;
      /* Untimed breaks sit at least one interval after whatever came before,
         even when an earlier break in the same file carried a timestamp. */
      item.time = Math.max(auto * intervalMin * 60, last + intervalMin * 60);
    }
    last = Math.max(last, item.time as number);
  });
  copy.sort((a, b) => (a.time as number) - (b.time as number));
  copy.forEach((item, index) => {
    item.key = index;
  });
  return copy;
}

function buildClipBreaks(record: ClipRecord, clipName: string): ClipBreaks {
  const issues: string[] = [];
  const quiz = record.quiz ? parseAny(record.quiz) : null;
  const anecdote = record.anecdote ? parseAny(record.anecdote) : null;

  const quizItems = quiz ? finalizeBreaks(quiz.breaks, issues) : [];
  const anecdoteItems = anecdote ? finalizeBreaks(anecdote.breaks, issues) : [];

  let items: BreakItem[];
  if (quizItems.length && anecdoteItems.length) {
    const quizScheduled = scheduleItems(quizItems, record.interval);
    const anecdoteScheduled = scheduleItems(anecdoteItems, record.interval);
    const merged = quizScheduled.map((item, index) => {
      const match =
        anecdoteScheduled.find(
          (candidate) => Math.abs((candidate.time as number) - (item.time as number)) < 1.5
        ) || anecdoteScheduled[index];
      return {
        ...item,
        anecdote: item.anecdote || (match ? match.anecdote : null),
        hostNote: item.hostNote || (match ? match.hostNote : '')
      };
    });
    merged.sort((a, b) => (a.time as number) - (b.time as number));
    merged.forEach((item, index) => {
      item.key = index;
    });
    items = merged;
  } else {
    items = scheduleItems(quizItems.length ? quizItems : anecdoteItems, record.interval);
  }

  return {
    title: (quiz && quiz.title) || (anecdote && anecdote.title) || '',
    church: (quiz && quiz.church) || (anecdote && anecdote.church) || '',
    clipName,
    items,
    issues
  };
}

/* ------------------------------------------------------------------ storage */

function readStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode: breaks still work for this session */
  }
}

function readRecord(clipId: string): ClipRecord {
  const rec = readStore()[clipId];
  if (!rec || typeof rec !== 'object') return { ...EMPTY_RECORD };
  return {
    on: !!rec.on,
    quiz: typeof rec.quiz === 'string' ? rec.quiz : '',
    anecdote: typeof rec.anecdote === 'string' ? rec.anecdote : '',
    interval: [5, 8, 10, 15].includes(Number(rec.interval)) ? Number(rec.interval) : 8
  };
}

function saveRecord(clipId: string, record: ClipRecord): void {
  const store = readStore();
  store[clipId] = record;
  writeStore(store);
}

function globalQuizSeconds(): number {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const value = Number(parsed && parsed.qSec);
    return isFinite(value) && value > 0 && value < 120 ? value : 10;
  } catch {
    return 10;
  }
}

/* --------------------------------------------------------------- clip list */

function readClipList(): Array<{ id: string; name: string }> {
  const host = document.getElementById('clipList');
  if (!host) return [];
  return Array.from(host.querySelectorAll<HTMLElement>('li[data-clip-id]')).map((li) => ({
    id: li.getAttribute('data-clip-id') || '',
    name: (li.querySelector('.clip-name')?.textContent || 'Clip').replace(/^\s*\d+\.\s*/, '').trim()
  })).filter((clip) => !!clip.id);
}

/* -------------------------------------------------------------------- panel */

let panel: HTMLElement | null = null;
let toggle: HTMLInputElement | null = null;
let toggleLabel: HTMLElement | null = null;
let switchWrap: HTMLElement | null = null;
let locked: HTMLElement | null = null;
let body: HTMLElement | null = null;
let clipSelect: HTMLSelectElement | null = null;
let attached: HTMLElement | null = null;
let intervalSelect: HTMLSelectElement | null = null;
let statusEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let quizInput: HTMLInputElement | null = null;
let anecdoteInput: HTMLInputElement | null = null;

let selectedClipId = '';

function currentRecord(): ClipRecord {
  return selectedClipId ? readRecord(selectedClipId) : { ...EMPTY_RECORD };
}

function persist(record: ClipRecord): void {
  if (selectedClipId) saveRecord(selectedClipId, record);
}

function flash(message: string): void {
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
let flashTimer = 0;

function clipNameFor(clipId: string): string {
  const found = readClipList().find((clip) => clip.id === clipId);
  return found ? found.name : 'this clip';
}

function refreshClipSelect(): void {
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

function renderAttached(record: ClipRecord): void {
  if (!attached) return;
  const name = clipNameFor(selectedClipId);
  const loaded: string[] = [];
  if (record.quiz) loaded.push('quiz file');
  if (record.anecdote) loaded.push('anecdote file');
  attached.textContent = loaded.length
    ? `Attached to ${name} · ${loaded.join(' + ')} loaded.`
    : `Files attach to ${name}.`;
}

function describePreview(clipBreaks: ClipBreaks): string {
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

function renderStatus(): void {
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

function renderPanel(): void {
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
}

function buildPanel(root: HTMLElement): void {
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

function download(name: string, content: string, type: string): void {
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

function downloadSamples(): void {
  download('sample.txt', SAMPLE_TXT, 'text/plain;charset=utf-8');
  window.setTimeout(() => download('sample.json', SAMPLE_JSON, 'application/json;charset=utf-8'), 250);
  flash('Sample files downloaded: sample.txt and sample.json.');
}

/* --------------------------------------------------------------- playback */

const breakCache = new Map<string, { signature: string; value: ClipBreaks }>();
const shownSets = new Map<string, Set<number>>();

function cacheKey(record: ClipRecord): string {
  return `${record.interval}\u0000${record.quiz.length}\u0000${record.anecdote.length}\u0000${record.quiz}\u0000${record.anecdote}`;
}

function breaksFor(clipId: string): ClipBreaks | null {
  const record = readRecord(clipId);
  if (!record.on || (!record.quiz && !record.anecdote)) return null;
  const signature = cacheKey(record);
  const cached = breakCache.get(clipId);
  if (cached && cached.signature === signature) return cached.value;
  const value = buildClipBreaks(record, clipNameFor(clipId));
  breakCache.set(clipId, { signature, value });
  return value;
}

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
let skipHold: (() => void) | null = null;

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
  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-vbreak-skip]') && skipHold) {
      const skip = skipHold;
      skipHold = null;
      skip();
    }
  });

  const stage = document.getElementById('videoStage') || document.body;
  stage.appendChild(overlay);
  return overlayBody;
}

function hideOverlay(): void {
  if (overlay) overlay.hidden = true;
  if (overlayBody) overlayBody.innerHTML = '';
  skipHold = null;
}

function flashCard(styleIndex: number): HTMLDivElement {
  const card = ensureOverlay();
  if (overlay) overlay.hidden = false;
  card.className = `vbreak-card vbreak-style-${(styleIndex % 3) + 1}`;
  card.innerHTML = '';
  skipHold = null;
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

function cardMeta(card: HTMLDivElement, clipBreaks: ClipBreaks, kicker: string, counter: string): void {
  const head = elm('div', 'vbreak-card-head');
  head.appendChild(elm('span', 'vbreak-kicker', kicker));
  head.appendChild(elm('span', 'vbreak-counter', counter));
  card.appendChild(head);

  const meta = elm('div', 'vbreak-meta');
  meta.appendChild(elm('strong', 'vbreak-meta-title', clipBreaks.title || clipBreaks.clipName));
  if (clipBreaks.church) meta.appendChild(elm('span', 'vbreak-meta-church', clipBreaks.church));
  card.appendChild(meta);
}

function sleep(ms: number, alive: () => boolean, onSkip?: (skip: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      resolve();
    };
    const timer = window.setInterval(() => {
      if (!alive() || performance.now() - started >= ms) finish();
    }, 200);
    if (onSkip) onSkip(finish);
  });
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

  const footer = elm('div', 'vbreak-footer-row');
  const skip = elm('button', 'vbreak-btn vbreak-btn-quiet', 'Skip');
  skip.type = 'button';
  skip.setAttribute('data-vbreak-skip', '1');
  footer.appendChild(skip);
  card.appendChild(footer);

  void index;
  void total;
  void item;
  void clipBreaks;

  return sleep(12000, alive, (finish) => {
    skipHold = finish;
  }).then(() => alive());
}

async function showAnecdote(item: BreakItem, clipBreaks: ClipBreaks, alive: () => boolean): Promise<void> {
  const anecdote = item.anecdote;
  if (!anecdote) return;

  const card = flashCard(item.key + 2);
  cardMeta(card, clipBreaks, 'ANECDOTE', `${item.key + 1}`);

  if (anecdote.title) card.appendChild(elm('h4', 'vbreak-anecdote-title', anecdote.title));
  card.appendChild(elm('p', 'vbreak-anecdote-text', anecdote.text));

  if (item.hostNote) card.appendChild(elm('p', 'vbreak-host-note', item.hostNote));

  const footer = elm('div', 'vbreak-footer-row');
  const skip = elm('button', 'vbreak-btn vbreak-btn-quiet', 'Skip');
  skip.type = 'button';
  skip.setAttribute('data-vbreak-skip', '1');
  footer.appendChild(skip);
  card.appendChild(footer);

  const words = anecdote.text.split(/\s+/).filter(Boolean).length;
  const holdMs = Math.min(25, Math.max(12, words * 0.3 + 4)) * 1000;

  await sleep(holdMs, alive, (finish) => {
    skipHold = finish;
  });
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
