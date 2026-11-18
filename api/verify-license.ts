import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, sendJson, verifyProLicenseKey } from './_auth';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const key = String(body.key || '');
  const result = verifyProLicenseKey(key);

  if (!result.ok) {
    sendJson(res, 400, { ok: false, error: result.error || 'Invalid license key' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    license: result.license,
  });
}
