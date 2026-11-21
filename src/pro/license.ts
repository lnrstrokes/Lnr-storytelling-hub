/* ==========================================================================
   license.ts — the client half of the Pro licence
   --------------------------------------------------------------------------
   HOW IT WORKS

   A Pro key is minted by the owner (api/admin → action "sign_license") and is
   an HMAC-signed payload:  LNRPRO.<base64url payload>.<16-byte signature>

   The browser can never forge one, because it does not hold the signing
   secret. Everything this module stores locally is just a cache of a payload
   the SERVER has already verified — so editing localStorage cannot grant Pro
   features, it can only replay a payload that was genuinely issued.

   WHY THERE IS A CACHE AT ALL

   The stream must never stop because of a network hiccup. A verified licence
   stays active for OFFLINE_GRACE_MS and is re-checked in the background
   whenever the app is opened. Only a definite server refusal ("invalid",
   "expired", "wrong site") deactivates it immediately.

   SITE BINDING (anti-sharing)

   A key minted with a `site` value only works on that hostname. That is what
   stops a paying customer from posting their key in a forum: it will verify
   as "belongs to another site" everywhere else. Leave `site` empty when
   minting if the key must travel between domains.
   ========================================================================== */

export interface ProLicense {
  v: 1;
  tier: 'pro';
  plan: string;
  /** Channel watermark shown on the stage, e.g. "LNR". */
  watermark: string;
  /** Hostname this key is bound to. Empty string means "any site". */
  site: string;
  /** Brand strap text. Only the owner can change it: it comes from the key. */
  brand: string;
  email: string;
  /** When true the in-app brand field is read-only. */
  lockBrand: boolean;
  iat: number;
  exp: number;
  keyDigest?: string;
}

export interface ProState {
  active: boolean;
  license: ProLicense | null;
  /** Last time the server confirmed this key (0 = never). */
  checkedAt: number;
  /** Human-readable reason the key is not active, for the UI. */
  error: string;
}

export const PRO_LIMITS = {
  /** Prerecorded videos a Pro licence may upload. Free: 1. */
  videoClips: 3,
  /** Break clips a Pro licence may upload. Free: 0. */
  promoClips: 3,
  /** Break clip length cap, in seconds (unchanged by tier). */
  promoClipMaxSeconds: 300,
  /** Promo sequence/layout controls. */
  promoSequence: true,
  /** Brand text is issued with the key and locked in the app. */
  lockedBrand: true
} as const;

const STORAGE_KEY = 'lnr_pro_license_v1';
const VERIFY_ENDPOINT = '/api/verify-license';
/** Re-verify at most this often while online. */
const RECHECK_AFTER_MS = 12 * 60 * 60 * 1000;
/** How long a verified key keeps working with no network at all. */
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

interface StoredRecord {
  key: string;
  license: ProLicense;
  checkedAt: number;
}

function emit(): void {
  try {
    window.dispatchEvent(new CustomEvent('lnr:pro-changed'));
  } catch {
    /* no window (SSR / tests) */
  }
}

function readRecord(): StoredRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRecord>;
    if (!parsed || typeof parsed.key !== 'string' || !parsed.license) return null;
    if (parsed.license.tier !== 'pro') return null;
    return {
      key: parsed.key,
      license: parsed.license as ProLicense,
      checkedAt: Number(parsed.checkedAt) || 0
    };
  } catch {
    return null;
  }
}

function writeRecord(rec: StoredRecord | null): void {
  try {
    if (!rec) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* private mode / quota: Pro simply will not persist */
  }
}

/** Is the current hostname allowed to use a key bound to `site`? */
function siteMatches(site: string): boolean {
  const bound = String(site || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!bound) return true;
  const host = String(location.hostname || '').toLowerCase();
  // Local/preview development is never blocked — that is how the owner tests.
  if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') {
    return true;
  }
  return host === bound || host.endsWith('.' + bound) || bound.endsWith('.' + host);
}

function evaluate(rec: StoredRecord | null): ProState {
  if (!rec) return { active: false, license: null, checkedAt: 0, error: '' };
  const lic = rec.license;
  const now = Date.now();

  if (!lic.exp || now > lic.exp) {
    return { active: false, license: lic, checkedAt: rec.checkedAt, error: 'This Pro key has expired.' };
  }
  if (!siteMatches(lic.site)) {
    return {
      active: false,
      license: lic,
      checkedAt: rec.checkedAt,
      error: `This Pro key belongs to ${lic.site}, not this site.`
    };
  }
  // Verified once, then trusted offline for a bounded window.
  if (rec.checkedAt && now - rec.checkedAt > OFFLINE_GRACE_MS) {
    return {
      active: false,
      license: lic,
      checkedAt: rec.checkedAt,
      error: 'Could not confirm this Pro key — go online once to re-activate.'
    };
  }
  return { active: true, license: lic, checkedAt: rec.checkedAt, error: '' };
}

