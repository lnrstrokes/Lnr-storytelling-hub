export const config = { runtime: 'edge' };

export default function handler(): Response {
  return new Response(JSON.stringify({ ok: true, runtime: 'edge', at: Date.now() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
