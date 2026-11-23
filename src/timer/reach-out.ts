/**
 * reach-out.ts — two small surfaces that help a user reach the studio.
 *
 * WHY THIS EXISTS
 * ---------------
 * 1. Two things users email about already work, unnamed and unadvertised:
 *    their own question packs (JSON) and their own narration (MP3 / WAV /
 *    M4A). Both are Free — no Pro key. The buttons are buried in the setup
 *    flow, so people assume they must pay for them. One short line on the
 *    home page fixes that.
 *
 * 2. The contact page lists an email address and nothing else. Someone with a
 *    quick question wants X or YouTube, not a draft email. Those rows are
 *    added here rather than in `timer.html` so the handles live in exactly
 *    one module (`src/social.ts`) and cannot drift.
 *
 * WHY THE HOME NOTICE DISAPPEARS
 * ------------------------------
 * Dismissal is remembered per NOTICE_VERSION (see src/social.ts), so the note
 * is read once, hidden, and shown again only when its copy changes. It is
 * never a timed popup, and it is never rendered on the stage — the stage is
 * what users screen-cast, so no notice belongs there.
 *
 * Additive only: delete the import and the single call in TimerApp.tsx to
 * remove both. Styling reuses `quickstart`, `qs-head`, `contact-line`,
 * `contact-label` and `contact-mail`, so no stylesheet change.
 */

import {
  X_HANDLE,
  X_URL,
  YOUTUBE_HANDLE,
  YOUTUBE_URL,
  dismissNotice,
  isNoticeDismissed
} from '../social.ts';

const NOTICE_ID = 'home-free-packs';

const BODY_HTML = `
  <div class="qs-head">
    <h2>New in this version: your own content, on Free</h2>
    <p>Import your own question pack as JSON, or narrate with your own MP3 &mdash; both already work on Free, no Pro key needed.
    Question, concern or something broken? <a href="${X_URL}" target="_blank" rel="noopener noreferrer">${X_HANDLE} on X</a> &middot;
    <a href="${YOUTUBE_URL}" target="_blank" rel="noopener noreferrer">YouTube ${YOUTUBE_HANDLE}</a>.</p>
  </div>
`;

function injectNotice(): void {
  if (document.getElementById('updateNotice')) return;
  if (isNoticeDismissed(NOTICE_ID)) return;

  const home = document.getElementById('pageHome');
  if (!home) return;

  const section = document.createElement('section');
  section.className = 'quickstart';
  section.id = 'updateNotice';
  section.setAttribute('aria-label', 'What is new in this version');
  section.innerHTML = BODY_HTML;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn btn-quiet btn-sm';
  dismiss.style.marginTop = '10px';
  dismiss.textContent = 'Got it, hide this';
  dismiss.addEventListener('click', () => {
    dismissNotice(NOTICE_ID);
    section.remove();
  });
  section.appendChild(dismiss);

  /* Above the install notice, which is the first thing a new visitor reads.
     Once this is dismissed the install notice takes the top slot back. */
  const anchor = document.getElementById('installNotice') || home.querySelector('.quickstart');
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(section, anchor);
  } else {
    home.appendChild(section);
  }
}

const SOCIAL_ROWS: Array<{ label: string; href: string; text: string }> = [
  { label: 'X', href: X_URL, text: X_HANDLE },
  { label: 'YouTube', href: YOUTUBE_URL, text: YOUTUBE_HANDLE }
];

function injectContactRows(): void {
  const contact = document.getElementById('pageContact');
  if (!contact) return;
  if (contact.querySelector('[data-social-row]')) return;

  const copy = contact.querySelector('.contact-copy');
  if (!copy) return;

  /* Sit next to the email row, above the studio URL: email stays first,
     because some users will never open X. */
  const rows = Array.from(copy.querySelectorAll('.contact-line'));
  const studioRow = rows.find((row) => /studio url/i.test(row.textContent || '')) || null;

  SOCIAL_ROWS.forEach(({ label, href, text }) => {
    const row = document.createElement('p');
    row.className = 'contact-line';
    row.setAttribute('data-social-row', '1');

    const name = document.createElement('span');
    name.className = 'contact-label';
    name.textContent = label;

    const link = document.createElement('a');
    link.className = 'contact-mail';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;

    row.append(name, link);
    if (studioRow && studioRow.parentNode) {
      studioRow.parentNode.insertBefore(row, studioRow);
    } else {
      copy.appendChild(row);
    }
  });
}

/** Idempotent: safe after a re-render, a no-op on markup it cannot find. */
export function initReachOut(): void {
  injectNotice();
  injectContactRows();
}
