/* ==========================================================================
   owner.ts — "this device is the studio, not a customer"
   --------------------------------------------------------------------------
   WHAT IT DOES

   The owner registers this browser once with the admin password. The server
   answers with a signed, device-bound owner token; from then on the app knows
   this device is the operator's, without anyone typing the password again.

   What that unlocks:
     · the operator panel only (other devices get a locked notice)
     · a Free/Pro switch for this device, so testing the paid tier no longer
       needs a minted key that is bound to a different domain

   LIMITS, SAID PLAINLY

   This is device recognition, not remote attestation. The token lives in this
   browser's storage and is bound to the random device id next to it, so copying
   the whole profile to another machine would carry it along — but knowing the
   URL, the 7-tap gesture, or even the admin password in a different browser is
   not enough. Anyone without the token sees the locked panel.
   ========================================================================== */

const ADMIN_ENDPOINT = '/api/admin';
const DEVICE_KEY = 'lnr_owner_device_v1';
const TOKEN_KEY = 'lnr_owner_token_v1';
const MODE_KEY = 'lnr_owner_mode_v1';
const CHECK_KEY = 'lnr_owner_check_v1';
const REQUEST_TIMEOUT_MS = 15000;
/** How long a device stays recognised with no network at all. */
const OFFLINE_OWNER_MS = 30 * 24 * 60 * 60 * 1000;

export type OwnerMode = 'pro' | 'free';

interface CheckRecord {
  at: number;
  deviceId: string;
}

interface AdminReply {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

let verified = false;

function readString(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeString(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode: the device simply is not remembered */
  }
}

/** A random id for this browser install. Not a fingerprint of the hardware. */
export function getDeviceId(): string {
  let id = readString(DEVICE_KEY);
  if (id.length >= 16) return id;

  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  writeString(DEVICE_KEY, id);
  return id;
}

function readCheck(): CheckRecord | null {
  try {
    const parsed = JSON.parse(readString(CHECK_KEY) || 'null') as Partial<CheckRecord> | null;
    if (!parsed || typeof parsed.at !== 'number' || typeof parsed.deviceId !== 'string') return null;
    return { at: parsed.at, deviceId: parsed.deviceId };
  } catch {
    return null;
  }
}

function rememberThisDevice(): void {
  writeString(CHECK_KEY, JSON.stringify({ at: Date.now(), deviceId: getDeviceId() }));
}

function forgetThisDevice(): void {
  writeString(CHECK_KEY, '');
  writeString(TOKEN_KEY, '');
}

/**
 * True when this browser is the registered owner device.
 *
 * A successful check is cached, so a phone that is offline during setup still
 * has its own operator panel — but only for the same device id, and only for
 * the grace window.
 */
export function isOwnerDevice(): boolean {
  if (verified) return true;
  const check = readCheck();
  if (!check) return false;
  if (check.deviceId !== getDeviceId()) return false;
  return Date.now() - check.at < OFFLINE_OWNER_MS;
}

export function hasOwnerToken(): boolean {
  return readString(TOKEN_KEY).length > 0;
}

export function getOwnerMode(): OwnerMode {
  return readString(MODE_KEY) === 'free' ? 'free' : isOwnerDevice() ? 'pro' : 'free';
}

function signal(): void {
  try {
    window.dispatchEvent(new CustomEvent('lnr:owner-changed'));
    window.dispatchEvent(new CustomEvent('lnr:pro-changed'));
  } catch {
    /* no window (SSR / tests) */
  }
}

/** Free or Pro on the owner device. Persisted; ignored on customer devices. */
export function setOwnerMode(mode: OwnerMode): void {
  if (!isOwnerDevice()) return;
  writeString(MODE_KEY, mode);
  signal();
}

export function ownerModeLabel(): string {
  return getOwnerMode() === 'pro' ? 'Pro' : 'Free';
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

function friendlyError(reply: AdminReply, fallback: string): string {
  const error = String(reply.data.error || '').trim();
  if (error) return error;
  if (reply.status === 404) {
    return 'This build has no /api/admin route. Deploy the latest commit from main, then try again.';
  }
  return fallback;
}

/**
 * Turn this browser into the owner device. Requires the admin password once;
 * the password itself is never stored.
 */
export async function enrollOwner(
  password: string
): Promise<{ ok: boolean; error?: string; adminToken?: string }> {
  const pass = String(password || '').trim();
  if (!pass) return { ok: false, error: 'Enter the admin password first.' };

  let reply: AdminReply;
  try {
    reply = await postAdmin({ action: 'owner_enroll', password: pass, deviceId: getDeviceId() });
  } catch {
    return { ok: false, error: 'Could not reach the server. Check the connection and try again.' };
  }

  if (!reply.ok || typeof reply.data.ownerToken !== 'string') {
    return { ok: false, error: friendlyError(reply, 'Could not register this device.') };
  }

  writeString(TOKEN_KEY, String(reply.data.ownerToken));
  verified = true;
  rememberThisDevice();
  writeString(MODE_KEY, 'pro');
  signal();

  return {
    ok: true,
    adminToken: typeof reply.data.adminToken === 'string' ? reply.data.adminToken : undefined
  };
}

/**
 * Silent check on boot. Returns a fresh admin session when this is still the
 * registered device. Never throws: offline keeps the cached recognition.
 */
export async function checkOwner(): Promise<{ ok: boolean; adminToken?: string; error?: string }> {
  const token = readString(TOKEN_KEY);
  if (!token) return { ok: false };

  let reply: AdminReply;
  try {
    reply = await postAdmin({ action: 'owner_check', ownerToken: token, deviceId: getDeviceId() });
  } catch {
    return { ok: false, error: 'offline' };
  }

  if (reply.ok && reply.data.ok === true) {
    verified = true;
    rememberThisDevice();
    signal();
    return {
      ok: true,
      adminToken: typeof reply.data.adminToken === 'string' ? reply.data.adminToken : undefined
    };
  }

  if (reply.status === 401) {
    // Definite refusal: the token expired or belongs to a different device.
    verified = false;
    forgetThisDevice();
    writeString(MODE_KEY, '');
    signal();
    return { ok: false, error: friendlyError(reply, 'This device is no longer registered.') };
  }

  return { ok: false, error: 'offline' };
}

/** De-register this browser. The next owner action will need the password. */
export function forgetOwnerDevice(): void {
  verified = false;
  forgetThisDevice();
  writeString(MODE_KEY, '');
  signal();
}
