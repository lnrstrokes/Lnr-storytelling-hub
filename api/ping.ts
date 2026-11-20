import type { IncomingMessage, ServerResponse } from 'node:http';
import { getGoogleFormUrl, sendJson } from './_auth';
import { PRIVATE_BANKS } from './_banks/index';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let banks = -1;
  try {
    banks = Object.keys(PRIVATE_BANKS as Record<string, unknown>).length;
  } catch (error) {
    banks = -2;
  }
  sendJson(res, 200, {
    ok: true,
    node: process.version,
    authModule: 'loaded',
    banks,
    form: getGoogleFormUrl(),
  });
}
