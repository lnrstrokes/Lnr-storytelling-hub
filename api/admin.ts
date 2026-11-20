import {
  createAdminToken,
  createProLicenseKey,
  getAdminPassword,
  getGoogleFormUrl,
  json,
  readJson,
  verifyAdminToken,
  verifyPasswordCandidate,
} from './_edge';
import { PRIVATE_BANKS } from './_banks/index';

export const config = { runtime: 'edge' };

/* Brute-force brake for the operator password.
   A serverless instance is ephemeral, so this throttles rather than guarantees
   — but it turns an unlimited guess-until-it-works against a public endpoint
   into six tries per ten minutes per address. */
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_UNLOCKS = 6;
const failedUnlocks = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = String(req.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    .trim();
  return forwarded || String(req.headers.get('x-real-ip') || 'unknown');
}

function isUnlockThrottled(key: string): boolean {
  const record = failedUnlocks.get(key);
  if (!record) return false;
  if (Date.now() > record.resetAt) {
    failedUnlocks.delete(key);
    return false;
  }
  return record.count >= MAX_FAILED_UNLOCKS;
}

function noteUnlockFailure(key: string): void {
  const now = Date.now();
  const record = failedUnlocks.get(key);
  if (!record || now > record.resetAt) {
    failedUnlocks.set(key, { count: 1, resetAt: now + UNLOCK_WINDOW_MS });
    return;
  }
  record.count += 1;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return json(200, {
      ok: true,
      configured: getAdminPassword().length > 0,
      googleFormUrl: getGoogleFormUrl(),
    });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const body = await readJson(req);
  const action = String(body.action || '');

  if (action === 'unlock') {
    const attemptKey = clientKey(req);
    if (isUnlockThrottled(attemptKey)) {
      return json(429, {
        ok: false,
        error: 'Too many incorrect attempts. Wait 10 minutes and try again.',
      });
    }
    const check = await verifyPasswordCandidate(String(body.password || ''));
    if (!check.ok) {
      noteUnlockFailure(attemptKey);
      return json(401, { ok: false, error: check.error || 'Unauthorized' });
    }
    failedUnlocks.delete(attemptKey);
    const adminToken = await createAdminToken(30);
    return json(200, {
      ok: true,
      adminToken,
      config: { googleFormUrl: getGoogleFormUrl() },
      banks: PRIVATE_BANKS,
    });
  }

  if (action === 'refresh') {
    const check = await verifyAdminToken(String(body.adminToken || ''));
    if (!check.ok) {
      return json(401, { ok: false, error: check.error || 'Admin session invalid' });
    }
    return json(200, {
      ok: true,
      config: { googleFormUrl: getGoogleFormUrl() },
      banks: PRIVATE_BANKS,
    });
  }

  if (action === 'sign_license') {
    const check = await verifyAdminToken(String(body.adminToken || ''));
    if (!check.ok) {
      return json(401, { ok: false, error: check.error || 'Admin unlock required' });
    }
    try {
      const issued = await createProLicenseKey({
        watermark: body.watermark,
        site: body.site,
        brand: body.brand,
        email: body.email,
        plan: body.plan,
        days: body.days,
      });
      return json(200, { ok: true, key: issued.key, payload: issued.payload });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to sign Pro key',
      });
    }
  }

  return json(400, { ok: false, error: 'Unknown admin action' });
}
