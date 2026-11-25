/* ==========================================================================
   break-voice.ts — single narration reader the whole app uses.

   The preroll disclaimer, quiz cards and anecdote cards all read from this
   one TTS path so they can never drift apart.
   ========================================================================== */

export interface Narration {
  speaking: () => boolean;
  started: () => boolean;
}

let synth: SpeechSynthesis | null = null;
let current: { cancel: () => void } | null = null;

function ready(): SpeechSynthesis | null {
  if (synth) return synth;
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window)) return null;
  try {
    const candidate = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!candidate || typeof candidate.speak !== 'function') return null;
    synth = candidate;
    return synth;
  } catch {
    return null;
  }
}

function makeReader(): {
  startNarration: (
    items: (string | { text: string; syncCaption?: boolean })[]
  ) => Narration | null;
  stopNarration: () => void;
  fallbackReadSeconds: (text: string) => number;
} {
  function estimateReadSeconds(text: string): number {
    const words = String(text || '')
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(2, words / 2.5 + 1);
  }

  function startNarration(
    items: (string | { text: string; syncCaption?: boolean })[]
  ): Narration | null {
    const s = ready();
    if (!s) return null;
    try { s.cancel(); } catch {}
    const utterances = items
      .filter(
        (item): item is { text: string } =>
          typeof item === 'object' && item && 'text' in item && typeof (item as Record<string, unknown>).text === 'string'
      )
      .map((item) => {
        const u = new SpeechSynthesisUtterance(item.text);
        u.rate = 0.96;
        u.pitch = 1;
        u.volume = 1;
        return u;
      });
    if (!utterances.length) return null;
    let speaking = false;
    let started = false;
    const token: Narration = {
      speaking: () => speaking,
      started: () => started,
    };
    let finished = false;
    const finish = (late: boolean) => {
      if (finished) return;
      finished = true;
      speaking = false;
      if (current) {
        current = null;
      }
    };
    for (const u of utterances) {
      u.onstart = () => {
        if (finished) return;
        started = true;
        speaking = true;
      };
      u.onend = () => {
        if (finished) return;
        speaking = false;
      };
      u.onerror = () => {
        if (finished) return;
        speaking = false;
      };
    }
    try {
      for (const u of utterances) {
        s.speak(u);
      }
    } catch {
      return null;
    }
    const cancel = () => {
      try { s.cancel(); } catch {}
    };
    current = {
      cancel: () => {
        if (!current) return;
        cancel();
        finish(true);
      },
    };
    window.setTimeout(() => {
      if (!started && !finished) {
        started = true;
        speaking = false;
        finish(false);
      }
    }, 6000);
    return token;
  }

  function stopNarration(): void {
    const s = ready();
    if (!s) return;
    try { s.cancel(); } catch {}
    const c = current;
    current = null;
    if (c) c.cancel();
  }

  return {
    startNarration,
    stopNarration,
    fallbackReadSeconds: estimateReadSeconds,
  };
}

export function installReader(): void {
  if (typeof window === 'undefined') return;
  if (ready()) return;
  makeReader();
}

export function startNarration(
  items: (string | { text: string; syncCaption?: boolean })[]
): Narration | null {
  if (!ready()) {
    installReader();
  }
  if (!ready()) return null;
  return makeReader().startNarration(items);
}

export function stopNarration(): void {
  if (!ready()) {
    installReader();
  }
  if (!ready()) return;
  makeReader().stopNarration();
}

export function fallbackReadSeconds(text: string): number {
  return makeReader().fallbackReadSeconds(text);
}

export function waitForNarration(
  spoken: Narration | null,
  minMs: number,
  maxMs: number,
  alive: () => boolean
): Promise<void> {
  return new Promise((resolve) => {
    if (!spoken) {
      window.setTimeout(resolve, Math.max(minMs, 400));
      return;
    }
    const startedAt = performance.now();
    const waitMs = Math.max(minMs, Math.min(maxMs, 12000));
    let done = false;
    const check = () => {
      if (done) return;
      if (!alive()) { resolve(); return; }
      if (!spoken.speaking() && performance.now() - startedAt >= waitMs) {
        done = true;
        resolve();
        return;
      }
      if (!spoken.speaking() && spoken.started()) {
        done = true;
        resolve();
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

export function installBreakVoice(_host: HTMLElement): void {
  installReader();
}
