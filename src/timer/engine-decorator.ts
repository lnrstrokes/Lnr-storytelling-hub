/* ==========================================================================
   engine-decorator.ts — additive hooks for the Video engine.

   This module is intentionally import-last from the engine's point of view:
   TimerApp installs it after the engine has bound by id and published its
   public surface. Engine.js itself is not edited.

   What lives here:
     · a small interactive-session note that can be shown even when the
       streamer owns the video, so viewers know the clip is part of a
       quiz/anecdote session
     · a public API (`setInteractiveDisclaimer` / `getInteractiveDisclaimer`)
       so the Pro panel can later edit or preload that note
     · the upper-frame "video restarts soon" notice installer
     · the CSS-ready break-card background layer + motion treatments
   ========================================================================== */

export const INTERACTIVE_SESSION_DEFAULT =
  'This clip is part of an interactive session: a short quiz and a quick anecdote will appear as the video plays. Jump in when the questions show up.';

export function currentDisclaimer(): string {
  try {
    const raw = localStorage.getItem('lnr_video_disclaimer_v1');
    if (!raw) return INTERACTIVE_SESSION_DEFAULT;
    const parsed = JSON.parse(raw) as { copy?: string } | null;
    return typeof parsed?.copy === 'string' && parsed.copy.trim()
      ? parsed.copy.trim()
      : INTERACTIVE_SESSION_DEFAULT;
  } catch {
    return INTERACTIVE_SESSION_DEFAULT;
  }
}

export function setInteractiveDisclaimer(
  clipName?: string | null,
  copy?: string
): void {
  const editingPro =
    typeof window !== 'undefined' &&
    (window as unknown as { LNR_PRO?: { isPro: () => boolean } }).LNR_PRO?.isPro?.() === true;

  const state = {
    copy: typeof copy === 'string' && copy.trim() ? copy.trim() : INTERACTIVE_SESSION_DEFAULT,
    clipName: typeof clipName === 'string' ? clipName : null,
    editedByPro: editingPro && copy && copy.trim()
  };

  try {
    localStorage.setItem('lnr_video_disclaimer_v1', JSON.stringify(state));
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      (window as unknown as { LNR_VIDEO_DISCLAIMER?: typeof state }).LNR_VIDEO_DISCLAIMER = state;
    } catch {}
  }
}

export function getInteractiveDisclaimer(): {
  copy: string;
  clipName: string | null;
  editedByPro: boolean;
} {
  try {
    const raw = localStorage.getItem('lnr_video_disclaimer_v1');
    if (!raw) return { copy: INTERACTIVE_SESSION_DEFAULT, clipName: null, editedByPro: false };
    const parsed = JSON.parse(raw) as {
      copy?: string;
      clipName?: string | null;
      editedByPro?: boolean;
    } | null;
    return {
      copy: typeof parsed?.copy === 'string' && parsed.copy.trim() ? parsed.copy.trim() : INTERACTIVE_SESSION_DEFAULT,
      clipName: typeof parsed?.clipName === 'string' ? parsed.clipName : null,
      editedByPro: !!parsed?.editedByPro
    };
  } catch {
    return { copy: INTERACTIVE_SESSION_DEFAULT, clipName: null, editedByPro: false };
  }
}

/**
 * Install the upper-frame "video restarts soon" notice. This is additive and
 * fail-open: if the stage markup is not present, the notice element is created
 * lazily the first time it would be shown.
 */
export function installAnecdoteRestartNotice(): void {
  if (typeof document === 'undefined') return;

  let noticeEl: HTMLElement | null = null;
  let noticeTimer: number | null = null;

  function ensureNotice(): HTMLElement {
    if (noticeEl && noticeEl.isConnected) return noticeEl;
    const stage = document.getElementById('videoStage') || document.body;
    const existing = stage.querySelector<HTMLElement>('#videoRestartNotice');
    if (existing && existing.isConnected) {
      noticeEl = existing;
      return noticeEl;
    }
    const banner = document.createElement('div');
    banner.id = 'videoRestartNotice';
    banner.className = 'video-restart-notice';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<span class="vr-label">Video restarts soon</span>' +
      '<span class="vr-clock">10s</span>';
    stage.appendChild(banner);
    noticeEl = banner;
    return noticeEl;
  }

  function startNotice(): void {
    if (!document.body.classList.contains('screen-stage')) return;
    const el = ensureNotice();
    if (!el) return;
    el.classList.add('is-visible');
    const clock = el.querySelector<HTMLElement>('.vr-clock');
    if (!clock) return;

    let left = 10;
    clock.textContent = left + 's';
    if (noticeTimer) window.clearInterval(noticeTimer);
    noticeTimer = window.setInterval(() => {
      if (!document.body.classList.contains('screen-stage')) {
        clearNotice();
        return;
      }
      left -= 0.1;
      if (left <= 0) {
        left = 0;
        clock.textContent = '0s';
      }
      clock.textContent = Math.max(0, Math.ceil(left)) + 's';
    }, 100);
  }

  function clearNotice(): void {
    if (noticeTimer) {
      window.clearInterval(noticeTimer);
      noticeTimer = null;
    }
    if (noticeEl && noticeEl.isConnected) {
      noticeEl.classList.remove('is-visible');
    }
  }

  try {
    document.addEventListener('lnr:break-run', function (e) {
      var detail = (e as unknown as { detail?: { anecdote?: unknown; item?: { anecdote?: unknown } } }).detail;
      if (!detail) return;
      var hasAnecdote = !!(detail.anecdote || (detail.item && detail.item.anecdote));
      if (!hasAnecdote) return;
      startNotice();
    });
  } catch {}

  try {
    document.addEventListener('play', clearNotice);
  } catch {}
  try {
    document.addEventListener('lnr:phase-changed', clearNotice);
  } catch {}

  const stageVideo = document.getElementById('stageVideo') as HTMLVideoElement | null;
  stageVideo?.addEventListener('play', clearNotice);
}

/** Break-card treatment options exposed so the host UI can pick one. */
export const BREAK_CARD_TREATMENTS = [
  { value: 'none', label: 'Static card' },
  { value: 'drift', label: 'Slow drift' },
  { value: 'parallax', label: 'Soft parallax' },
  { value: 'pull', label: 'Gentle pull' }
] as const;

export type BreakCardTreatment = (typeof BREAK_CARD_TREATMENTS)[number]['value'];

/** CSS class for a chosen treatment, or '' when no motion is requested. */
export function breakCardTreatmentClass(
  treatment: BreakCardTreatment | null | undefined
): string {
  if (!treatment || treatment === 'none') return '';
  return `vbreak-treatment-${treatment}`;
}

/** Ensure the optional background layer exists on a break card. */
export function ensureBreakCardBgLayer(card: HTMLElement): HTMLDivElement {
  let layer = card.querySelector<HTMLDivElement>('.vbreak-bg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'vbreak-bg-layer';
    card.insertBefore(layer, card.firstChild);
  }
  return layer;
}
