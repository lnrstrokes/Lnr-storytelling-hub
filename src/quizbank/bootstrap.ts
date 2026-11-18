/* ==========================================================================
   quizbank/bootstrap.ts — get the 801-question bank in front of App.tsx
   --------------------------------------------------------------------------
   WHY THIS EXISTS

   App.tsx reads its question list from localStorage on first render:

       const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
         const saved = localStorage.getItem('fs_quiz_questions');
         return saved ? JSON.parse(saved) : seedQuestions;
       });

   That is a gift: it means the bank can be installed WITHOUT editing the
   3,489-line component at all. We just have to make sure the bank is already
   in localStorage before that initialiser runs.

   So main.tsx awaits this, then renders. The chunks are dynamic imports, so
   they stay out of the main bundle — the app shell is exactly as fast as
   before, and the bank arrives as separate files that the service worker
   caches after the first visit.

   SAFETY: if the streamer has saved their own question pack (more than 20
   questions), we never overwrite it. Their pack wins.
   ========================================================================== */

import { loadBank } from './index';

const STORAGE_KEY = 'fs_quiz_questions';

/** True when the user has a real custom pack saved, which we must not clobber. */
function hasCustomPack(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // The old built-in seed set is 10 questions. Anything larger is the user's.
    return Array.isArray(parsed) && parsed.length > 20;
  } catch {
    return false;
  }
}

/**
 * Install the bank into localStorage if it is not already there.
 * Never throws — a failure here must not stop the app from rendering.
 */
export async function ensureBankInStorage(): Promise<void> {
  try {
    if (hasCustomPack()) return;

    const bank = await loadBank();
    if (!bank.length) return;

    // Only write if what is stored is not already the full bank, so we do not
    // rewrite ~300 kB of JSON on every single page load.
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length === bank.length) return;
      } catch {
        /* corrupt value — fall through and overwrite */
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
  } catch {
    /* storage blocked or full: the app still runs on its built-in questions */
  }
}
