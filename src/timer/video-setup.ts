/* ==========================================================================
   video-setup.ts — the video setup panel's controls that had no wires
   --------------------------------------------------------------------------
   Two things in the "Video clips & loop duration" panel looked finished but
   were not wired to anything:

     1. "Video clip rotation process" — the Sequential / Shuffle pills had no
        click handler at all, so tapping them did nothing and the engine always
        played 1 -> 2 -> 3.
     2. "Upload quiz file" / "Upload anecdote file" — the buttons called
        .click() on a display:none <input type=file>. In an installed PWA on
        Android that is unreliable, and even when it worked there was no
        confirmation that the file had been accepted.

   Like pro-gate.ts, this module fixes the panel from the outside, so the
   break parser itself stays untouched. It:

     · turns the two upload buttons into native <label for> controls, which
       the browser activates itself — no scripted click on a hidden input
     · makes the file inputs visually hidden instead of display:none
     · gives an extension-less file a .txt name before the parser sees it
     · reports "file loaded" (or the parser's own error) in the panel
     · persists Sequential / Shuffle and paints the selected pill

   The engine reads the same order key when it hands off to the next clip
   (see clipOrderPlugin in vite.config.ts), so a change applies from the next
   clip without a reload.
   ========================================================================== */

const ORDER_KEY = 'lnr_video_order_v1';

export type VideoOrder = 'sequential' | 'shuffle';

interface UploadControl {
  buttonId: string;
  inputId: string;
  kind: string;
}

const UPLOADS: UploadControl[] = [
  { buttonId: 'vbreakQuizBtn', inputId: 'vbreakQuizInput', kind: 'Quiz' },
  { buttonId: 'vbreakAnecdoteBtn', inputId: 'vbreakAnecdoteInput', kind: 'Anecdote' }
];

function getVideoOrder(): VideoOrder {
  try {
    return localStorage.getItem(ORDER_KEY) === 'shuffle' ? 'shuffle' : 'sequential';
  } catch {
    return 'sequential';
  }
}

function saveVideoOrder(order: VideoOrder): void {
  try {
    localStorage.setItem(ORDER_KEY, order);
  } catch {
    /* private mode: the engine simply keeps its current order */
  }
}

function describeOrder(order: VideoOrder): string {
  return order === 'shuffle'
    ? 'Clips play in random order, never the same clip twice in a row.'
    : 'Clips play in order (1, 2, 3 …), then start again.';
}

/* ------------------------------------------------------------- status note */

let noteTimer = 0;

/** The panel already has a status line; use it, but say it plainly. */
function showNote(message: string, ok: boolean, holdMs = 9000): void {
  const note = document.getElementById('vbreakNote');
  if (!note) return;
  note.textContent = message;
  note.style.color = ok ? '#cfe3c3' : '#f0b9a4';
  note.style.fontWeight = '600';
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    note.textContent = '';
    note.style.color = '';
    note.style.fontWeight = '';
  }, holdMs);
}

/* ---------------------------------------------------------------- rotation */

function installRotation(root: HTMLElement): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-videorot]'));
  if (!buttons.length) return;

  let note = document.getElementById('vidRotNote');
  if (!note) {
    note = document.createElement('p');
    note.id = 'vidRotNote';
    note.setAttribute('role', 'status');
    Object.assign(note.style, {
      margin: '8px 0 0',
      fontSize: '12.5px',
      lineHeight: '1.45',
      color: '#9aab9f'
    });
    buttons[0].parentElement?.insertAdjacentElement('afterend', note);
  }

  const noteEl = note;
  let resetTimer = 0;

  const paint = (saved: boolean) => {
    const order = getVideoOrder();
    buttons.forEach((button) => {
      const selected = button.dataset.videorot === order;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    noteEl.textContent = saved
      ? `Saved · ${order === 'shuffle' ? 'clips will play in random order.' : 'clips will play in 1, 2, 3 order.'}`
      : describeOrder(order);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const next: VideoOrder = button.dataset.videorot === 'shuffle' ? 'shuffle' : 'sequential';
      saveVideoOrder(next);
      paint(true);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => paint(false), 2600);
    });
  });

  paint(false);
}

/* ----------------------------------------------------------------- uploads */

function installUploads(): void {
  UPLOADS.forEach((spec) => {
    const button = document.getElementById(spec.buttonId);
    const input = document.getElementById(spec.inputId) as HTMLInputElement | null;
    if (!button || !input) return;

    /* Visually hidden, but still a real input: several Android builds refuse
       to open the picker for an input with display:none. */
    input.removeAttribute('hidden');
    Object.assign(input.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      padding: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none'
    });

    const label = document.createElement('label');
    label.className = button.className;
    label.id = button.id;
    label.textContent = button.textContent || '';
    label.setAttribute('for', spec.inputId);
    label.setAttribute('role', 'button');
    label.tabIndex = 0;
    label.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      input.click();
    });

    /* replaceWith also drops the old scripted input.click() listener, so the
       picker is never opened twice. */
    button.replaceWith(label);
  });

  document.addEventListener('change', onUploadChange, true);
}

function onUploadChange(event: Event): void {
  const input = event.target as HTMLInputElement | null;
  if (!input || !UPLOADS.some((spec) => spec.inputId === input.id)) return;

  const file = input.files && input.files[0];
  if (!file) return;

  /* A file chosen from cloud storage can arrive without an extension, and the
     parser rejects anything it cannot name as text. Name it before the panel's
     own change handler runs. */
  if (!/\.[a-z0-9]{1,6}$/i.test(file.name)) {
    try {
      const renamed = new File([file], `${file.name}.txt`, {
        type: file.type || 'text/plain'
      });
      const transfer = new DataTransfer();
      transfer.items.add(renamed);
      input.files = transfer.files;
    } catch {
      /* leave the original file: the parser will explain what it needs */
    }
  }

  const spec = UPLOADS.find((item) => item.inputId === input.id);
  const kind = spec ? spec.kind : 'File';
  const before = statusFingerprint();
  let tries = 0;

  const timer = window.setInterval(() => {
    tries += 1;
    const status = document.getElementById('vbreakStatus');
    const now = statusFingerprint();
    const state = status?.dataset.state || '';

    if (state === 'error' && now !== before) {
      window.clearInterval(timer);
      showNote(`${file.name} — ${status?.textContent || 'could not be read.'}`, false, 12000);
      return;
    }
    /* "ok" can be the same text as before when the same file is re-uploaded,
       so accept it after a short grace period even if nothing changed. */
    if (state === 'ok' && (now !== before || tries >= 12)) {
      window.clearInterval(timer);
      showNote(`✓ ${kind} file loaded — ${status?.textContent || ''}`, true);
      return;
    }
    if (tries > 45) window.clearInterval(timer);
  }, 100);
}

function statusFingerprint(): string {
  const status = document.getElementById('vbreakStatus');
  return status ? `${status.dataset.state || ''}|${status.textContent || ''}` : '';
}

let installed = false;

/** Call once, after installVideoBreaks() has built the panel. */
export function installVideoSetup(root: HTMLElement): void {
  if (installed) return;
  installed = true;

  installRotation(root);
  installUploads();
}
