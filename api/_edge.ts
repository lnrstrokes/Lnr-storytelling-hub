/*
  Edge-safe licensing helpers.

  Vercel's Node runtime fails every invocation in this project
  (FUNCTION_INVOCATION_FAILED) while an Edge function in the same deployment
  answers normally, so the API runs on the Edge runtime. Nothing here may
  import `node:*` — the Edge runtime has no Node built-ins — so everything is
  WebCrypto.

  The wire format is unchanged: keys are still `LNRPRO.<payload>.<sig>`, signed
  with a truncated HMAC-SHA256 over `PRO.<payload>` keyed by
  sha256("LNR_LICENSE_V1:" + LICENSE_SECRET). Keys minted by the old Node
  implementation therefore verify here unchanged.
*/

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

export interface OwnerTokenPayload {
  role: 'owner';
  did: string;
  iat: number;
  exp: number;
}

export interface ProLicensePayload {
  v: 1;
  tier: 'pro';
  plan: 'pro-monthly' | 'pro-yearly' | 'custom';
  watermark: string;
  site: string;
  brand: string;
  email: string;
  lockBrand: true;
  iat: number;
  exp: number;
}

export type JsonRecord = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/* crypto.subtle wants a real ArrayBuffer, not a view onto a shared pool. */
function buffer(input: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(input.length);
  copy.set(input);
  return copy.buffer;
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  return bytes(await crypto.subtle.digest('SHA-256', buffer(input)));
}

function toBase64Url(input: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < input.length; i += 1) binary += String.fromCharCode(input[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const normalised = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function toHex(input: Uint8Array): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) out += input[i].toString(16).padStart(2, '0');
  return out;
}

/* Length-independent comparison, so a wrong password cannot be found by timing. */
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacSegment(segment: string, secret: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    buffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = bytes(await crypto.subtle.sign('HMAC', key, buffer(encoder.encode(segment))));
  return toBase64Url(signature.slice(0, 16));
}

async function verifySegment(segment: string, provided: string, secret: Uint8Array): Promise<boolean> {
  try {
    return constantTimeEqual(await hmacSegment(segment, secret), String(provided || ''));
  } catch {
    return false;
  }
}

export function getAdminPassword(): string {
  const candidates = [
    process.env.ADMIN_PASSWORD,
    process.env.LNR_ADMIN_PASSWORD,
    process.env.ADMIN_PASS,
    process.env.LNR_PASSWORD,
    process.env.PASSWORD,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

export function getGoogleFormUrl(): string {
  return String(process.env.GOOGLE_FORM_URL || process.env.VITE_GOOGLE_FORM_URL || '').trim();
}

/**
 * The key every signature in this app is made with.
 *
 * LICENSE_SECRET is required for Pro keys (`strict`). Falling back to the
 * admin password would mean that rotating — or leaking — ADMIN_PASSWORD would
 * silently invalidate every customer licence, or let anyone who knows it mint
 * one. Admin session tokens keep the fallback so an existing deployment is not
 * locked out of its own operator tools before the secret is added in Vercel.
 */
async function signingSecret(strict = false): Promise<Uint8Array> {
  const explicit = String(process.env.LICENSE_SECRET || '').trim();
  if (explicit) return sha256(encoder.encode(`LNR_LICENSE_V1:${explicit}`));
  if (strict) {
    throw new Error(
      'LICENSE_SECRET is not configured. Add it in Vercel → Settings → Environment Variables, then redeploy.'
    );
  }
  const adminPass = getAdminPassword();
  if (!adminPass) {
    throw new Error('ADMIN_PASSWORD is not configured in environment variables.');
  }
  return sha256(encoder.encode(`LNR_STUDIO_HMAC_V1:${adminPass}`));
}

export async function verifyPasswordCandidate(
  candidate: string
): Promise<{ ok: boolean; error?: string }> {
  const configured = getAdminPassword();
  if (!configured) {
    return {
      ok: false,
      error:
        'Admin password env var not found. Ensure ADMIN_PASSWORD is set in Vercel Environment Variables and redeploy.',
    };
  }
  const clean = String(candidate || '');
  if (!clean) return { ok: false, error: 'Enter your admin password.' };
  const a = toHex(await sha256(encoder.encode(clean)));
  const b = toHex(await sha256(encoder.encode(configured)));
  if (!constantTimeEqual(a, b)) return { ok: false, error: 'Incorrect admin password.' };
  return { ok: true };
}

export async function createAdminToken(ttlDays = 30): Promise<string> {
  const now = Date.now();
  const payload: AdminTokenPayload = { role: 'admin', iat: now, exp: now + ttlDays * 86400 * 1000 };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSegment(`ADM.${body}`, await signingSecret());
  return `LNRADM.${body}.${signature}`;
}

export async function verifyAdminToken(token: string): Promise<{ ok: boolean; error?: string }> {
  let secret: Uint8Array;
  try {
    secret = await signingSecret();
  } catch {
    return { ok: false, error: 'Server ADMIN_PASSWORD env var is missing.' };
  }
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'LNRADM') {
    return { ok: false, error: 'Invalid admin session.' };
  }
  const [, body, signature] = parts;
  if (!(await verifySegment(`ADM.${body}`, signature, secret))) {
    return { ok: false, error: 'Admin session expired or invalid.' };
  }
  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(body))) as AdminTokenPayload;
    if (parsed.role !== 'admin' || !parsed.exp || Date.now() > parsed.exp) {
      return { ok: false, error: 'Admin session expired. Unlock again.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Malformed admin session.' };
  }
}

