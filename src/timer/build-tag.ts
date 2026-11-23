/**
 * build-tag.ts - "which build am I actually looking at?"
 *
 * WHY THIS EXISTS
 * ---------------
 * The hardest question to answer from a phone was whether the installed app had
 * picked up a deploy. The service worker's cache version IS the build (it is
 * stamped from a hash of the bundle in vite.config.ts), so asking the live
 * worker for it answers that exactly: two builds that differ in any way produce
 * different versions, and an unchanged version means the app is genuinely
 * current rather than stubbornly cached.
 *
 * The line sits in the settings header, next to the existing "All changes saved
 * on this device" tag. A worker from before this change cannot answer, and says
 * so plainly instead of leaving a spinner.
 */

function shortVersion(version: string): string {
  const v = String(version || '').trim();
  return v ? v.slice(0, 12) : '';
}

export function installBuildTag(_host?: HTMLElement): void {
  const row = document.querySelector('#pageSettings .page-head-row');
  if (!row || document.getElementById('lnrBuildTag')) return;

  const tag = document.createElement('span');
  tag.id = 'lnrBuildTag';
  tag.className = 'saved-tag';
  tag.textContent = 'Build: checking\u2026';
  tag.title = 'The build this app is running. Quote it when the app looks out of date.';

  const saved = document.getElementById('savedTag');
  if (saved && saved.parentNode) saved.parentNode.insertBefore(tag, saved.nextSibling);
  else row.appendChild(tag);

  const show = (version: string): void => {
    const short = shortVersion(version);
    if (!short) return;
    tag.textContent = `Build: ${short}`;
  };

  const sw = navigator.serviceWorker;
  if (!sw) {
    tag.textContent = 'Build: no service worker';
    return;
  }

  sw.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; version?: string } | null;
    if (!data) return;
    if (data.type === 'SW_VERSION' || data.type === 'SW_UPDATED') show(String(data.version || ''));
  });

  const ask = (): void => {
    try {
      sw.controller?.postMessage({ type: 'GET_VERSION' });
    } catch {
      /* the tag stays honest about not knowing */
    }
  };

  if (sw.controller) ask();
  else sw.addEventListener('controllerchange', ask, { once: true });

  /* A worker deployed before this feature exists cannot reply. Say that rather
     than leave "checking" up forever. */
  window.setTimeout(() => {
    if (tag.textContent === 'Build: checking\u2026') tag.textContent = 'Build: reload for the newest';
  }, 3000);
}
