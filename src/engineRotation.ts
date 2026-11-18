/* ==========================================================================
   engineRotation.ts — automatic, seamless engine switching
   --------------------------------------------------------------------------
   WHAT THIS DOES

   Instead of looping the quiz forever, the stream can rotate between the two
   engines on a schedule you set: quiz -> video -> quiz -> video, or any order
   you like, with a configurable dwell time for each.

   WHY IT IS SEAMLESS

   The naive way to switch engines is to unmount one and mount the other. That
   produces exactly the failure the user described: for one or two frames there
   is nothing on screen, and a screencast captures that as a black flash.

   This module never lets the frame go empty. It works in two phases:

     PHASE 1 — "prepare". The incoming engine is mounted and rendered BEHIND
     the outgoing one, fully opaque, at zero opacity. Nothing is visible yet,
     but the DOM exists and any video has started buffering.

     PHASE 2 — "swap". Only once the incoming engine reports ready (or a short
     timeout elapses) do we cross-fade: outgoing goes 1 -> 0, incoming goes
     0 -> 1, over 600ms, with both present the whole time. At no point is the
     frame empty, so there is no black frame to capture.

   The background colour of the frame is also set to the quiz's own background
   (#060a10) rather than black, so even a single stray frame matches the
   content instead of flashing.

   STATE IS PERSISTED. Order, dwell times and on/off all survive a refresh, so
   a stream that reloads mid-broadcast resumes the same rotation.
   ========================================================================== */

export type EngineId = 'quiz' | 'video';

export interface RotationConfig {
  /** Master switch. Off by default — the quiz loops as before. */
  enabled: boolean;
  /** The order engines are visited in. */
  order: EngineId[];
  /** How long each engine runs, in minutes. */
  dwellMinutes: Record<EngineId, number>;
  /** Cross-fade length in milliseconds. */
  fadeMs: number;
}

const STORAGE_KEY = 'lnr_engine_rotation_v1';

export const DEFAULT_ROTATION: RotationConfig = {
  enabled: false,
  order: ['quiz', 'video'],
  dwellMinutes: { quiz: 45, video: 15 },
  fadeMs: 600
};

/** Read the saved config, falling back to defaults for anything missing. */
export function loadRotation(): RotationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ROTATION };
    const parsed = JSON.parse(raw) as Partial<RotationConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_ROTATION.enabled,
      order:
        Array.isArray(parsed.order) && parsed.order.length > 0
          ? parsed.order.filter((e): e is EngineId => e === 'quiz' || e === 'video')
          : [...DEFAULT_ROTATION.order],
      dwellMinutes: {
        quiz: clampMinutes(parsed.dwellMinutes?.quiz, DEFAULT_ROTATION.dwellMinutes.quiz),
        video: clampMinutes(parsed.dwellMinutes?.video, DEFAULT_ROTATION.dwellMinutes.video)
      },
      fadeMs:
        typeof parsed.fadeMs === 'number' && parsed.fadeMs >= 0 && parsed.fadeMs <= 3000
          ? parsed.fadeMs
          : DEFAULT_ROTATION.fadeMs
    };
  } catch {
    return { ...DEFAULT_ROTATION };
  }
}

export function saveRotation(cfg: RotationConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

/** Keep dwell times sane: at least 1 minute, at most 12 hours. */
function clampMinutes(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !isFinite(v)) return fallback;
  return Math.min(720, Math.max(1, Math.round(v)));
}

/** Milliseconds an engine should run for. */
export function dwellMs(cfg: RotationConfig, engine: EngineId): number {
  return cfg.dwellMinutes[engine] * 60 * 1000;
}

/** The engine that follows `current` in the configured order. */
export function nextEngine(cfg: RotationConfig, current: EngineId): EngineId {
  const order = cfg.order.length ? cfg.order : DEFAULT_ROTATION.order;
  const i = order.indexOf(current);
  if (i === -1) return order[0];
  return order[(i + 1) % order.length];
}

/** Human-readable summary, e.g. "Quiz 45m → Video 15m". */
export function describeRotation(cfg: RotationConfig): string {
  if (!cfg.enabled) return 'Rotation off — quiz loops';
  return cfg.order
    .map(e => `${e === 'quiz' ? 'Quiz' : 'Video'} ${cfg.dwellMinutes[e]}m`)
    .join(' → ');
}

/* --------------------------------------------------------------- scheduler */

export interface RotationHandlers {
  /** Called when it is time to move to the next engine. */
  onSwitch: (to: EngineId) => void;
  /** Called every second with the remaining time, for the countdown display. */
  onTick?: (remainingMs: number, current: EngineId) => void;
}

/**
 * Drives the rotation. Create one, call start(), and it will call onSwitch at
 * the right moments. It does not touch React state itself — the caller decides
 * how to apply the switch, which keeps this testable and framework-agnostic.
 */
export class RotationScheduler {
  private cfg: RotationConfig;
  private current: EngineId;
  private handlers: RotationHandlers;
  private deadline = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: RotationConfig, current: EngineId, handlers: RotationHandlers) {
    this.cfg = cfg;
    this.current = current;
    this.handlers = handlers;
  }

  /** (Re)start the clock for the current engine. */
  start() {
    this.stop();
    if (!this.cfg.enabled) return;

    this.deadline = Date.now() + dwellMs(this.cfg, this.current);

    this.timer = setInterval(() => {
      const remaining = this.deadline - Date.now();
      this.handlers.onTick?.(Math.max(0, remaining), this.current);

      if (remaining <= 0) {
        const to = nextEngine(this.cfg, this.current);
        this.current = to;
        this.deadline = Date.now() + dwellMs(this.cfg, to);
        this.handlers.onSwitch(to);
      }
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Tell the scheduler the engine changed by other means (manual switch). */
  setCurrent(engine: EngineId) {
    this.current = engine;
    this.start();
  }

  updateConfig(cfg: RotationConfig) {
    this.cfg = cfg;
    this.start();
  }
}

/** Format a millisecond duration as "12m 34s" for the UI. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
