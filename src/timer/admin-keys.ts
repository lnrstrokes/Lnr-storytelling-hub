/* ==========================================================================
   admin-keys.ts — create Pro licence keys from the in-app admin panel
   --------------------------------------------------------------------------
   The owner already has a hidden panel (7 taps on the brand logo). It used to
   hold only the local break-folder tools, so there was no way to mint a key
   from the app itself: the separate /admin-issue.html page had to be found and
   loaded. This module adds a "Pro Licence Keys" section to that same panel.

   The admin password is typed here, exchanged once for a short-lived admin
   token, and kept in memory only — never written to localStorage, never put in
   the URL. Nothing on this device can mint a key without the server agreeing,
   because the signing secret lives only in Vercel's environment variables.
   ========================================================================== */
import { activatePro } from '../pro/license';

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

  const section = document.createElement('div');
  section.className = 'promo-folder-box';
  section.setAttribute(MARKER, '');
  section.innerHTML = `
    <div class="sub-head" style="margin:0;padding-top:0;border-top:0">
      <span>Pro Licence Keys</span>
      <em data-adm-status>checking server…</em>
    </div>
    <label class="field">
      <span>Admin password</span>
      <input type="password" data-adm-password autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ADMIN_PASSWORD from Vercel" />
    </label>
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
    <p data-adm-note style="margin:0;font-size:12px;line-height:1.5;color:var(--muted-dim)">
      The password is not stored on this device. The brand is written into the key and
      cannot be edited by the customer afterwards.
    </p>
    <div data-adm-result hidden style="display:flex;flex-direction:column;gap:8px">
      <textarea data-adm-key readonly rows="3" spellcheck="false" autocapitalize="off" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,.28);color:var(--cream);font:12px/1.45 ui-monospace,Menlo,monospace;resize:vertical"></textarea>
      <div class="promo-folder-actions">
        <button class="btn btn-quiet btn-sm" type="button" data-adm-copy>Copy key</button>
        <button class="btn btn-ghost btn-sm" type="button" data-adm-activate>Activate on this device</button>
      </div>
      <p data-adm-expiry style="margin:0;font-size:12px;color:var(--muted-dim)"></p>
    </div>
    <p data-adm-ok hidden style="margin:0;font-size:12.5px;color:#8fd3aa"></p>
    <p data-adm-error hidden style="margin:0;font-size:12.5px;color:#f0a48c"></p>
  `;

  box.appendChild(section);

  const status = section.querySelector<HTMLElement>('[data-adm-status]')!;
  const password = section.querySelector<HTMLInputElement>('[data-adm-password]')!;
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

  createBtn.addEventListener('click', async () => {
    clearMessages();
    const pass = password.value.trim();
    if (!pass) {
      showError('Enter the admin password first.');
      password.focus();
      return;
    }

    const label = createBtn.textContent || 'Create licence key';
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try {
      if (!adminToken) {
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

      /* A stale in-memory token (server redeployed / instance moved on) is
         retried once with a fresh unlock, so the owner does not lose the form. */
      if (issued.status === 401) {
        adminToken = '';
        const unlock = await postAdmin({ action: 'unlock', password: pass });
        if (!hasToken(unlock)) {
          showError(replyError(unlock, 'Admin session expired — enter the password again.'));
          return;
        }
        adminToken = String(unlock.data.adminToken);
        issued = await postAdmin({ ...payload, adminToken });
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
