/* ============================================================
   lnr Studio — Built-in Multi-Hour Bank Loader
   Lazily loads & deduplicates all built-in Bible, World History,
   and Guess-the-Player banks so every creator gets 14+ hours of
   non-repeating broadcast content right out of the box.
   ============================================================ */

import type { StarterPlayer, StarterPlayerQuiz } from './player-library.ts';
import { setStarterData } from './player-library.ts';

export type QuizTuple = [
  string,
  [string, string, string, string],
  number,
  string,
  string,
  string
];

export interface BuiltInBanksPayload {
  bible: QuizTuple[];
  history: QuizTuple[];
  players: StarterPlayer[];
  playerQuizzes: StarterPlayerQuiz[];
}

function normQuestionKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let loadedBanks: BuiltInBanksPayload | null = null;
let loadPromise: Promise<BuiltInBanksPayload> | null = null;

export async function loadBuiltInBanks(): Promise<BuiltInBanksPayload> {
  if (loadedBanks) return loadedBanks;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [{ PRIVATE_BANKS }, chunkedBible, { HISTORY_EXPANSION }] = await Promise.all([
      import('../../api/_banks/index.ts'),
      import('../quizbank/index.ts').then((m) => m.loadBank()).catch(() => []),
      import('./history-expansion.ts'),
    ]);

    const bible: QuizTuple[] = [];
    const seenBible = new Set<string>();

    const pushBibleTuple = (raw: QuizTuple) => {
      if (!raw || !raw[0]) return;
      const key = normQuestionKey(raw[0]);
      if (!key || seenBible.has(key)) return;
      seenBible.add(key);
      bible.push(raw);
    };

    function isBibleQuestion(q: { category?: string; reference?: string; scripture?: string; question?: string }): boolean {
      const cat = String(q.category || '').toLowerCase();
      const ref = String(q.reference || q.scripture || '').toLowerCase();
      const text = String(q.question || '').toLowerCase();

      const bibleKeywords = [
        'testament', 'gospel', 'wisdom', 'biblical', 'bible', 'faith', 'psalm',
        'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges',
        'ruth', 'samuel', 'kings', 'chronicles', 'ezra', 'nehemiah', 'esther', 'job',
        'proverbs', 'ecclesiastes', 'song of songs', 'isaiah', 'jeremiah', 'lamentations',
        'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah',
        'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi', 'matthew',
        'mark', 'luke', 'john', 'acts', 'romans', 'corinthians', 'galatians', 'ephesians',
        'philippians', 'colossians', 'thessalonians', 'timothy', 'titus', 'philemon',
        'hebrews', 'james', 'peter', 'jude', 'revelation', 'canon', 'prophet', 'apostle',
        'scripture', 'lord', 'christ', 'jesus', 'moses', 'abraham', 'david', 'solomon',
        'noah', 'adam', 'eve', 'canaan', 'israel', 'temple', 'synagogue', 'commandment'
      ];

      const nonBibleKeywords = [
        'elden ring', 'battle through the heavens', 'perfect world', 'soul land',
        'renegade immortal', 'donghua', 'xiaoyan', 'shi hao', 'mars', 'apollo',
        'vostok', 'sally ride', 'space', 'astronaut', 'game show', 'traitors',
        'silk road', 'mongol empire', 'second world war'
      ];

      for (const nb of nonBibleKeywords) {
        if (cat.includes(nb) || text.includes(nb) || ref.includes(nb)) {
          return false;
        }
      }

      for (const bk of bibleKeywords) {
        if (cat.includes(bk) || ref.includes(bk) || (bk.length > 3 && text.includes(bk))) {
          return true;
        }
      }

      return false;
    }

    const history: QuizTuple[] = [];
    const seenHistory = new Set<string>();

    const pushHistoryTuple = (raw: QuizTuple) => {
      if (!raw || !raw[0]) return;
      const key = normQuestionKey(raw[0]);
      if (!key || seenHistory.has(key)) return;
      seenHistory.add(key);
      history.push(raw);
    };

    const rawBible = (PRIVATE_BANKS.bible || []) as unknown as QuizTuple[];
    rawBible.forEach((raw) => {
      if (!raw || !raw[0]) return;
      if (isBibleQuestion({ question: raw[0], reference: raw[3], category: raw[5] })) {
        pushBibleTuple(raw);
      } else {
        pushHistoryTuple(raw);
      }
    });

    const rawHistory = (PRIVATE_BANKS.history || []) as unknown as QuizTuple[];
    rawHistory.forEach(pushHistoryTuple);
    HISTORY_EXPANSION.forEach(pushHistoryTuple);

    for (const q of chunkedBible) {
      const opts = (q.options || []).map((o) => o.text);
      if (opts.length < 4) continue;
      const correctIdx = Math.max(0, ['A', 'B', 'C', 'D'].indexOf(q.correctLetter));
      const tuple: QuizTuple = [
        q.question,
        [opts[0], opts[1], opts[2], opts[3]],
        correctIdx,
        q.reference || q.scripture || q.category || '',
        q.insight || '',
        q.difficulty || 'Medium',
      ];
      if (isBibleQuestion(q)) {
        pushBibleTuple(tuple);
      } else {
        pushHistoryTuple(tuple);
      }
    }

    const players = (PRIVATE_BANKS.players || []) as unknown as StarterPlayer[];
    const playerQuizzes = (PRIVATE_BANKS.playerQuizzes || []) as unknown as StarterPlayerQuiz[];

    setStarterData(players, playerQuizzes);

    const payload: BuiltInBanksPayload = {
      bible,
      history,
      players,
      playerQuizzes,
    };

    loadedBanks = payload;

    if (typeof window !== 'undefined') {
      (window as unknown as { LNR_BUILT_IN_BANKS?: BuiltInBanksPayload }).LNR_BUILT_IN_BANKS = payload;
      window.dispatchEvent(new CustomEvent('lnr:banks-ready', { detail: payload }));
    }

    return payload;
  })();

  return loadPromise;
}
