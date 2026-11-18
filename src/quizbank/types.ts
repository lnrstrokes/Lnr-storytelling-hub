/* ==========================================================================
   quizbank/types.ts — the compact on-disk question format
   --------------------------------------------------------------------------
   The bank is stored as TUPLES, not objects. A tuple costs roughly 40% fewer
   bytes than the equivalent object literal, which matters when the bank is
   ~800 questions: it keeps each chunk file small enough to parse quickly on a
   mid-range phone, and it keeps the source readable.

   The loader (index.ts) expands a tuple into the full QuizQuestion shape that
   App.tsx already understands, so nothing downstream needs to know about this
   format.

   TUPLE LAYOUT
     [0] category      e.g. 'Old Testament'
     [1] difficulty    'Easy' | 'Medium' | 'Hard'
     [2] question      the prompt
     [3] options       exactly four strings, in A/B/C/D order
     [4] correct       0-3, index into options
     [5] reference     optional source line (scripture, episode, chapter…)
     [6] insight       one short sentence of explanation
   ========================================================================== */

export type RawQ = [
  category: string,
  difficulty: 'Easy' | 'Medium' | 'Hard',
  question: string,
  options: [string, string, string, string],
  correct: 0 | 1 | 2 | 3,
  reference?: string,
  insight?: string
];

/** Structurally identical to the QuizQuestion interface inside App.tsx. */
export interface BankQuestion {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  imageUrl?: string;
  options: { letter: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctLetter: 'A' | 'B' | 'C' | 'D';
  reference?: string;
  scripture?: string;
  insight: string;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Expand one tuple into the full question object. */
export function expand(raw: RawQ, index: number): BankQuestion {
  const [category, difficulty, question, options, correct, reference, insight] = raw;
  return {
    id: `bank-${index}`,
    category,
    difficulty,
    question,
    options: options.map((text, i) => ({ letter: LETTERS[i], text })),
    correctLetter: LETTERS[correct],
    reference,
    insight: insight || ''
  };
}
