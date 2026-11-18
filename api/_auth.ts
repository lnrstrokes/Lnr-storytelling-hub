import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface AdminTokenPayload {
  role: 'admin';
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

export function getAdminPassword(): string {
  const candidates = [
    process.env.ADMIN_PASSWORD,
    process.env.LNR_ADMIN_PASSWORD,
    process.env.ADMIN_PASS,
    process.env.LNR_PASSWORD,
    process.env.PASSWORD,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

export function getGoogleFormUrl(): string {
  return String(process.env.GOOGLE_FORM_URL || process.env.VITE_GOOGLE_FORM_URL || '').trim();
}

function sha256(input: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(input).digest();
}

function getSigningSecret(): Buffer {
  const explicit = String(process.env.LICENSE_SECRET || '').trim();
  if (explicit) return sha256(`LNR_LICENSE_V1:${explicit}`);
  const adminPass = getAdminPassword();
  if (!adminPass) {
    throw new Error('ADMIN_PASSWORD is not configured in environment variables.');
  }
  return sha256(`LNR_STUDIO_HMAC_V1:${adminPass}`);
}

export function verifyPasswordCandidate(candidate: string): { ok: boolean; error?: string } {
  const configured = getAdminPassword();
  if (!configured) {
    return {
      ok: false,
      error: 'Admin password env var not found. Ensure ADMIN_PASSWORD is set in Vercel Environment Variables and redeploy.',
    };
  }
  const clean = String(candidate || '');
  if (!clean) {
    return { ok: false, error: 'Enter your admin password.' };
  }
  const a = sha256(clean);
  const b = sha256(configured);
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Incorrect admin password.' };
  }
  return { ok: true };
}

function toBase64Url(buf: Buffer | string): string {
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function signHmacSegment(segment: string): string {
  const mac = crypto.createHmac('sha256', getSigningSecret()).update(segment).digest().subarray(0, 16);
  return toBase64Url(mac);
}

function verifyHmacSegment(segment: string, providedSig: string): boolean {
  try {
    const expected = signHmacSegment(segment);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(providedSig || ''), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createAdminToken(ttlDays = 30): string {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    role: 'admin',
    iat: now,
    exp: now + ttlDays * 86400 * 1000,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const sig = signHmacSegment(`ADM.${body}`);
  return `LNRADM.${body}.${sig}`;
}

export function verifyAdminToken(token: string): { ok: boolean; error?: string } {
  try {
    getSigningSecret();
  } catch {
    return { ok: false, error: 'Server ADMIN_PASSWORD env var is missing.' };
  }
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'LNRADM') {
    return { ok: false, error: 'Invalid admin session.' };
  }
  const body = parts[1];
  const sig = parts[2];
  if (!verifyHmacSegment(`ADM.${body}`, sig)) {
    return { ok: false, error: 'Admin session expired or invalid.' };
  }
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString('utf8')) as AdminTokenPayload;
    if (parsed.role !== 'admin' || !parsed.exp || Date.now() > parsed.exp) {
      return { ok: false, error: 'Admin session expired. Unlock again.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Malformed admin session.' };
  }
}

export function sanitizeWatermark(raw: unknown): string {
  const s = String(raw || '').trim().slice(0, 14);
  return s || 'CHANNEL';
}

export function sanitizeSite(raw: unknown): string {
  const s = String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .slice(0, 42);
  return s || 'lnr-studio-247-livestream-engine.vercel.app';
}

export function sanitizeBrand(raw: unknown): string {
  const s = String(raw || '').trim().slice(0, 28);
  return s || 'CREATOR STUDIO';
}

export function createProLicenseKey(input: {
  watermark: unknown;
  site: unknown;
  brand: unknown;
  email?: unknown;
  plan?: unknown;
  days?: unknown;
}): { key: string; payload: ProLicensePayload } {
  const now = Date.now();
  const daysNum = Math.max(1, Math.min(3650, Math.round(Number(input.days) || 30)));
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
    exp: now + daysNum * 86400 * 1000,
  };

  const body = toBase64Url(JSON.stringify(payload));
  const sig = signHmacSegment(`PRO.${body}`);
  return {
    key: `LNRPRO.${body}.${sig}`,
    payload,
  };
}

export function verifyProLicenseKey(rawKey: string): {
  ok: boolean;
  license?: ProLicensePayload & { keyDigest: string };
  error?: string;
} {
  try {
    getSigningSecret();
  } catch {
    return { ok: false, error: 'Licensing service is not configured on the server.' };
  }
  const clean = String(rawKey || '').trim().replace(/\s+/g, '');
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== 'LNRPRO') {
    return { ok: false, error: 'License key must start with LNRPRO.' };
  }
  const [, body, sig] = parts;
  if (!verifyHmacSegment(`PRO.${body}`, sig)) {
    return { ok: false, error: 'Invalid license key signature. Check for typos or contact support.' };
  }
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString('utf8')) as ProLicensePayload;
    if (parsed.tier !== 'pro' || !parsed.exp) {
      return { ok: false, error: 'Malformed license payload.' };
    }
    if (Date.now() > parsed.exp) {
      return { ok: false, error: 'This Pro license key has expired. Contact lnrstrokes@gmail.com to renew.' };
    }
    const digest = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
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

export async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<JsonRecord> {
  if (req.body && typeof req.body === 'object') {
    return req.body as JsonRecord;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as JsonRecord;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JsonRecord;
  } catch {
    return {};
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
