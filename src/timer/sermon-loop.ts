/* ============================================================
   lnr Studio — Sermon Loop Mode (Captions, AI Break Plans & Playback)
   ============================================================ */

export interface SermonCaptionCue {
  id?: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

export interface SermonQuizQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface SermonBreakItem {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  questions: SermonQuizQuestion[];
  anecdote: string;
  hostNote?: string;
  approved?: boolean;
  shown?: boolean;
}

export interface SermonPlan {
  sermonTitle: string;
  churchName: string;
  intervalMinutes: number;
  questionsPerBreak: number;
  includeAnecdote: boolean;
  varyTiming: boolean;
  breaks: SermonBreakItem[];
}

export function parseSrtOrVtt(fileText: string): SermonCaptionCue[] {
  const cues: SermonCaptionCue[] = [];
  const lines = fileText.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  function parseTimestamp(ts: string): number {
    // HH:MM:SS,mmm or MM:SS.mmm
    const clean = ts.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      return m * 60 + s;
    }
    return 0;
  }

  while (i < lines.length) {
    let line = lines[i].trim();
    if (!line || line === 'WEBVTT' || line.startsWith('NOTE')) {
      i++;
      continue;
    }

    // Check if line is cue number or contains timestamp arrow -->
    if (line.includes('-->') || (i + 1 < lines.length && lines[i + 1].includes('-->'))) {
      if (!line.includes('-->')) {
        i++;
        line = lines[i].trim();
      }
      const arrowIdx = line.indexOf('-->');
      if (arrowIdx > 0) {
        const startStr = line.slice(0, arrowIdx).trim();
        const endStr = line.slice(arrowIdx + 3).trim().split(' ')[0];
        const startTime = parseTimestamp(startStr);
        const endTime = parseTimestamp(endStr);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        const text = textLines.join(' ').replace(/<[^>]*>/g, '');
        if (text && endTime > startTime) {
          cues.push({ startTime, endTime, text });
        }
      }
    }
    i++;
  }

  return cues;
}

export function segmentCaptions(cues: SermonCaptionCue[], intervalMinutes: number, varyTiming: boolean): { startTime: number; endTime: number; text: string }[] {
  const intervalSec = intervalMinutes * 60;
  const segments: { startTime: number; endTime: number; text: string }[] = [];
  if (!cues.length) return segments;

  let currentStart = cues[0].startTime;
  let currentTexts: string[] = [];
  let targetEnd = currentStart + intervalSec;

  if (varyTiming) {
    // Shift by up to 15% randomly
    const jitter = (Math.random() * 0.3 - 0.15) * intervalSec;
    targetEnd += jitter;
  }

  for (const cue of cues) {
    currentTexts.push(cue.text);
    if (cue.endTime >= targetEnd || cue === cues[cues.length - 1]) {
      // Find sentence end if possible
      segments.push({
        startTime: currentStart,
        endTime: cue.endTime,
        text: currentTexts.join(' ')
      });
      currentStart = cue.endTime;
      targetEnd = currentStart + intervalSec;
      currentTexts = [];
    }
  }

  return segments;
}

if (typeof window !== 'undefined') {
  (window as unknown as { LNR_SERMON: { parseSrtOrVtt: typeof parseSrtOrVtt; segmentCaptions: typeof segmentCaptions } }).LNR_SERMON = {
    parseSrtOrVtt,
    segmentCaptions
  };
}

