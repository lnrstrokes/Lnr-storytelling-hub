import type { IncomingMessage, ServerResponse } from 'node:http';

/* The API handlers are Edge functions (Request → Response) because Vercel's
   Node runtime cannot invoke functions in this project. This adapter runs them
   under Node for the local dev server and the bundled `npm start` server, so
   local testing exercises exactly the code production runs. */
export type ApiHandler = (req: Request) => Promise<Response>;
export type NodeRequest = IncomingMessage & { body?: unknown };

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function forwardApi(
  handler: ApiHandler,
  req: NodeRequest,
  res: ServerResponse
): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }

  const method = (req.method || 'GET').toUpperCase();
  const withBody = method !== 'GET' && method !== 'HEAD';
  let body: string | undefined;
  if (withBody) {
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    } else {
      body = await readRawBody(req);
    }
  }

  const url = `http://${req.headers.host || 'localhost'}${req.url || '/'}`;
  const response = await handler(new Request(url, { method, headers, body }));

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}
