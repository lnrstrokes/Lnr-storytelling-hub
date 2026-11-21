/* ==========================================================================
   admin-keys.ts — create Pro licence keys from the in-app admin panel
   --------------------------------------------------------------------------
   The owner already has a hidden panel (7 taps on the brand logo). It used to
   hold only the local break-folder tools, so there was no way to mint a key
   from the app itself: the separate /admin-issue.html page had to be found and
   loaded. This module adds a "Pro Licence Keys" section to that same panel.

   WHO MAY USE IT

   The panel is now bound to the owner's device. The first time, the admin
   password is typed once; the server issues a signed, device-bound owner token
   and from then on this browser opens the tools silently. Any other device —
   even one that knows the URL and the 7-tap gesture — sees a locked notice and
   none of the operator controls.

   The admin password is never stored. The admin session that can mint keys
   lives in memory only, and is re-issued by /api/admin from the owner token.
   ========================================================================== */
import { activatePro } from '../pro/license';
import {
  checkOwner,
  enrollOwner,
  forgetOwnerDevice,
  getDeviceId,
  getOwnerMode,
  isOwnerDevice,
  setOwnerMode
} from '../pro/owner';

const ADMIN_ENDPOINT = '/api/admin';
const REQUEST_TIMEOUT_MS = 15000;
const MARKER = 'data-lnr-admin-keys';

/** Admin session token. Memory only: closing the app forgets it. */
let adminToken = '';

interface AdminReply {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

async function postAdmin(body: Record<string, unknown>): Promise<AdminReply> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ADMIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store'
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    window.clearTimeout(timer);
  }
}

function replyError(reply: AdminReply, fallback: string): string {
  const error = String(reply.data.error || '').trim();
  if (error) return error;
  if (reply.status === 404) {
    return 'This build has no /api/admin route. Deploy the latest commit from main, then try again.';
  }
  return fallback;
}

function hasToken(reply: AdminReply): boolean {
  return reply.ok && typeof reply.data.adminToken === 'string' && reply.data.adminToken.length > 0;
}

