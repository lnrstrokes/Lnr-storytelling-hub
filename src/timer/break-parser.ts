/* ==========================================================================
   break-parser.ts -- quiz & anecdote files turned into playable breaks
   --------------------------------------------------------------------------
   Everything in here is about the uploaded file: reading text, markdown,
   JSON, .srt and .vtt tolerantly, turning it into break items, deciding when
   each break is due, and remembering the per-clip settings.

   No DOM chrome and no playback live here; video-breaks.ts drives the card.
   ========================================================================== */

import { getProState, openProPanel } from '../pro/license';


export const STORAGE_KEY = 'lnr_video_breaks_v1';
export const SETTINGS_KEY = 'lnr_timer_v2';
export const TEXT_EXT = /\.(txt|md|markdown|json|srt|vtt)$/i;

export const AI_PROMPT = `Create a quiz and anecdote file for a sermon video. Output plain text only, no markdown symbols.
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

export const SAMPLE_TXT = `BREAK 1 [08:00]
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

export const SAMPLE_JSON = JSON.stringify(
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

export interface QuizQ {
  prompt: string;
  options: string[];
  correct: number;
  countdown: number | null;
  explanation: string;
  line?: number;
  answerRaw?: string;
}

export interface Anecdote {
  title: string;
  text: string;
}

export interface RawBreak {
  line: number;
  label: string;
  at: number | null;
  questions: QuizQ[];
  anecdote: Anecdote | null;
  hostNote: string;
}

export interface ParsedFile {
  title: string;
  church: string;
  breaks: RawBreak[];
}

export interface BreakItem {
  key: number;
  time: number | null;
  label: string;
  questions: QuizQ[];
  anecdote: Anecdote | null;
  hostNote: string;
}

export interface ClipBreaks {
  title: string;
  church: string;
  clipName: string;
  items: BreakItem[];
  issues: string[];
}

export interface ClipRecord {
  on: boolean;
  quiz: string;
  anecdote: string;
  interval: number;
}

export type Store = Record<string, ClipRecord>;

export type EngineDebug = {
  state?: () => {
    phase?: string;
    paused?: boolean;
  };
};

export const EMPTY_RECORD: ClipRecord = { on: false, quiz: '', anecdote: '', interval: 8 };

/* ----------------------------------------------------------------- parsing */

export function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d{1,3})?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] != null ? Number(m[3]) : null;
  if (c == null) return a * 60 + b;
  return a * 3600 + b * 60 + c;
}

export function extractTime(line: string): number | null {
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

export function resolveIndex(raw: string | undefined, options: string[]): number {
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

export const BREAK_HEAD = /^(break|part|segment)\b/i;
export const TIMING_LINE = /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->/;
export const QUESTION_LINE = /^(?:Q\s*\d*\s*[:.)]|Q\d+\s*[:.)]|\d+[.)])\s*(.*)$/i;
export const OPTION_LINE = /^\(?([A-Da-d])[).:]\s*(.+)$/;
export const ANSWER_LINE = /^(?:answer|correct|ans)\s*[:\-]\s*(.+)$/i;
export const EXPLAIN_LINE = /^(?:why|explanation|insight|note)\s*[:\-]\s*(.+)$/i;
export const ANECDOTE_TITLE_LINE = /^anecdote\s+title\s*[:\-]\s*(.+)$/i;
export const ANECDOTE_LINE = /^anecdote\s*[:\-]\s*(.*)$/i;
export const HOST_NOTE_LINE = /^host\s*note\s*[:\-]\s*(.+)$/i;

export function parseText(raw: string): ParsedFile {
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

export function jsonString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function jsonNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const clock = parseClock(value);
    if (clock != null) return clock;
    const n = Number(value);
    if (isFinite(n)) return n;
  }
  return null;
}

export function jsonQuestion(input: unknown): QuizQ | null {
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

export function parseJsonFile(data: unknown): ParsedFile | null {
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

export function parseAny(raw: string): ParsedFile {
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

export function finalizeBreaks(raw: RawBreak[], issues: string[]): BreakItem[] {
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

export function scheduleItems(items: BreakItem[], intervalMin: number): BreakItem[] {
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

export function buildClipBreaks(record: ClipRecord, clipName: string): ClipBreaks {
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

export function readStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode: breaks still work for this session */
  }
}

export function readRecord(clipId: string): ClipRecord {
  const rec = readStore()[clipId];
  if (!rec || typeof rec !== 'object') return { ...EMPTY_RECORD };
  return {
    on: !!rec.on,
    quiz: typeof rec.quiz === 'string' ? rec.quiz : '',
    anecdote: typeof rec.anecdote === 'string' ? rec.anecdote : '',
    interval: [5, 8, 10, 15].includes(Number(rec.interval)) ? Number(rec.interval) : 8
  };
}

export function saveRecord(clipId: string, record: ClipRecord): void {
  const store = readStore();
  store[clipId] = record;
  writeStore(store);
}

export function globalQuizSeconds(): number {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const value = Number(parsed && parsed.qSec);
    return isFinite(value) && value > 0 && value < 120 ? value : 10;
  } catch {
    return 10;
  }
}

/* --------------------------------------------------------------- clip list */

export function readClipList(): Array<{ id: string; name: string }> {
  const host = document.getElementById('clipList');
  if (!host) return [];
  return Array.from(host.querySelectorAll<HTMLElement>('li[data-clip-id]')).map((li) => ({
    id: li.getAttribute('data-clip-id') || '',
    name: (li.querySelector('.clip-name')?.textContent || 'Clip').replace(/^\s*\d+\.\s*/, '').trim()
  })).filter((clip) => !!clip.id);
}

