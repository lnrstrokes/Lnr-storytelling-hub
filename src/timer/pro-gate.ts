/* ==========================================================================
   pro-gate.ts — where Free ends and Pro begins
   --------------------------------------------------------------------------
   WHY THIS IS A SEPARATE MODULE, OUTSIDE THE ENGINE

   src/timer/engine.js is 7,293 lines of hand-tuned streaming logic that has
   already run multi-hour broadcasts. Adding licence checks inside it would
   mean editing that file for something completely unrelated to broadcasting.

   Instead this module sits BETWEEN the markup and the engine and enforces the
   tier at the only boundary the engine cannot bypass — the DOM:

     · brand text   — the value comes from the licence, and typing is stopped
                      before the browser can change the field
     · promo uploads — the file input's `change` event never reaches the engine
     · promo sequence — the order / layout selects are disabled and reverted

   Everything is registered on `document` in the CAPTURE phase, which runs
   before the engine's own listeners no matter what order they were attached.
   The engine therefore keeps working untouched, and if this module is ever
   removed the app falls back to the old unlimited behaviour rather than
   breaking.

   THE ONE THING IT DOES WRITE

   The brand lives in the engine's own settings blob (localStorage
   `lnr_timer_v2`). On activation we copy the licence brand into it and reload
   once, so the stage watermark, the break overlay and the settings fields all
   agree. The previous value is remembered and restored on deactivation.
   ========================================================================== */

import { PRO_LIMITS, getProState, openProPanel } from '../pro/license';

const SETTINGS_KEY = 'lnr_timer_v2';
const PREV_BRAND_KEY = 'lnr_pro_prev_brand';

/** Fields whose value is issued with the licence. */
const BRAND_FIELDS = ['stBrandOverlayInput', 'brandOverlayInput'];
const WATERMARK_FIELDS = ['stWatermarkInput', 'watermarkInput'];

/** File input id -> the list the engine renders its clips into. */
const UPLOAD_LISTS: Record<string, { listId: string; kind: 'video' | 'promo' }> = {
  videoInput: { listId: 'clipList', kind: 'video' },
  promoInput: { listId: 'promoList', kind: 'promo' },
  adminPromoFilesInput: { listId: 'adminPromoList', kind: 'promo' },
  adminPromoFolderInput: { listId: 'adminPromoList', kind: 'promo' }
};

/** Prerecorded videos a Free account may upload. */
const FREE_VIDEO_CLIPS = 1;

/** Every control that adds a promo break clip (setup panel and admin folder). */
const PROMO_UPLOAD_INPUTS = ['promoInput', 'adminPromoFilesInput', 'adminPromoFolderInput'];

/** Controls that make up the promo rotation sequence. */
const SEQUENCE_CONTROLS = ['adminPromoOrder', 'adminPromoDisplay'];
const SEQUENCE_SETTINGS: Record<string, { key: string; fallback: string }> = {
  adminPromoOrder: { key: 'promoOrder', fallback: 'sequential' },
  adminPromoDisplay: { key: 'promoDisplayMode', fallback: 'full' }
};

type Settings = Record<string, unknown>;

function readSettings(): Settings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Settings) : {};
  } catch {
    return {};
  }
}

function writeSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode: the licence still works, the brand just reloads */
  }
}

/** The brand this device is locked to, or null when the field is editable. */
function lockedBrand(): string | null {
  const state = getProState();
  const licence = state.active ? state.license : null;
  /* The owner-device switch carries no brand: the studio keeps its own. */
  return licence && licence.lockBrand && !licence.owner ? licence.brand : null;
}

/* ------------------------------------------------------------------ toast */

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;

function notify(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'status');
    Object.assign(toastEl.style, {
      position: 'fixed',
      left: '50%',
      bottom: '68px',
      transform: 'translateX(-50%)',
      maxWidth: 'min(420px, calc(100vw - 32px))',
      padding: '11px 16px',
      borderRadius: '10px',
      border: '1px solid rgba(217,171,99,0.45)',
      background: '#0b1219',
      color: '#e8e3d8',
      font: '13px/1.45 ui-sans-serif, system-ui, sans-serif',
      boxShadow: '0 12px 30px rgba(0,0,0,.5)',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 160ms ease'
    });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = '0';
  }, 3600);
}

/* ------------------------------------------------------------------- lock */

function restoreBrandFields(): void {
  const brand = lockedBrand();
  if (!brand) return;
  BRAND_FIELDS.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    if (input.value !== brand) input.value = brand;
    if (!input.readOnly) input.readOnly = true;
  });
}

/** The engine resets `readOnly` on every branding sync — put it back. */
function watchBrandFields(): void {
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(() => restoreBrandFields());
  BRAND_FIELDS.forEach((id) => {
    const input = document.getElementById(id);
    if (input) observer.observe(input, { attributes: true, attributeFilter: ['readonly'] });
  });
}