export function installAdminKeys(host: HTMLElement): void {
  const box = host.querySelector<HTMLElement>('#adminToolsBox');
  if (!box) return;
  if (box.querySelector(`[${MARKER}]`)) return;

  /* Everything the engine put in this box is operator-only, so it is hidden
     until this browser proves it is the owner's device. */
  const operatorChildren = Array.from(box.children) as HTMLElement[];

  const section = document.createElement('div');
  section.className = 'promo-folder-box';
  section.setAttribute(MARKER, '');
  section.style.marginTop = '0';
  section.innerHTML = `
    <div class="sub-head" style="margin:0;padding-top:0;border-top:0">
      <span>Owner &amp; Pro Licence Keys</span>
      <em data-adm-status>checking server…</em>
    </div>

    <p data-adm-owner style="margin:0;font-size:12px;line-height:1.5;color:var(--muted-dim)">Checking this device…</p>

    <div data-adm-gate hidden style="display:flex;flex-direction:column;gap:8px">
      <p style="margin:0;font-size:12.5px;line-height:1.55;color:#f0c88a">
        This browser is not registered as the owner device. Operator tools and licence keys stay
        locked. Register this phone once with the admin password — other devices will not get this
        access.
      </p>
      <label class="field">
        <span>Admin password</span>
        <input type="password" data-adm-password autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ADMIN_PASSWORD from Vercel" />
      </label>
      <div class="promo-folder-actions">
        <button class="btn btn-primary btn-sm" type="button" data-adm-register>Register this device</button>
      </div>
    </div>

    <div data-adm-form hidden style="display:flex;flex-direction:column;gap:12px">
      <div class="field-row">
        <label class="field"><span>Brand strap</span><input type="text" data-adm-brand maxlength="28" placeholder="CREATOR STUDIO" /></label>
        <label class="field"><span>Watermark</span><input type="text" data-adm-watermark maxlength="14" placeholder="CHANNEL" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Customer email</span><input type="email" data-adm-email maxlength="80" placeholder="buyer@example.com" /></label>
        <label class="field"><span>Lock to domain</span><input type="text" data-adm-site maxlength="42" placeholder="blank = any site" /></label>
      </div>
      <div class="field-row">
        <label class="field">
          <span>Plan</span>
          <select data-adm-plan>
            <option value="pro-monthly">Monthly</option>
            <option value="pro-yearly" selected>Yearly</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="field"><span>Days valid</span><input type="number" data-adm-days value="365" min="1" max="3650" step="1" inputmode="numeric" /></label>
      </div>
      <div class="promo-folder-actions">
        <button class="btn btn-primary btn-sm" type="button" data-adm-create>Create licence key</button>
      </div>
      <p style="margin:0;font-size:12px;line-height:1.5;color:var(--muted-dim)">
        The brand is written into the key and cannot be edited by the customer afterwards.
      </p>
      <div data-adm-result hidden style="display:flex;flex-direction:column;gap:8px">
        <textarea data-adm-key readonly rows="3" spellcheck="false" autocapitalize="off" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,.28);color:var(--cream);font:12px/1.45 ui-monospace,Menlo,monospace;resize:vertical"></textarea>
        <div class="promo-folder-actions">
          <button class="btn btn-quiet btn-sm" type="button" data-adm-copy>Copy key</button>
          <button class="btn btn-ghost btn-sm" type="button" data-adm-activate>Activate on this device</button>
        </div>
        <p data-adm-expiry style="margin:0;font-size:12px;color:var(--muted-dim)"></p>
      </div>
    </div>

    <div data-adm-owner-tools hidden style="display:flex;flex-direction:column;gap:8px">
      <div class="promo-folder-actions">
        <button class="btn btn-quiet btn-sm" type="button" data-adm-mode>Switch this device to Free</button>
        <button class="btn btn-ghost btn-sm" type="button" data-adm-forget>Forget this device</button>
      </div>
      <p style="margin:0;font-size:12px;line-height:1.5;color:var(--muted-dim)">
        Pro mode is yours to switch on or off on this device. It does not create a customer key and
        never locks your own branding.
      </p>
    </div>

    <p data-adm-ok hidden style="margin:0;font-size:12.5px;color:#8fd3aa"></p>
    <p data-adm-error hidden style="margin:0;font-size:12.5px;color:#f0a48c"></p>
  `;

  box.appendChild(section);
  operatorChildren.forEach((child) => {
    child.style.display = 'none';
  });

  const status = section.querySelector<HTMLElement>('[data-adm-status]')!;
  const ownerLine = section.querySelector<HTMLElement>('[data-adm-owner]')!;
  const gate = section.querySelector<HTMLElement>('[data-adm-gate]')!;
  const form = section.querySelector<HTMLElement>('[data-adm-form]')!;
  const ownerTools = section.querySelector<HTMLElement>('[data-adm-owner-tools]')!;
  const modeBtn = section.querySelector<HTMLButtonElement>('[data-adm-mode]')!;
  const forgetBtn = section.querySelector<HTMLButtonElement>('[data-adm-forget]')!;
  const password = section.querySelector<HTMLInputElement>('[data-adm-password]')!;
  const registerBtn = section.querySelector<HTMLButtonElement>('[data-adm-register]')!;
  const brand = section.querySelector<HTMLInputElement>('[data-adm-brand]')!;
  const watermark = section.querySelector<HTMLInputElement>('[data-adm-watermark]')!;
  const email = section.querySelector<HTMLInputElement>('[data-adm-email]')!;
  const site = section.querySelector<HTMLInputElement>('[data-adm-site]')!;
  const plan = section.querySelector<HTMLSelectElement>('[data-adm-plan]')!;
  const days = section.querySelector<HTMLInputElement>('[data-adm-days]')!;
  const createBtn = section.querySelector<HTMLButtonElement>('[data-adm-create]')!;
  const result = section.querySelector<HTMLElement>('[data-adm-result]')!;
  const keyOutput = section.querySelector<HTMLTextAreaElement>('[data-adm-key]')!;
  const copyBtn = section.querySelector<HTMLButtonElement>('[data-adm-copy]')!;
  const activateBtn = section.querySelector<HTMLButtonElement>('[data-adm-activate]')!;
  const expiry = section.querySelector<HTMLElement>('[data-adm-expiry]')!;
  const okLine = section.querySelector<HTMLElement>('[data-adm-ok]')!;
  const errorLine = section.querySelector<HTMLElement>('[data-adm-error]')!;

  const deviceTag = getDeviceId().slice(0, 8).toUpperCase();

  const showOk = (text: string) => {
    okLine.textContent = text;
    okLine.hidden = !text;
  };
  const showError = (text: string) => {
    errorLine.textContent = text;
    errorLine.hidden = !text;
  };
  const clearMessages = () => {
    showOk('');
    showError('');
  };

  /** Show the owner view or the locked view. Called on every state change. */
  const renderOwner = (): void => {
    const owner = isOwnerDevice();
    operatorChildren.forEach((child) => {
      child.style.display = owner ? '' : 'none';
    });
    /* The app stylesheet forces [hidden] to display:none !important, so the
       locked view is driven by inline display instead. */
    gate.removeAttribute('hidden');
    form.removeAttribute('hidden');
    ownerTools.removeAttribute('hidden');
    gate.style.display = owner ? 'none' : 'flex';
    form.style.display = owner ? 'flex' : 'none';
    ownerTools.style.display = owner ? 'flex' : 'none';

    if (!owner) {
      ownerLine.textContent = 'Locked: this browser is not the owner device.';
      return;
    }
    const mode = getOwnerMode();
    modeBtn.textContent = mode === 'pro' ? 'Switch this device to Free' : 'Switch this device to Pro';
    ownerLine.textContent = `Owner device ${deviceTag} · ${mode === 'pro' ? 'Pro' : 'Free'} mode.`;
  };

  renderOwner();
  window.addEventListener('lnr:owner-changed', renderOwner);

  /* On boot, ask the server whether this device is still registered. It also
     hands back an admin session, so the minter works without the password. */
  void (async () => {
    const checked = await checkOwner();
    if (checked.ok && checked.adminToken) adminToken = checked.adminToken;
    renderOwner();
  })();

  /* Is ADMIN_PASSWORD actually on the deployment being used right now? */
  void (async () => {
    try {
      const res = await fetch(ADMIN_ENDPOINT, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        status.textContent = 'server check failed';
        return;
      }
      if (data.configured === true) status.textContent = 'server ready';
      else if (data.configured === false) status.textContent = 'admin password missing';
      else status.textContent = '';
    } catch {
      status.textContent = 'server unreachable';
    }
  })();

  registerBtn.addEventListener('click', async () => {
    clearMessages();
    const pass = password.value.trim();
    if (!pass) {
      showError('Enter the admin password first.');
      password.focus();
      return;
    }
    const label = registerBtn.textContent || 'Register this device';
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering…';
    try {
      const enrolled = await enrollOwner(pass);
      if (!enrolled.ok) {
        showError(enrolled.error || 'Could not register this device.');
        return;
      }
      password.value = '';
      if (enrolled.adminToken) adminToken = enrolled.adminToken;
      renderOwner();
      showOk('This device is now the owner device — Pro mode is on. The password was not stored.');
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      showError(
        aborted
          ? 'The server did not answer in time. Check the connection and try again.'
          : 'Could not reach the licence server. Check the connection and try again.'
      );
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = label;
    }
  });

  modeBtn.addEventListener('click', () => {
    clearMessages();
    const next = getOwnerMode() === 'pro' ? 'free' : 'pro';
    setOwnerMode(next);
    showOk(next === 'pro' ? 'This device is now Pro.' : 'This device is now Free.');
  });

  forgetBtn.addEventListener('click', () => {
    clearMessages();
    forgetOwnerDevice();
    adminToken = '';
    showOk('This device is no longer registered. Enter the admin password to use it again.');
  });

  createBtn.addEventListener('click', async () => {
    clearMessages();
    if (!isOwnerDevice()) {
      showError('Register this device as the owner device first.');
      return;
    }

    const label = createBtn.textContent || 'Create licence key';
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try {
      if (!adminToken) {
        const pass = password.value.trim();
        if (!pass) {
          showError('The admin session expired. Reload the app, or enter the password and register again.');
          return;
        }
        const unlock = await postAdmin({ action: 'unlock', password: pass });
        if (!hasToken(unlock)) {
          adminToken = '';
          showError(replyError(unlock, 'Could not unlock admin mode.'));
          return;
        }
        adminToken = String(unlock.data.adminToken);
      }

      const payload: Record<string, unknown> = {
        action: 'sign_license',
        adminToken,
        brand: brand.value,
        watermark: watermark.value,
        site: site.value,
        email: email.value,
        plan: plan.value,
        days: Number(days.value) || 365
      };

      let issued = await postAdmin(payload);

      /* A stale in-memory token (30 days passed / secret rotated) is retried
         once from the owner token, so the form is not lost. */
      if (issued.status === 401) {
        adminToken = '';
        const rechecked = await checkOwner();
        if (rechecked.ok && rechecked.adminToken) {
          adminToken = rechecked.adminToken;
          issued = await postAdmin({ ...payload, adminToken });
        }
      }

      if (!issued.ok || typeof issued.data.key !== 'string') {
        showError(replyError(issued, 'Could not create the key.'));
        return;
      }

      keyOutput.value = issued.data.key;
      const license = issued.data.payload as { exp?: number; brand?: string } | undefined;
      const exp = Number(license?.exp) || 0;
      expiry.textContent = exp
        ? `Expires ${new Date(exp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })} · brand “${String(license?.brand || brand.value || 'CREATOR STUDIO')}”.`
        : '';
      result.hidden = false;
      showOk('Key created. Copy it now — it is not stored anywhere.');
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      showError(
        aborted
          ? 'The server did not answer in time. Check the connection and try again.'
          : 'Could not reach the licence server. Check the connection and try again.'
      );
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = label;
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(keyOutput.value);
      showOk('Key copied.');
      return;
    } catch {
      /* Clipboard blocked (old WebView / insecure origin): fall back. */
    }
    try {
      keyOutput.select();
      document.execCommand('copy');
      showOk('Key copied.');
    } catch {
      showOk('Select the key above and copy it.');
    }
  });

  activateBtn.addEventListener('click', async () => {
    clearMessages();
    if (isOwnerDevice()) {
      showOk('This is the owner device — Pro is already available through the switch above.');
      return;
    }
    activateBtn.disabled = true;
    try {
      const activated = await activatePro(keyOutput.value);
      if (activated.ok) showOk('This device is now Pro.');
      else showError(activated.error || 'That key was not accepted on this device.');
    } finally {
      activateBtn.disabled = false;
    }
  });

  /* Reset only the visible messages when the panel is reopened. */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('#accessModalClose')) clearMessages();
  });
}