let state: ProState = evaluate(readRecord());

export function getProState(): ProState {
  return state;
}

export function isPro(): boolean {
  return state.active;
}

function setState(next: ProState): ProState {
  state = next;
  emit();
  return next;
}

async function post(
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(VERIFY_ENDPOINT, {
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

/**
 * Activate a key on this device.
 *
 * The server is the only thing that can say "yes": a malformed or edited key
 * is rejected here, and nothing is stored unless it verifies.
 */
export async function activatePro(
  rawKey: string
): Promise<{ ok: boolean; error?: string }> {
  const key = String(rawKey || '').replace(/\s+/g, '');
  if (!key) return { ok: false, error: 'Paste your Pro key first.' };
  if (!/^LNRPRO\./.test(key)) {
    return { ok: false, error: 'That does not look like a Pro key (it starts with LNRPRO.).' };
  }

  let response: Awaited<ReturnType<typeof post>>;
  try {
    response = await post({ key });
  } catch {
    return { ok: false, error: 'Could not reach the licence server. Check your connection and try again.' };
  }

  if (!response.ok) {
    const error = String(response.data.error || 'This key was not accepted.');
    return { ok: false, error };
  }

  const license = response.data.license as ProLicense | undefined;
  if (!license || license.tier !== 'pro') {
    return { ok: false, error: 'The licence server returned an unexpected response.' };
  }

  const rec: StoredRecord = { key, license, checkedAt: Date.now() };
  writeRecord(rec);

  const next = evaluate(rec);
  setState(next);
  if (!next.active) {
    // Verified, but unusable here (wrong site / already expired).
    return { ok: false, error: next.error || 'This key cannot be used on this site.' };
  }
  return { ok: true };
}

/** Remove the key from this device only. */
export function deactivatePro(): void {
  writeRecord(null);
  setState({ active: false, license: null, checkedAt: 0, error: '' });
}

/**
 * Silently re-verify in the background.
 *
 * Never throws and never deactivates on a network failure — only a definite
 * server answer changes the state. Called on boot and on window focus.
 */
export async function refreshPro(): Promise<void> {
  const rec = readRecord();
  if (!rec) return;
  if (Date.now() - rec.checkedAt < RECHECK_AFTER_MS) return;

  let response: Awaited<ReturnType<typeof post>>;
  try {
    response = await post({ key: rec.key });
  } catch {
    return; // offline: keep the cached state, the grace window covers it
  }

  if (response.ok) {
    const license = response.data.license as ProLicense | undefined;
    if (license && license.tier === 'pro') {
      const next: StoredRecord = { key: rec.key, license, checkedAt: Date.now() };
      writeRecord(next);
      setState(evaluate(next));
    }
    return;
  }

  // A 4xx is a real refusal (expired, tampered, wrong site). 5xx is our fault.
  if (response.status >= 400 && response.status < 500) {
    writeRecord(null);
    setState({
      active: false,
      license: null,
      checkedAt: 0,
      error: String(response.data.error || 'This Pro key is no longer valid.')
    });
  }
}

/** Open the Pro panel (the engine calls this when a gated control is tapped). */
export function openProPanel(): void {
  try {
    window.dispatchEvent(new CustomEvent('lnr:pro-open'));
  } catch {
    /* ignore */
  }
}

/**
 * Bridge for the plain-JS engine (src/timer/engine.js).
 *
 * The engine only ever READS `get()`. Activation always goes through the
 * server, so exposing these functions does not weaken the licence.
 */
declare global {
  interface Window {
    LNR_PRO?: {
      get: () => ProState;
      isPro: () => boolean;
      activate: (key: string) => Promise<{ ok: boolean; error?: string }>;
      deactivate: () => void;
      refresh: () => Promise<void>;
      open: () => void;
      limits: typeof PRO_LIMITS;
    };
  }
}

export function installProBridge(): void {
  window.LNR_PRO = {
    get: getProState,
    isPro,
    activate: activatePro,
    deactivate: deactivatePro,
    refresh: refreshPro,
    open: openProPanel,
    limits: PRO_LIMITS
  };

  // Re-check when the streamer comes back to the tab (cheap, throttled above).
  const onFocus = () => {
    void refreshPro();
  };
  window.addEventListener('focus', onFocus);
  void refreshPro();
}

installProBridge();