function applyUiState(): void {
  const state = getProState();
  const licence = state.active ? state.license : null;
  /* Customer keys carry a brand; the owner device does not. */
  const branded = licence && !licence.owner ? licence : null;
  const brand = lockedBrand();

  BRAND_FIELDS.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    if (branded) input.value = branded.brand;
    input.readOnly = !!brand;
    input.classList.toggle('is-locked', !!brand);
    input.title = brand
      ? 'Brand text is locked to this Pro licence — email lnrstrokes@gmail.com to change it'
      : 'Brand strap shown across paid channel breaks';
  });

  WATERMARK_FIELDS.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    if (branded && branded.watermark) input.value = branded.watermark;
  });

  const note = document.getElementById('promoTierLimitNote');
  if (note) {
    note.textContent = licence
      ? `Pro: up to ${PRO_LIMITS.promoClips} break clips (max 5:00 each) \u00b7 optional CSV playback log`
      : 'Promo break uploads are a Pro feature \u00b7 preloaded studio ads still play on Free';
  }

  SEQUENCE_CONTROLS.forEach((id) => {
    const control = document.getElementById(id) as HTMLSelectElement | null;
    if (!control) return;
    control.disabled = !licence;
    control.title = licence ? '' : 'Promo rotation is a Pro feature';
  });

  /* Free has no promo uploads at all, so the picker is disabled rather than
     opening and rejecting the file afterwards. The preloaded promo ads are
     unaffected: Free keeps the breaks toggle forced ON in the engine. */
  PROMO_UPLOAD_INPUTS.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    input.disabled = !licence;
    input.title = licence ? '' : 'Promo break uploads are a Pro feature';
  });

  applyVideoTierUi();
}

/**
 * The upload dropzone note and its upgrade link.
 *
 * The note lives in the markup (`#videoTierLimitNote`); the link is created
 * here as a SIBLING of the dropzone label, never inside it — a link inside a
 * <label> would open the file picker when tapped.
 */
function applyVideoTierUi(): void {
  const licence = getProState().active;
  const note = document.getElementById('videoTierLimitNote');
  if (note) {
    note.textContent = licence
      ? `Pro: up to ${PRO_LIMITS.videoClips} videos (MP4/WebM/MOV) \u00b7 stored locally on device`
      : `Free: ${FREE_VIDEO_CLIPS} video. Pro: up to ${PRO_LIMITS.videoClips}.`;
  }

  const promoNote = document.getElementById('promoTierLimitNote');
  if (promoNote && !promoNote.textContent) {
    promoNote.textContent = licence
      ? `Pro: up to ${PRO_LIMITS.promoClips} break clips (max 5:00 each) \u00b7 optional CSV playback log`
      : 'Promo break uploads are a Pro feature \u00b7 preloaded studio ads still play on Free';
  }

  const drop = document.getElementById('videoDrop');
  if (!drop) return;

  let bar = document.getElementById('videoTierUpgrade');
  if (!bar) {
    bar = document.createElement('p');
    bar.id = 'videoTierUpgrade';
    bar.className = 'video-tier-upgrade';

    const text = document.createElement('span');
    text.id = 'videoTierUpgradeText';
    bar.appendChild(text);

    const link = document.createElement('a');
    link.id = 'videoTierUpgradeLink';
    link.href = '#';
    link.textContent = 'Upgrade to Pro';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openProPanel();
    });
    bar.appendChild(link);

    drop.insertAdjacentElement('afterend', bar);
  }

  const text = document.getElementById('videoTierUpgradeText');
  const link = document.getElementById('videoTierUpgradeLink');
  bar.hidden = licence;
  if (!licence) {
    if (text) text.textContent = `Free includes ${FREE_VIDEO_CLIPS} video. `;
    if (link) link.hidden = false;
  }
}

/**
 * The transcript / Gemini sermon block is retired. Its markup is inert, but a
 * dead form in the setup wizard is confusing — so it is removed here rather
 * than by editing the 1,237-line markup file.
 */
function removeRetiredSermonUi(root: HTMLElement): void {
  root.querySelectorAll('h3').forEach((heading) => {
    if (!/Sermon\s*&\s*Message Quiz Loop/i.test(heading.textContent || '')) return;
    const block = heading.closest('.sub-block') || heading.parentElement;
    block?.remove();
  });
  const modal = document.getElementById('sermonReviewModal');
  modal?.remove();
}

/* --------------------------------------------------------------- handlers */

function fieldId(event: Event): string {
  const target = event.target as HTMLElement | null;
  return target && typeof target.id === 'string' ? target.id : '';
}

