import { json, readJson, verifyProLicenseKey } from './_edge';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const body = await readJson(req);
  const result = await verifyProLicenseKey(String(body.key || ''));

  if (!result.ok) {
    return json(400, { ok: false, error: result.error || 'Invalid license key' });
  }

  return json(200, { ok: true, license: result.license });
}
