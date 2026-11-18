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
    const check = verifyPasswordCandidate(String(body.password || ''));
    if (!check.ok) {
      sendJson(res, 401, { ok: false, error: check.error || 'Unauthorized' });
      return;
    }
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
