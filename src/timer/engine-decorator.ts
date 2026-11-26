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
      // Don't start the notice yet - wait until the anecdote is about to finish
      // The notice will be shown 10s before video restarts
    });
  } catch {}

  // Show the restart notice when the anecdote finishes (10s before video restarts)
  try {
    document.addEventListener('lnr:anecdote-finished', function () {
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

/**
 * Preloaded background templates available to creators.
 * Each template is a gradient preset - creators can also upload their own images.
 */
export const BREAK_CARD_TEMPLATES = [
  { id: 'template-1', name: 'Deep Navy', cssClass: 'vbreak-template-1' },
  { id: 'template-2', name: 'Abyss', cssClass: 'vbreak-template-2' },
  { id: 'template-3', name: 'Midnight', cssClass: 'vbreak-template-3' },
  { id: 'template-4', name: 'Void', cssClass: 'vbreak-template-4' },
  { id: 'template-5', name: 'Ocean', cssClass: 'vbreak-template-5' },
  { id: 'template-6', name: 'Sunset', cssClass: 'vbreak-template-6' }
] as const;

/**
 * Install background template picker and motion effect selector in the break panel.
 * This adds the UI for creators to customize their break card appearance.
 */
export function installBreakCardCustomizer(): void {
  if (typeof document === 'undefined') return;
  
  const panel = document.querySelector<HTMLElement>('.vbreak-panel');
  if (!panel) return;
  
  // Check if already installed
  if (panel.querySelector('.vbreak-bg-selector')) return;
  
  // Create background template section
  const bgSection = document.createElement('div');
  bgSection.className = 'vbreak-bg-selector';
  bgSection.innerHTML = `
    <div class="dsec-head">
      <h4>Background Template</h4>
      <span style="font-size:11px;color:var(--muted);font-family:var(--mono,monospace)">Choose a gradient or upload your own image</span>
    </div>
    <div class="vbreak-bg-options" id="vbreakBgOptions"></div>
    <label class="file-pick" style="margin-top:8px">
      <input type="file" id="vbreakBgUpload" accept=".jpg,.jpeg,.png,.webp" />
      <span>Upload custom background (JPEG, PNG)</span>
    </label>
    <div class="vbreak-motion-selector">
      <span style="font-size:11px;color:var(--muted);margin-right:4px">Motion:</span>
    </div>
    <button class="vbreak-remove-bg" id="vbreakRemoveBg" hidden>Remove background</button>
  `;
  
  // Add template options
  const bgOptions = bgSection.querySelector('#vbreakBgOptions');
  if (bgOptions) {
    BREAK_CARD_TEMPLATES.forEach((template) => {
      const option = document.createElement('div');
      option.className = `vbreak-bg-option ${template.cssClass}`;
      option.dataset.templateId = template.id;
      option.innerHTML = `
        <div class="template-pattern"></div>
        <div class="bg-label">${template.name}</div>
        <div class="bg-check">✓</div>
      `;
      option.addEventListener('click', () => {
        document.querySelectorAll('.vbreak-bg-option').forEach(o => o.classList.remove('isselected'));
        option.classList.add('is-selected');
        applyBackgroundTemplate(template.id);
        saveBgPreference('template-' + template.id);
      });
      bgOptions.appendChild(option);
    });
    // Select first template by default
    const first = bgOptions.querySelector('.vbreak-bg-option');
    if (first) first.classList.add('is-selected');
  }
  
  // Add motion effect options
  const motionSelector = bgSection.querySelector('.vbreak-motion-selector');
  if (motionSelector) {
    BREAK_CARD_TREATMENTS.forEach((treatment) => {
      const option = document.createElement('button');
      option.className = 'vbreak-motion-option';
      option.dataset.treatment = treatment.value;
      option.textContent = treatment.label;
      if (treatment.value === 'none') option.textContent = 'Static';
      option.addEventListener('click', () => {
        document.querySelectorAll('.vbreak-motion-option').forEach(o => o.classList.remove('is-selected'));
        option.classList.add('is-selected');
        applyMotionEffect(treatment.value);
        saveBgPreference('motion-' + treatment.value);
      });
      motionSelector.appendChild(option);
    });
    // Select 'none' by default
    const noneOption = motionSelector.querySelector('[data-treatment="none"]');
    if (noneOption) noneOption.classList.add('is-selected');
  }
  
  // Upload handler
  const uploadInput = bgSection.querySelector('#vbreakBgUpload');
  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      try {
        const url = URL.createObjectURL(file);
        const layer = ensureBreakCardBgLayer(document.querySelector('.vbreak-card') || document.createElement('div'));
        layer.style.backgroundImage = `url(${url})`;
        layer.style.backgroundSize = 'cover';
        layer.style.backgroundPosition = 'center';
        
        document.querySelectorAll('.vbreak-bg-option').forEach(o => o.classList.remove('is-selected'));
        const removeBtn = document.querySelector('#vbreakRemoveBg');
        if (removeBtn) (removeBtn as HTMLElement).hidden = false;
        saveBgPreference('uploaded-' + file.name);
        alert('Background image uploaded');
      } catch (err) {
        alert('Failed to load image');
      }
    });
  }
  
  // Remove background handler
  const removeBtn = bgSection.querySelector('#vbreakRemoveBg');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const layer = ensureBreakCardBgLayer(document.querySelector('.vbreak-card') || document.createElement('div'));
      layer.style.backgroundImage = '';
      layer.className = 'vbreak-bg-layer';
      document.querySelectorAll('.vbreak-bg-option').forEach(o => o.classList.remove('is-selected'));
      (removeBtn as HTMLElement).hidden = true;
      saveBgPreference('none');
      alert('Background removed');
    });
  }
  
  // Insert after the break switch
  const breakSwitch = panel.querySelector('.vbreak-switch')?.closest('.vbreak-row');
  if (breakSwitch) {
    breakSwitch.after(bgSection);
  } else {
    panel.appendChild(bgSection);
  }

  /* The pack is engine-scoped: hide it straight away when the studio is set to
     the video engine, and keep it in step if the operator changes engine. */
  syncGraphicPack();
  window.addEventListener('lnr:engine-changed', syncGraphicPack);
}