/** Stop a keystroke before the browser (and therefore the engine) sees it. */
function onBeforeInput(event: Event): void {
  const id = fieldId(event);
  if (!id || !BRAND_FIELDS.includes(id)) return;
  if (!lockedBrand()) return;
  event.preventDefault();
  notify('Brand text is locked to your Pro licence — email lnrstrokes@gmail.com to change it');
  restoreBrandFields();
}

function onInputCapture(event: Event): void {
  const id = fieldId(event);
  if (!id || !BRAND_FIELDS.includes(id)) return;
  if (!lockedBrand()) return;
  event.stopPropagation();
  restoreBrandFields();
}

function onChangeCapture(event: Event): void {
  const id = fieldId(event);
  if (!id) return;

  /* --- clip / promo uploads --- */
  const upload = UPLOAD_LISTS[id];
  if (upload) {
    const input = event.target as HTMLInputElement;
    const incoming = input.files ? input.files.length : 0;
    if (!incoming) return;

    const state = getProState();
    const existing = document.getElementById(upload.listId)?.childElementCount ?? 0;

    /* Videos: 1 on Free, 3 on Pro. Only new uploads are blocked — clips
       already on the device are never removed by the gate. */
    if (upload.kind === 'video') {
      const limit = state.active ? PRO_LIMITS.videoClips : FREE_VIDEO_CLIPS;
      if (existing + incoming > limit) {
        event.preventDefault();
        event.stopPropagation();
        input.value = '';
        notify(
          state.active
            ? `Pro allows up to ${limit} videos. Remove one first.`
            : `Free includes ${FREE_VIDEO_CLIPS} video. Activate a Pro key to upload up to ${PRO_LIMITS.videoClips}.`
        );
      }
      return;
    }

    const limit = state.active ? PRO_LIMITS.promoClips : 0;

    if (limit === 0) {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      notify(`Uploading promo break clips is part of Pro (up to ${PRO_LIMITS.promoClips}) — activate a key to unlock it.`);
      return;
    }
    if (existing + incoming > limit) {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      notify(`Pro allows up to ${limit} break clips. Remove one first.`);
    }
    return;
  }

  /* --- promo rotation sequence --- */
  if (SEQUENCE_CONTROLS.includes(id)) {
    if (getProState().active) return;
    event.stopPropagation();
    const mapping = SEQUENCE_SETTINGS[id];
    const control = event.target as HTMLSelectElement;
    control.value = String(readSettings()[mapping.key] || mapping.fallback);
    notify('The promo rotation sequence is part of Pro — activate a key to unlock it.');
  }
}

/**
 * Copy the licence brand into the engine's settings and reload once, so every
 * surface (stage watermark, break overlay, settings field) agrees.
 * Returns true when storage changed.
 */
function syncSettingsToLicence(): boolean {
  const state = getProState();
  const settings = readSettings();
  const currentBrand = typeof settings.brand === 'string' ? settings.brand : '';

  /* Owner Pro keeps the studio's own branding: restore whatever a customer
     key replaced, then stop. */
  if (state.active && state.license && state.license.owner) {
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(PREV_BRAND_KEY);
    } catch {
      previous = null;
    }
    if (previous === null) return false;
    settings.brand = previous || 'LNR Studio';
    writeSettings(settings);
    try {
      localStorage.removeItem(PREV_BRAND_KEY);
    } catch {
      /* ignore */
    }
    return true;
  }

  if (state.active && state.license) {
    const licence = state.license;
    const brandDiffers = currentBrand !== licence.brand;
    const watermarkDiffers = !!licence.watermark && settings.watermark !== licence.watermark;
    if (!brandDiffers && !watermarkDiffers) return false;
    try {
      if (!localStorage.getItem(PREV_BRAND_KEY)) {
        localStorage.setItem(PREV_BRAND_KEY, currentBrand);
      }
    } catch {
      /* ignore */
    }
    settings.brand = licence.brand;
    if (licence.watermark) settings.watermark = licence.watermark;
    writeSettings(settings);
    return true;
  }

  let previous: string | null = null;
  try {
    previous = localStorage.getItem(PREV_BRAND_KEY);
  } catch {
    previous = null;
  }
  if (previous === null) return false;
  settings.brand = previous || 'LNR Studio';
  writeSettings(settings);
  try {
    localStorage.removeItem(PREV_BRAND_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

let installed = false;

/**
 * Call once, right after the timer markup is in the DOM and BEFORE the engine
 * is imported, so the capture listeners are already in place.
 */
export function installProGate(root: HTMLElement): void {
  if (installed) return;
  installed = true;

  removeRetiredSermonUi(root);
  applyUiState();
  watchBrandFields();

  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('input', onInputCapture, true);
  document.addEventListener('change', onChangeCapture, true);

  window.addEventListener('lnr:pro-changed', () => {
    if (syncSettingsToLicence()) {
      // Fresh boot picks the licence brand up everywhere at once.
      window.location.reload();
      return;
    }
    applyUiState();
  });
}
