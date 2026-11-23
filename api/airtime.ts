/* ==========================================================================
   /api/airtime — the server is the source of truth for Free-tier airtime
   --------------------------------------------------------------------------
   WHY THIS EXISTS

   The previous cap lived entirely in the browser. It survived reloads and
   clock changes, but it was still the client's own word: clearing site data,
   opening a private window, or editing the stored value started a fresh
   2 hours. A cap the client can reset is not a cap.

   THE RULE

     Free : 2 hours of airtime per calendar day (UTC), counted by the server.
     Pro  : unlimited. The licence key is verified HERE, not trusted from the
            client, so a Free device cannot claim Pro to dodge the cap.

   IDENTITY

   A signed, httpOnly cookie issued by this endpoint. It is not readable or
   writable from JavaScript, so a page script cannot forge or reset it, and it
   is shared by every tab on the device. A reload, a new tab, a cleared
   localStorage and a changed system clock all keep the same identity and
   therefore the same tally.

   The honest limit: wiping ALL cookies for the site (or a private window)
   presents a new identity. Closing that hole needs a signed-in account, which
   this app does not have. Everything short of that is enforced.

   STORE

   Upstash Redis over its REST API — a network store, so it survives a Vercel
   cold start (the filesystem does not). Configured by either:
     KV_REST_API_URL      + KV_REST_API_TOKEN        (Vercel KV / Marketplace)
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
   With neither set the endpoint still enforces the cap, but only in memory
   for the life of one instance, and /api/airtime reports store:"memory" so
   the gap is visible instead of silent.
   ========================================================================== */

import { json, readJson, verifyProLicenseKey } from './_edge';

export const config = { runtime: 'edge' };

/** Free plan: 2 hours of airtime per calendar day. */
const FREE_DAILY_LIMIT_MS = 2 * 60 * 60 * 1000;

/** A single tick longer than this is a suspended tab, not real airtime. */
const MAX_TICK_MS = 90 * 1000;

const COOKIE_NAME = 'lnr_air_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days

/* ------------------------------------------------------------------ store */

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  kind: 'redis' | 'memory';
}

const memory = new Map<string, { value: string; expires: number }>();

function redisConfig(): { url: string; token: string } | null {
  const url = String(
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
  ).trim();
  const token = String(
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  ).trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

function makeStore(): Store {
  const cfg = redisConfig();
  if (!cfg) {
    return {
      kind: 'memory',
      async get(key) {
        const hit = memory.get(key);
        if (!hit) return null;
        if (hit.expires && hit.expires < Date.now()) {
          memory.delete(key);
          return null;
        }
        return hit.value;
      },
      async set(key, value, ttlSeconds) {
        memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      },
    };
  }

  const call = async (path: string, body?: string): Promise<unknown> => {
    const res = await fetch(`${cfg.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${cfg.token}`,
        ...(body === undefined ? {} : { 'content-type': 'text/plain' }),
      },
      body,
    });
    if (!res.ok) throw new Error(`store ${res.status}`);
    return res.json();
  };

  return {
    kind: 'redis',
    async get(key) {
      const out = (await call(`/get/${encodeURIComponent(key)}`)) as { result?: string | null };
      return out && typeof out.result === 'string' ? out.result : null;
    },
    async set(key, value, ttlSeconds) {
      await call(`/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, value);
    },
  };
}

/* --------------------------------------------------------------- identity */

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function identitySecret(): Promise<Uint8Array> {
  const explicit = String(process.env.LICENSE_SECRET || '').trim();
  const seed = explicit || String(process.env.ADMIN_PASSWORD || 'lnr-airtime-dev').trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`LNR_AIRTIME_V1:${seed}`));
  return new Uint8Array(digest);
}

async function signId(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    await identitySecret(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id));
  return toBase64Url(new Uint8Array(sig).slice(0, 12));
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function readCookie(req: Request, name: string): string {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

/** Returns the caller's identity, minting one when absent or forged. */
async function resolveIdentity(req: Request): Promise<{ id: string; fresh: boolean }> {
  const raw = readCookie(req, COOKIE_NAME);
  if (raw) {
    const [id, sig] = raw.split('.');
    if (id && sig && (await signId(id)) === sig) return { id, fresh: false };
  }
  return { id: randomId(), fresh: true };
}

function cookieHeader(id: string, sig: string): string {
  return `${COOKIE_NAME}=${id}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Secure`;
}

/* ------------------------------------------------------------------ tally */

function dayKey(): string {
  return new Date().toISOString().slice(0, 10); // UTC calendar day
}

interface Record_ {
  day: string;
  usedMs: number;
}

async function readRecord(store: Store, id: string): Promise<Record_> {
  const day = dayKey();
  const raw = await store.get(`air:${id}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Record_>;
      if (parsed && parsed.day === day && typeof parsed.usedMs === 'number' && parsed.usedMs >= 0) {
        return { day, usedMs: parsed.usedMs };
      }
    } catch {
      /* corrupt: start the day over rather than lock the user out */
    }
  }
  return { day, usedMs: 0 };
}

