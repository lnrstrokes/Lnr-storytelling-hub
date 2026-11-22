/**
 * Install notice + streaming-route notice.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two things a first-time creator gets wrong, stated once, plainly, where they
 * actually look: the home page and the "go live" step of the wizard.
 *
 *   1. The studio is a Progressive Web App. In a browser tab it works, but the
 *      tab's address bar and toolbars are part of what a screen cast captures.
 *      Installed, it opens as its own full-screen app, which is the 100%
 *      experience.
 *
 *   2. YouTube's own mobile live streaming needs more than 50 subscribers.
 *      Above that line, Screen Cast from the YouTube app is all you need —
 *      PRISM is not required. Below it (or with mobile live not yet enabled),
 *      PRISM Live Studio's Screencast mode or studio.youtube.com in a mobile
 *      browser are the free routes, because neither is gated on subscribers.
 *
 * Additive only: this module injects its own markup and binds no engine state.
 * Delete the import and the single call in TimerApp.tsx to remove it.
 *
 * Styling reuses classes this app already ships — `quickstart`, `qs-head`,
 * `info-grid`, `info-card`, `panel-block`, `block-head`, `dsec-note` — so no
 * stylesheet changes and nothing can drift out of the palette.
 */

const INSTALL_LINE =
  'Install lnr Studio for the 100% experience: installed, it opens as its own ' +
  'full-screen app — no address bar, no tabs and no browser bars inside your ' +
  'screen cast — and it keeps working if the connection drops.';

const ROUTE_LINE =
  'More than 50 YouTube subscribers? You do not need PRISM. Open the YouTube ' +
  'app, tap Create (+) → Go Live → Screen Cast, and pick lnr Studio.';

const UNDER_FIFTY_LINE =
  'Under 50 subscribers, or mobile live not enabled yet? Install PRISM Live ' +
  'Studio (free) and use its Screencast mode — it streams by RTMP, where the ' +
  'subscriber rule does not apply — or open studio.youtube.com in your phone ' +
  'browser and go live from there.';

const HOME_HTML = `
  <div class="qs-head">
    <h2>Before you go live: install the app, then pick your streaming route</h2>
    <p>The studio works in a browser tab. Installed it is the full experience &mdash; and which way your stream reaches YouTube depends on one number.</p>
  </div>

  <div class="info-grid">
    <article class="info-card">
      <h3>Install the app for the 100% experience</h3>
      <p>${INSTALL_LINE}</p>
      <p style="margin-top:8px"><b>Android / Chrome:</b> menu (&#8942;) &rarr; <em>Install app</em>. <b>iPhone / Safari:</b> <em>Share</em> &rarr; <em>Add to Home Screen</em>. <b>Desktop Chrome or Edge:</b> the install icon in the address bar.</p>
    </article>

    <article class="info-card">
      <h3>Over 50 subscribers? Skip PRISM and screencast</h3>
      <p>${ROUTE_LINE}</p>
      <p style="margin-top:8px">${UNDER_FIFTY_LINE}</p>
    </article>
  </div>
`;

const STEP3_HTML = `
  <div class="block-head">
    <h2>Two checks before you go live</h2>
    <p>${INSTALL_LINE}</p>
  </div>
  <p class="dsec-note">${ROUTE_LINE}</p>
  <p class="dsec-note">${UNDER_FIFTY_LINE}</p>
`;

function injectHome(): void {
  if (document.getElementById('installNotice')) return;
  const home = document.getElementById('pageHome');
  if (!home) return;

  const section = document.createElement('section');
  section.className = 'quickstart';
  section.id = 'installNotice';
  section.setAttribute('aria-label', 'Install the app and choose your streaming route');
  section.innerHTML = HOME_HTML;

  // Directly after the hero: the first thing a new visitor reads.
  const quickstart = home.querySelector('.quickstart');
  if (quickstart && quickstart.parentNode) {
    quickstart.parentNode.insertBefore(section, quickstart);
  } else {
    home.appendChild(section);
  }
}

function injectStep3(): void {
  const step3 = document.getElementById('wizStep3');
  if (!step3 || document.getElementById('installNoticeStep')) return;

  const block = document.createElement('section');
  block.className = 'panel-block';
  block.id = 'installNoticeStep';
  block.innerHTML = STEP3_HTML;

  const startRow = step3.querySelector('.start-row');
  if (startRow && startRow.parentNode) {
    startRow.parentNode.insertBefore(block, startRow);
  } else {
    step3.appendChild(block);
  }
}

/**
 * Idempotent: safe to call after a re-render, and a no-op on markup that does
 * not contain the home page or the wizard.
 */
export function initInstallNotice(): void {
  injectHome();
  injectStep3();
}

export const INSTALL_NOTICE_COPY = {
  install: INSTALL_LINE,
  route: ROUTE_LINE,
  underFifty: UNDER_FIFTY_LINE,
};
