import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createAdminToken,
  createProLicenseKey,
  getAdminPassword,
  getGoogleFormUrl,
  readJsonBody,
  sendJson,
  verifyAdminToken,
  verifyPasswordCandidate,
} from './_auth';
import { PRIVATE_BANKS } from './_banks/index';

/* Brute-force brake for the operator password.
   A serverless instance is ephemeral, so this throttles rather than guarantees
   — but it turns an unlimited guess-until-it-works against a public endpoint
   into six tries per ten minutes per address. */
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_UNLOCKS = 6;
const failedUnlocks = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: IncomingMessage): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
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

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      configured: getAdminPassword().length > 0,
      googleFormUrl: getGoogleFormUrl(),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const action = String(body.action || '');

  if (action === 'unlock') {
    const attemptKey = clientKey(req);
    if (isUnlockThrottled(attemptKey)) {
      sendJson(res, 429, {
        ok: false,
        error: 'Too many incorrect attempts. Wait 10 minutes and try again.',
      });
      return;
    }
    const check = verifyPasswordCandidate(String(body.password || ''));
    if (!check.ok) {
      noteUnlockFailure(attemptKey);
      sendJson(res, 401, { ok: false, error: check.error || 'Unauthorized' });
      return;
    }
    failedUnlocks.delete(attemptKey);
    const adminToken = createAdminToken(30);
    sendJson(res, 200, {
      ok: true,
      adminToken,
      config: {
        googleFormUrl: getGoogleFormUrl(),
      },
      banks: PRIVATE_BANKS,
    });
    return;
  }

  if (action === 'refresh') {
    const check = verifyAdminToken(String(body.adminToken || ''));
    if (!check.ok) {
      sendJson(res, 401, { ok: false, error: check.error || 'Admin session invalid' });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      config: {
        googleFormUrl: getGoogleFormUrl(),
      },
      banks: PRIVATE_BANKS,
    });
    return;
  }

  if (action === 'sign_license') {
    const check = verifyAdminToken(String(body.adminToken || ''));
    if (!check.ok) {
      sendJson(res, 401, { ok: false, error: check.error || 'Admin unlock required' });
      return;
    }
    try {
      const issued = createProLicenseKey({
        watermark: body.watermark,
        site: body.site,
        brand: body.brand,
        email: body.email,
        plan: body.plan,
        days: body.days,
      });
      sendJson(res, 200, {
        ok: true,
        key: issued.key,
        payload: issued.payload,
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to sign Pro key',
      });
    }
    return;
  }

  sendJson(res, 400, { ok: false, error: 'Unknown admin action' });
}