async function writeRecord(store: Store, id: string, rec: Record_): Promise<void> {
  /* Two days of TTL: long enough that a late tick still lands on the right
     day, short enough that the store does not grow without bound. */
  await store.set(`air:${id}`, JSON.stringify(rec), 60 * 60 * 48);
}

/* ------------------------------------------------------- device identity */

/**
 * A second, independent key supplied by the client and kept in localStorage.
 *
 * The cookie and this key are cleared by different actions, so the server
 * keeps a tally under BOTH and uses the larger. Wiping cookies leaves the
 * device key; wiping site data leaves the cookie. Only clearing both at once
 * — or a private window — presents a genuinely new identity, and that is the
 * one gap a cookie-only design cannot close without user accounts.
 */
function sanitizeDeviceId(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(text)) return '';
  return text;
}

/* ---------------------------------------------------------------- handler */

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const body = await readJson(req);
  const action = String(body.action || 'status');
  const store = makeStore();

  const { id, fresh } = await resolveIdentity(req);
  const sig = await signId(id);
  const deviceId = sanitizeDeviceId(body.deviceId);

  /* Pro is decided here. A client that simply says "I am Pro" is ignored. */
  let pro = false;
  const licenseKey = String(body.licenseKey || '').trim();
  if (licenseKey) {
    try {
      const result = await verifyProLicenseKey(licenseKey);
      pro = !!result.ok;
    } catch {
      pro = false;
    }
  }

  /* The larger of the two tallies wins, so clearing either store cannot
     refund airtime. */
  const cookieRec = await readRecord(store, id);
  const deviceRec = deviceId ? await readRecord(store, `dev:${deviceId}`) : null;
  const rec: Record_ = {
    day: cookieRec.day,
    usedMs: Math.max(cookieRec.usedMs, deviceRec ? deviceRec.usedMs : 0),
  };

  const persist = async () => {
    await writeRecord(store, id, rec);
    if (deviceId) await writeRecord(store, `dev:${deviceId}`, rec);
  };

  const respond = (status: number, payload: Record<string, unknown>) => {
    const res = json(status, {
      ok: true,
      pro,
      usedMs: rec.usedMs,
      limitMs: FREE_DAILY_LIMIT_MS,
      remainingMs: pro ? null : Math.max(0, FREE_DAILY_LIMIT_MS - rec.usedMs),
      exhausted: !pro && rec.usedMs >= FREE_DAILY_LIMIT_MS,
      day: rec.day,
      store: store.kind,
      ...payload,
    });
    if (fresh) res.headers.set('set-cookie', cookieHeader(id, sig));
    return res;
  };

  if (action === 'status') {
    return respond(200, {});
  }

  /* Pro never accrues and is never refused. */
  if (pro) {
    return respond(200, { allowed: true });
  }

  if (action === 'start') {
    if (rec.usedMs >= FREE_DAILY_LIMIT_MS) {
      return respond(403, { allowed: false, reason: 'exhausted' });
    }
    return respond(200, { allowed: true });
  }

  if (action === 'tick') {
    const delta = Number(body.deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) {
      return respond(400, { allowed: false, reason: 'bad-delta' });
    }
    /* Clamp: a suspended tab or a forged huge delta cannot burn or bank more
       than one real tick. */
    const add = Math.min(Math.round(delta), MAX_TICK_MS);

    if (rec.usedMs >= FREE_DAILY_LIMIT_MS) {
      return respond(403, { allowed: false, reason: 'exhausted' });
    }

    rec.usedMs = Math.min(FREE_DAILY_LIMIT_MS, rec.usedMs + add);
    await persist();

    const exhausted = rec.usedMs >= FREE_DAILY_LIMIT_MS;
    return respond(exhausted ? 403 : 200, {
      allowed: !exhausted,
      reason: exhausted ? 'exhausted' : undefined,
    });
  }

  if (action === 'stop') {
    return respond(200, { allowed: true });
  }

  return respond(400, { allowed: false, reason: 'unknown-action' });
}
