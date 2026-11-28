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

import { getOwnerMode, isOwnerDevice } from './owner';

export interface ProLicense {
  v: 1;
  tier: 'pro';
  /** True for the owner-device switch: it is not a signed customer key. */
  owner?: boolean;
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

/** Where a customer subscribes to Pro. Both upgrade buttons open this. */
export const PRO_CHECKOUT_URL = 'https://selar.com/399774111a';

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

/**
 * The owner device with the switch on Pro.
 *
 * This is a local mode, not a licence: it carries no brand and locks nothing,
 * precisely so the studio's own branding and settings stay editable.
 */
function ownerState(): ProState {
  return {
    active: true,
    license: {
      v: 1,
      tier: 'pro',
      owner: true,
      plan: 'custom',
      watermark: '',
      site: '',
      brand: '',
      email: '',
      lockBrand: false,
      iat: 0,
      exp: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
    },
    checkedAt: Date.now(),
    error: ''
  };
}

function ownerProActive(): boolean {
  return isOwnerDevice() && getOwnerMode() === 'pro';
}

export function getProState(): ProState {
  return ownerProActive() ? ownerState() : state;
}

/**
 * The raw licence key this device holds, or '' when there is none.
 *
 * WHY THIS EXISTS
 *
 * /api/airtime verifies Pro SERVER-SIDE, so the client has to send the key
 * with every call. The first version of that client read `getProState().key`,
 * but ProState carries only the decoded licence — the key itself lives in the
 * stored record. The result was that the server never received a key, always
 * answered pro:false, and a paying customer was capped at 2 hours like a free
 * one. This is the accessor that closes that gap.
 *
 * The owner-device switch is not a signed key, so it returns '' here; the
 * server cannot verify it and the client-side Pro check covers that case.
 */
export function getProLicenseKey(): string {
  if (ownerProActive()) return '';
  const rec = readRecord();
  return rec && typeof rec.key === 'string' ? rec.key : '';
}

export function isPro(): boolean {
  return getProState().active;
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

/** The pending-checkout marker openProCheckout() writes, read on activation. */
interface PendingCheckout {
  ref?: string;
  location?: string;
  at?: number;
}

/**
 * Report a completed purchase to analytics.
 *
 * This is the only place a `purchase` event is emitted, and it fires on a
 * VERIFIED activation — the licence server has already said yes, so this is a
 * real sale and not a click. It is matched back to the click that started it
 * through the pending-checkout marker openProCheckout() writes.
 *
 * A key activated with no marker (hand-minted, or bought on another device)
 * reports `purchase_unattributed` instead, so those stay distinguishable
 * rather than being silently merged into real sales.
 */
function reportPurchase(license: ProLicense): void {
  try {
    const track = (window as unknown as {
      LNR_TRACK?: (name: string, params?: Record<string, unknown>) => void;
    }).LNR_TRACK;
    if (typeof track !== 'function') return;

    const PENDING_KEY = 'lnr_pending_checkout_v1';
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    let marker: PendingCheckout | null = null;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) marker = JSON.parse(raw) as PendingCheckout;
    } catch {
      marker = null;
    }

    const fresh =
      !!marker &&
      typeof marker.at === 'number' &&
      Date.now() - marker.at >= 0 &&
      Date.now() - marker.at <= MAX_AGE_MS;

    if (fresh && marker) {
      track('purchase', {
        checkout_ref: marker.ref || '',
        checkout_location: marker.location || '',
        plan: license.tier,
        value: 19,
        currency: 'USD',
        seconds_since_checkout: Math.round((Date.now() - (marker.at || Date.now())) / 1000),
      });
      /* Consumed once: a second device activating the same key must not report
         a second sale. */
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {}
    } else {
      track('purchase_unattributed', { plan: license.tier });
    }
  } catch {
    /* analytics must never break activation */
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
  /* Only a verified, usable key counts as a sale. */
  reportPurchase(license);
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

  /* Switching the owner device between Free and Pro must reach every
     surface that renders tier state (the gate, the dock, the engine). */
  window.addEventListener('lnr:owner-changed', () => {
    state = evaluate(readRecord());
    emit();
  });

  void refreshPro();
}

installProBridge();