/**
 * Owner device identity.
 *
 * A device id is a random string the browser makes once and keeps. It is not
 * a fingerprint: it identifies a browser install, which is exactly the scope
 * of "this is my phone". Only a signature minted by the server after the
 * admin password was entered can turn it into an owner device.
 */
export function sanitizeDeviceId(raw: unknown): string {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

export async function createOwnerToken(deviceId: string, ttlDays = 365): Promise<string> {
  const now = Date.now();
  const payload: OwnerTokenPayload = {
    role: 'owner',
    did: deviceId,
    iat: now,
    exp: now + ttlDays * 86400 * 1000,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSegment(`OWN.${body}`, await signingSecret());
  return `LNROWN.${body}.${signature}`;
}

export async function verifyOwnerToken(
  token: string
): Promise<{ ok: boolean; deviceId?: string; error?: string }> {
  let secret: Uint8Array;
  try {
    secret = await signingSecret();
  } catch {
    return { ok: false, error: 'Admin password env var is missing.' };
  }
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'LNROWN') {
    return { ok: false, error: 'This device is not registered.' };
  }
  const [, body, signature] = parts;
  if (!(await verifySegment(`OWN.${body}`, signature, secret))) {
    return { ok: false, error: 'Device registration is invalid.' };
  }
  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(body))) as OwnerTokenPayload;
    if (parsed.role !== 'owner' || !parsed.did || !parsed.exp) {
      return { ok: false, error: 'Malformed device registration.' };
    }
    if (Date.now() > parsed.exp) {
      return { ok: false, error: 'This device registration has expired. Enter the admin password again.' };
    }
    return { ok: true, deviceId: parsed.did };
  } catch {
    return { ok: false, error: 'Malformed device registration.' };
  }
}

export function sanitizeWatermark(raw: unknown): string {
  const value = String(raw || '').trim().slice(0, 14);
  return value || 'CHANNEL';
}

export function sanitizeSite(raw: unknown): string {
  // An empty value means "not bound to a hostname" — the key works anywhere.
  // Setting a hostname is what stops a key being shared with other channels.
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .slice(0, 42);
}

export function sanitizeBrand(raw: unknown): string {
  const value = String(raw || '').trim().slice(0, 28);
  return value || 'CREATOR STUDIO';
}

export async function createProLicenseKey(input: {
  watermark: unknown;
  site: unknown;
  brand: unknown;
  email?: unknown;
  plan?: unknown;
  days?: unknown;
}): Promise<{ key: string; payload: ProLicensePayload }> {
  const now = Date.now();
  const days = Math.max(1, Math.min(3650, Math.round(Number(input.days) || 30)));
  const rawPlan = String(input.plan || 'pro-monthly');
  const plan: ProLicensePayload['plan'] =
    rawPlan === 'pro-yearly' || rawPlan === 'custom' ? rawPlan : 'pro-monthly';

  const payload: ProLicensePayload = {
    v: 1,
    tier: 'pro',
    plan,
    watermark: sanitizeWatermark(input.watermark),
    site: sanitizeSite(input.site),
    brand: sanitizeBrand(input.brand),
    email: String(input.email || '').trim().slice(0, 80),
    lockBrand: true,
    iat: now,
    exp: now + days * 86400 * 1000,
  };

  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSegment(`PRO.${body}`, await signingSecret(true));
  return { key: `LNRPRO.${body}.${signature}`, payload };
}

export async function verifyProLicenseKey(rawKey: string): Promise<{
  ok: boolean;
  license?: ProLicensePayload & { keyDigest: string };
  error?: string;
}> {
  let secret: Uint8Array;
  try {
    secret = await signingSecret(true);
  } catch {
    return { ok: false, error: 'Licensing service is not configured on the server.' };
  }
  const clean = String(rawKey || '').trim().replace(/\s+/g, '');
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== 'LNRPRO') {
    return { ok: false, error: 'License key must start with LNRPRO.' };
  }
  const [, body, signature] = parts;
  if (!(await verifySegment(`PRO.${body}`, signature, secret))) {
    return { ok: false, error: 'Invalid license key signature. Check for typos or contact support.' };
  }
  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(body))) as ProLicensePayload;
    if (parsed.tier !== 'pro' || !parsed.exp) {
      return { ok: false, error: 'Malformed license payload.' };
    }
    if (Date.now() > parsed.exp) {
      return {
        ok: false,
        error: 'This Pro license key has expired. Contact lnrstrokes@gmail.com to renew.',
      };
    }
    const digest = toHex(await sha256(encoder.encode(clean))).slice(0, 16);
    return {
      ok: true,
      license: {
        ...parsed,
        watermark: sanitizeWatermark(parsed.watermark),
        site: sanitizeSite(parsed.site),
        brand: sanitizeBrand(parsed.brand),
        lockBrand: true,
        keyDigest: digest,
      },
    };
  } catch {
    return { ok: false, error: 'Could not decode license key.' };
  }
}

export function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function readJson(req: Request): Promise<JsonRecord> {
  try {
    const text = (await req.text()).trim();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : {};
  } catch {
    return {};
  }
}