/** The graphic pack (background templates + motion) belongs to the engines that
 *  put a word-led card on the stage. The video engine airs footage, so the
 *  pack is neither offered nor applied there. */
const GRAPHIC_PACK_ENGINES = ['quiz', 'players', 'story'];

/** The engine the studio currently has selected, read from the same settings
 *  record the engine itself persists. */
function currentEngine(): string {
  try {
    const raw = localStorage.getItem('lnr_timer_v2');
    if (!raw) return 'quiz';
    const parsed = JSON.parse(raw) as { engine?: string } | null;
    const engine = parsed && typeof parsed.engine === 'string' ? parsed.engine : 'quiz';
    return GRAPHIC_PACK_ENGINES.includes(engine) || engine === 'video' ? engine : 'quiz';
  } catch {
    return 'quiz';
  }
}

function graphicPackAllowed(): boolean {
  return GRAPHIC_PACK_ENGINES.includes(currentEngine());
}

/**
 * Show or hide the graphic pack for the selected engine, and undo any treatment
 * already painted on the card when the video engine is in charge.
 */
export function syncGraphicPack(): void {
  if (typeof document === 'undefined') return;
  const panel = document.querySelector<HTMLElement>('.vbreak-panel');
  const section = panel ? panel.querySelector<HTMLElement>('.vbreak-bg-selector') : null;
  const allowed = graphicPackAllowed();

  if (section) section.hidden = !allowed;

  if (!allowed) {
    /* Nothing from the pack may reach the video engine's footage. */
    const card = document.querySelector<HTMLElement>('.vbreak-card');
    if (card) {
      card.className = card.className.replace(/vbreak-treatment-\w+/g, '').trim();
    }
    const layer = document.querySelector<HTMLElement>('.vbreak-card .vbreak-bg-layer');
    if (layer) {
      layer.style.backgroundImage = '';
      layer.className = 'vbreak-bg-layer';
    }
  }
}

function applyBackgroundTemplate(templateId: string): void {
  if (!graphicPackAllowed()) return;
  const card = document.querySelector<HTMLElement>('.vbreak-card');
  if (!card) return;
  
  const layer = ensureBreakCardBgLayer(card);
  layer.style.backgroundImage = '';
  layer.className = 'vbreak-bg-layer';
  
  const template = BREAK_CARD_TEMPLATES.find(t => t.id === templateId);
  if (template) {
    layer.classList.add(template.cssClass);
  }
}

function applyMotionEffect(treatment: string): void {
  if (!graphicPackAllowed()) return;
  const card = document.querySelector<HTMLElement>('.vbreak-card');
  if (!card) return;
  
  // Remove all treatment classes
  card.className = card.className.replace(/vbreak-treatment-\w+/g, '').trim();
  
  if (treatment !== 'none') {
    card.classList.add(`vbreak-treatment-${treatment}`);
  }
}

function saveBgPreference(value: string): void {
  try {
    localStorage.setItem('lnr_break_card_bg_v1', value);
  } catch {}
}

function loadBgPreference(): void {
  try {
    const saved = localStorage.getItem('lnr_break_card_bg_v1');
    if (!saved) return;
    /* A saved pack must not be re-applied in the video engine. */
    if (!graphicPackAllowed()) return;
    
    if (saved.startsWith('template-')) {
      applyBackgroundTemplate(saved);
      const option = document.querySelector(`[data-template-id="${saved}"]`);
      if (option) option.classList.add('is-selected');
    } else if (saved.startsWith('motion-')) {
      applyMotionEffect(saved.replace('motion-', ''));
      const option = document.querySelector(`[data-treatment="${saved.replace('motion-', '')}"]`);
      if (option) option.classList.add('is-selected');
    }
  } catch {}
}

/** Ensure the customizer is installed after the break panel is built */
export function onBreakPanelReady(): void {
  loadBgPreference();
  installBreakCardCustomizer();
  syncGraphicPack();
}