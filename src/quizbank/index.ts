/* ==========================================================================
   quizbank/index.ts — lazy loader + non-repeating shuffle bag
   --------------------------------------------------------------------------
   TWO PROBLEMS THIS SOLVES

   1. BUNDLE SIZE. 801 questions as plain objects would add roughly 300 kB to
      the initial download — on a phone that is a visible delay before the app
      even appears. So each chunk is a separate dynamic import: Vite splits
      them into their own files, and the browser fetches them only when the
      quiz actually needs them. The app shell stays exactly as fast as before.

   2. REPETITION. The old code did `questions[qIndex % questions.length]` and
      reshuffled the whole array when it ran out. That means a question can
      reappear almost immediately after the reshuffle — the viewer sees the
      same question twice in a few minutes. A shuffle BAG fixes this: every
      question is dealt once, in random order, and only when the bag is empty
      is a new one built. No question can repeat until all 801 have been used.

   The bag position is saved to localStorage, so a refresh mid-stream resumes
   where it left off instead of starting the bag over.
   ========================================================================== */

import type { BankQuestion, RawQ } from './types';
import { expand } from './types';

const STORAGE_BAG = 'lnr_quiz_bag_v1';

/** Every chunk, as a lazy import. Order here is the order they load in. */
const CHUNK_LOADERS: (() => Promise<{ default: RawQ[] }>)[] = [
  () => import('./chunk01').then(m => ({ default: m.chunk01 })),
  () => import('./chunk02').then(m => ({ default: m.chunk02 })),
  () => import('./chunk03').then(m => ({ default: m.chunk03 })),
  () => import('./chunk04').then(m => ({ default: m.chunk04 })),
  () => import('./chunk05').then(m => ({ default: m.chunk05 })),
  () => import('./chunk06').then(m => ({ default: m.chunk06 })),
  () => import('./chunk07').then(m => ({ default: m.chunk07 })),
  () => import('./chunk08').then(m => ({ default: m.chunk08 }))
];

/** How many questions the bank holds. Kept in sync with the chunk files. */
export const BANK_SIZE = 801;

/**
 * Seconds one question occupies on stream: 20s thinking phase + 6s reveal.
 * Used to report how long the bank lasts.
 */
export const SECONDS_PER_QUESTION = 26;

/** How long the whole bank runs for, in hours. */
export const BANK_HOURS = (BANK_SIZE * SECONDS_PER_QUESTION) / 3600;

let cache: BankQuestion[] | null = null;
let loading: Promise<BankQuestion[]> | null = null;

/** Load and expand the whole bank. Cached after the first call. */
export async function loadBank(): Promise<BankQuestion[]> {
  if (cache) return cache;
  if (loading) return loading;

  loading = (async () => {
    const chunks = await Promise.all(CHUNK_LOADERS.map(fn => fn()));
    const out: BankQuestion[] = [];
    let i = 0;
    for (const chunk of chunks) {
      for (const raw of chunk.default) {
        out.push(expand(raw, i++));
      }
    }
    cache = out;
    return out;
  })();

  return loading;
}

/* ------------------------------------------------------------------ bag --- */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface BagState {
  /** Indices into the bank, in the order they will be dealt. */
  order: number[];
  /** How many have been dealt from this bag. */
  pos: number;
}

function readBag(): BagState | null {
  try {
    const raw = localStorage.getItem(STORAGE_BAG);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BagState;
    if (!Array.isArray(parsed.order) || typeof parsed.pos !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBag(state: BagState) {
  try {
    localStorage.setItem(STORAGE_BAG, JSON.stringify(state));
  } catch {
    /* storage full or blocked — the bag still works, it just won't survive a refresh */
  }
}

/**
 * Deal the next question. Never repeats until every question has been used.
 *
 * The bag is rebuilt (reshuffled) only when exhausted, and the new bag is
 * guaranteed not to start with the question that just played — otherwise the
 * boundary between two bags would show the same question twice in a row.
 */
export async function nextQuestion(lastId?: string): Promise<BankQuestion> {
  const bank = await loadBank();
  let bag = readBag();

  // A saved bag from a different bank size is stale — start fresh.
  if (!bag || bag.order.length !== bank.length) {
    bag = { order: shuffle(bank.map((_, i) => i)), pos: 0 };
  }

  if (bag.pos >= bag.order.length) {
    const fresh = shuffle(bank.map((_, i) => i));
    // Avoid dealing the same question twice across the bag boundary.
    if (lastId && fresh.length > 1) {
      const lastIdx = bank.findIndex(q => q.id === lastId);
      if (lastIdx === fresh[0]) {
        const swapWith = 1 + Math.floor(Math.random() * (fresh.length - 1));
        [fresh[0], fresh[swapWith]] = [fresh[swapWith], fresh[0]];
      }
    }
    bag = { order: fresh, pos: 0 };
  }

  const idx = bag.order[bag.pos];
  bag.pos += 1;
  writeBag(bag);

  return bank[idx];
}

/** How many questions remain before the bag reshuffles. */
export function remainingInBag(): number {
  const bag = readBag();
  if (!bag) return BANK_SIZE;
  return Math.max(0, bag.order.length - bag.pos);
}

/** Wipe the saved bag — used when the streamer loads a different pack. */
export function resetBag() {
  try {
    localStorage.removeItem(STORAGE_BAG);
  } catch {}
}
