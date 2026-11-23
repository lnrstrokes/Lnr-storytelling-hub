/**
 * quiz-pack-reset.ts - one button to clear the uploaded pack.
 *
 * WHY THIS EXISTS
 * ---------------
 * Once a JSON pack was imported there was no way to remove it from the device.
 * Importing a second pack used to append to the first, and even with the
 * importer fixed (a new import replaces the old pack) an operator still needs a
 * way to get back to an empty slot: a pack that came out wrong, a language they
 * finished with, or a stale file they want gone before a show.
 *
 * The button is added to the "Question source" row, which the engine only shows
 * when an uploaded pack actually exists - so it can never appear when there is
 * nothing to remove. Free and Pro both get it: the pack is parsed and stored in
 * the browser and never leaves the device, so this costs nothing to serve.
 *
 * The work itself is done by the engine (`LNR_QUESTION_SOURCE.clear()`), which
 * owns the bank, the shuffle bags and the stored copy; this module only adds
 * the control and says what happened. If an older bundle without that hook is
 * loaded, it falls back to deleting the stored pack and reloading once.
 */

const ROW_ID = 'qSourceRow';
const BUTTON_ID = 'qClearUploadBtn';
const STORE_KEY = 'lnr_custom_bank_v2';

interface QuestionSourceApi {
  clear?: () => unknown;
}

function engineApi(): QuestionSourceApi | undefined {
  return (window as unknown as { LNR_QUESTION_SOURCE?: QuestionSourceApi }).LNR_QUESTION_SOURCE;
}

function setHint(text: string): void {
  const hint = document.getElementById('qSourceHint');
  if (hint) hint.textContent = text;
}

function makeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'btn btn-ghost btn-sm';
  button.textContent = 'Remove uploaded pack';
  button.title =
    'Delete the imported JSON pack from this device so a fresh one can be loaded. Built-in packs are not affected.';
  button.style.marginTop = '10px';
  button.style.width = '100%';

  button.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Remove the uploaded JSON pack from this device? The built-in packs stay available, and you can import another file straight away.'
    );
    if (!confirmed) return;

    const api = engineApi();
    if (api && typeof api.clear === 'function') {
      api.clear();
      button.hidden = true;
      setHint('Uploaded pack removed. Import a new JSON file above whenever you are ready.');
      return;
    }

    /* Older bundle: the stored pack is the only thing this module can reach. */
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* private mode: nothing stored, nothing to remove */
    }
    window.location.reload();
  });

  return button;
}

function sync(event?: Event): void {
  const row = document.getElementById(ROW_ID);
  if (!row) return;

  let button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (!button) {
    button = makeButton();
    row.appendChild(button);
  }

  /* The engine re-renders this row (it hides it entirely once no pack exists),
     so the button follows the row instead of guessing at its own visibility. */
  const hidden = row.hasAttribute('hidden');
  button.hidden = hidden;

  /* A new import makes the row visible again; the hint is the engine's own
     text at that point, so nothing is overwritten here. */
  if (event && !hidden && button.textContent !== 'Remove uploaded pack') {
    button.textContent = 'Remove uploaded pack';
  }
}

export function installQuizPackReset(_host?: HTMLElement): void {
  if (typeof document === 'undefined') return;

  sync();

  const row = document.getElementById(ROW_ID);
  if (row && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => sync());
    observer.observe(row, { attributes: true, attributeFilter: ['hidden'] });
  }
}
