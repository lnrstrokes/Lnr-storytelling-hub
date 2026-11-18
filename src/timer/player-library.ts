/* ============================================================
   lnr Studio — Player Library, ZIP Import/Export, IndexedDB & Audit
   Zero-server, offline-first media & identity store for Engine 03.
   ============================================================ */

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { DEMO_PLAYERS, DEMO_PLAYER_QUIZZES } from './demo-content.ts';

export type PlayerQuizMode = 'clues' | 'blur_reveal' | 'zoom_crop' | 'silhouette';

export interface StarterPlayer {
  player_id: string;
  name: string;
  club: string;
  nationality: string;
  position: string;
  number: string;
  era: 'Active' | 'Legend';
  accent: [string, string];
}

export interface StarterPlayerQuiz {
  quiz_id: string;
  category: string;
  mode: PlayerQuizMode;
  question: string;
  clues: string[];
  answer_player_id: string;
  reveal_text: string;
  insight: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface PlayerRecord {
  player_id: string;
  name: string;
  image?: string;
  club: string;
  nationality: string;
  position?: string;
  number?: string;
  era?: string;
  accent?: [string, string];
  source: 'starter' | 'custom';
  updatedAt?: number;
}

export interface PlayerQuizRecord {
  quiz_id: string;
  category: string;
  mode: PlayerQuizMode;
  question: string;
  clues: string[];
  answer_player_id: string;
  reveal_text: string;
  insight: string;
  difficulty: string;
  source: 'starter' | 'custom';
}

export interface ImageMetaRecord {
  player_id: string;
  mime: string;
  sha256: string;
  filename: string;
  size: number;
  updatedAt: number;
}

export interface PreloadedVisual {
  player_id: string;
  url: string;
  mysteryUrl: string;
  fallbackUrl: string;
  isRealPhoto: boolean;
  isObjectUrl: boolean;
  player: PlayerRecord;
}

export interface LibraryAuditReport {
  totalPlayers: number;
  starterPlayers: number;
  customPlayers: number;
  totalQuizzes: number;
  customQuizzes: number;
  imagesCount: number;
  missingImages: Array<{ player_id: string; name: string; club: string; source: 'starter' | 'custom' }>;
  unmatchedImages: string[];
  duplicatePlayerIds: string[];
  invalidFiles: string[];
  duplicateImageHashes: Array<{ sha256: string; playerIds: string[] }>;
  storageUsageBytes: number;
  storageQuotaBytes: number;
  persisted: boolean;
}

export interface ZipImportSummary {
  playersAdded: number;
  playersUpdated: number;
  imagesStored: number;
  quizzesImported: number;
  duplicatePlayerIds: string[];
  invalidFiles: string[];
  unmatchedImages: string[];
  persisted: boolean;
}

const DB_NAME = 'lnr_player_library';
const DB_VER = 1;
const STORE_PLAYERS = 'players';
const STORE_IMAGES = 'images';
const STORE_QUIZZES = 'quizzes';

let dbPromise: Promise<IDBDatabase> | null = null;
let lastImportDuplicates: string[] = [];
let lastImportInvalidFiles: string[] = [];

/* Built-in full starter banks (150 players + 150 quizzes unlocked for all creators) */
let builtInStarterPlayers: StarterPlayer[] = [];
let builtInStarterQuizzes: StarterPlayerQuiz[] = [];

/* In-memory cache kept in sync with IndexedDB so synchronous quiz draws stay fast */
const customPlayersMap = new Map<string, PlayerRecord>();
const customQuizzesMap = new Map<string, PlayerQuizRecord>();
const imageMetaMap = new Map<string, ImageMetaRecord>();
const fallbackCache = new Map<string, string>();
let initialized = false;
let initPromise: Promise<void> | null = null;
const changeListeners = new Set<() => void>();

export function setStarterData(
  players: StarterPlayer[] = [],
  quizzes: StarterPlayerQuiz[] = []
): void {
  builtInStarterPlayers = Array.isArray(players) ? players : [];
  builtInStarterQuizzes = Array.isArray(quizzes) ? quizzes : [];
  notifyChange();
}

export const setAdminStarterData = setStarterData;

export function clearAdminStarterData(): void {
  notifyChange();
}

function notifyChange() {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is unavailable in this browser'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PLAYERS)) {
        db.createObjectStore(STORE_PLAYERS, { keyPath: 'player_id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'player_id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUIZZES)) {
        db.createObjectStore(STORE_QUIZZES, { keyPath: 'quiz_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open player library DB'));
  });
  return dbPromise;
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return openDB()
    .then(
      (db) =>
        new Promise<T[]>((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve((req.result as T[]) || []);
          req.onerror = () => resolve([]);
        })
    )
    .catch(() => []);
}

function idbGetOne<T>(storeName: string, key: string): Promise<T | null> {
  return openDB()
    .then(
      (db) =>
        new Promise<T | null>((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = () => resolve((req.result as T) || null);
          req.onerror = () => resolve(null);
        })
    )
    .catch(() => null);
}

async function idbPutBatch<T>(storeName: string, items: T[], chunkSize = 20): Promise<void> {
  if (!items.length) return;
  const db = await openDB();
  for (let i = 0; i < items.length; i += chunkSize) {
    const slice = items.slice(i, i + chunkSize);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      slice.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    });
    // Yield between chunks so mobile Safari/Chrome stays responsive
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function idbClearStore(storeName: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to clear store'));
  });
}

async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function getStorageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  let usage = 0;
  let quota = 0;
  let persisted = false;
  try {
    if (navigator.storage) {
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        usage = est.usage || 0;
        quota = est.quota || 0;
      }
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
    }
  } catch {
    /* ignore */
  }
  return { usage, quota, persisted };
}

function normalizePlayerId(raw: string): string {
  return String(raw || '').trim().toUpperCase();
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  return null;
}

async function computeSha256(bytes: Uint8Array): Promise<string> {
  try {
    if (window.crypto && window.crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const buf = await window.crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fallback below */
  }
  // Lightweight fallback checksum if subtle crypto is unavailable
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
  }
  return 'fnv_' + (h1 >>> 0).toString(16) + '_' + bytes.length;
}

function hashColorPair(seed: string): [string, string] {
  const palette: [string, string][] = [
    ['#d9ab63', '#152b23'],
    ['#6cabdd', '#1c2c5b'],
    ['#c8102e', '#1a1a1a'],
    ['#00529f', '#d4a017'],
    ['#008751', '#14261c'],
    ['#a50044', '#004d98'],
  ];
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[acc % palette.length];
}

function wrapCardText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) {
        const rest = [cur, ...words.slice(i + 1)].join(' ');
        cur = rest.length > maxChars ? rest.slice(0, maxChars - 1).trimEnd() + '…' : rest;
        break;
      }
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

export function getPlayerColors(playerId: string): [string, string] {
  const p = getPlayerById(playerId);
  if (p && p.accent && p.accent.length === 2) return p.accent;
  return hashColorPair(normalizePlayerId(playerId) || 'PLY001');
}

export function renderFallbackCardDataUrl(
  player: PlayerRecord,
  options?: { mystery?: boolean; insight?: string }
): string {
  const isMystery = !!options?.mystery;
  const insight = String(options?.insight || '').trim();
  const key = `${player.player_id}|${player.name}|${player.club}|${player.number || ''}|${isMystery ? 'M' : 'R'}|${insight.slice(0, 48)}`;
  const cached = fallbackCache.get(key);
  if (cached) return cached;

  const [c1, c2] = player.accent && player.accent.length === 2 ? player.accent : hashColorPair(player.player_id);
  const parts = player.name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : player.name.slice(0, 2).toUpperCase();
  const num = escapeXml(String(player.number || '10'));
  const clubNat = escapeXml(
    `${(player.club || 'FOOTBALL').toUpperCase()} · ${(player.nationality || 'INTL').toUpperCase()}`.slice(0, 34)
  );
  const pos = escapeXml((player.position || 'PLAYER').toUpperCase());
  const pid = escapeXml(player.player_id);
  const nameLines = wrapCardText(player.name || player.player_id, 17, 2);
  const insightLines = wrapCardText(insight || (player.era ? `Era: ${player.era}` : `${player.club} standout`), 36, 2);

  if (isMystery) {
    const mSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#13221d"/>
      <stop offset="55%" stop-color="#0a1310"/>
      <stop offset="100%" stop-color="#070d0a"/>
    </linearGradient>
    <linearGradient id="stripe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${escapeXml(c1)}"/>
      <stop offset="100%" stop-color="${escapeXml(c2)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${escapeXml(c1)}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${escapeXml(c1)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="500" rx="24" fill="url(#bg)"/>
  <rect width="400" height="500" rx="24" fill="url(#glow)"/>
  <rect x="14" y="14" width="372" height="472" rx="18" fill="none" stroke="#d9ab63" stroke-opacity="0.32" stroke-width="2"/>
  <path d="M0 0 H400 V10 L0 10 Z" fill="url(#stripe)"/>
  <text x="200" y="54" text-anchor="middle" fill="#d9ab63" font-family="ui-monospace, monospace" font-size="14" font-weight="700" letter-spacing="2.4">MYSTERY PLAYER CARD</text>
  <path d="M116 112 L162 92 C178 109 222 109 238 92 L284 112 L338 168 L302 214 L270 188 L270 344 C270 356 260 366 248 366 L152 366 C140 366 130 356 130 344 L130 188 L98 214 L62 168 Z" fill="url(#stripe)" fill-opacity="0.94" stroke="#f5efe2" stroke-opacity="0.45" stroke-width="2.8"/>
  <path d="M162 92 C180 116 220 116 238 92" fill="none" stroke="#f5efe2" stroke-opacity="0.65" stroke-width="3"/>
  <text x="200" y="256" text-anchor="middle" fill="#ffffff" fill-opacity="0.96" font-family="Georgia, serif" font-size="112" font-weight="700">?</text>
  <text x="200" y="428" text-anchor="middle" fill="#f5efe2" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="2.4">WHO WEARS THIS KIT?</text>
  <text x="200" y="456" text-anchor="middle" fill="#98a79d" font-family="ui-monospace, monospace" font-size="13" font-weight="600" letter-spacing="1.6">DROP YOUR ANSWER IN CHAT</text>
</svg>`;
    const mUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(mSvg);
    fallbackCache.set(key, mUrl);
    return mUrl;
  }

  const nameYStart = nameLines.length > 1 ? 350 : 362;
  const nameMarkup = nameLines
    .map(
      (ln, idx) =>
        `<text x="200" y="${nameYStart + idx * 29}" text-anchor="middle" fill="#fff8e8" font-family="Georgia, serif" font-size="${nameLines.length > 1 ? 25 : 28}" font-weight="700" letter-spacing="-0.3">${escapeXml(ln)}</text>`
    )
    .join('');

  const clubY = nameLines.length > 1 ? 407 : 396;
  const insightBoxY = 422;
  const insightMarkup = insightLines
    .map(
      (ln, idx) =>
        `<text x="200" y="${insightBoxY + 21 + idx * 17}" text-anchor="middle" fill="#e5decb" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="500">${escapeXml(ln)}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14241e"/>
      <stop offset="55%" stop-color="#0a1310"/>
      <stop offset="100%" stop-color="#070d0a"/>
    </linearGradient>
    <linearGradient id="stripe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${escapeXml(c1)}"/>
      <stop offset="100%" stop-color="${escapeXml(c2)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="55%">
      <stop offset="0%" stop-color="${escapeXml(c1)}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${escapeXml(c1)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="500" rx="22" fill="url(#bg)"/>
  <rect width="400" height="500" rx="22" fill="url(#glow)"/>
  <rect x="12" y="12" width="376" height="476" rx="17" fill="none" stroke="#d9ab63" stroke-opacity="0.34" stroke-width="1.8"/>
  <path d="M0 0 H400 V9 H0 Z" fill="url(#stripe)"/>
  <rect x="26" y="24" width="98" height="26" rx="13" fill="#0b1310" fill-opacity="0.88" stroke="#d9ab63" stroke-opacity="0.5"/>
  <text x="75" y="42" text-anchor="middle" fill="#d9ab63" font-family="ui-monospace, monospace" font-size="13" font-weight="700" letter-spacing="1.6">${pid}</text>
  <text x="372" y="42" text-anchor="end" fill="#c7d4cc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" letter-spacing="1.8">${pos}</text>
  <!-- Stylized jersey icon -->
  <path d="M138 78 L170 64 C182 77 218 77 230 64 L262 78 L306 122 L278 158 L254 138 L254 256 C254 265 247 272 238 272 L162 272 C153 272 146 265 146 256 L146 138 L122 158 L94 122 Z" fill="url(#stripe)" fill-opacity="0.95" stroke="#f5efe2" stroke-opacity="0.45" stroke-width="2.4"/>
  <path d="M170 64 C183 83 217 83 230 64" fill="none" stroke="#f5efe2" stroke-opacity="0.6" stroke-width="2.8"/>
  <text x="200" y="192" text-anchor="middle" fill="#ffffff" fill-opacity="0.98" font-family="Georgia, serif" font-size="76" font-weight="700" letter-spacing="-2">${num}</text>
  <circle cx="200" cy="276" r="28" fill="#0b1310" stroke="#d9ab63" stroke-width="2.6"/>
  <text x="200" y="285" text-anchor="middle" fill="#f5efe2" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="1">${escapeXml(initials)}</text>
  ${nameMarkup}
  <text x="200" y="${clubY}" text-anchor="middle" fill="#7fb59a" font-family="ui-monospace, monospace" font-size="14" font-weight="700" letter-spacing="1.4">${clubNat}</text>
  <rect x="24" y="${insightBoxY}" width="352" height="54" rx="10" fill="#09110e" fill-opacity="0.78" stroke="#7fb59a" stroke-opacity="0.32" stroke-width="1"/>
  ${insightMarkup}
</svg>`;

  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  fallbackCache.set(key, url);
  return url;
}

export async function initLibrary(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [players, quizzes, images] = await Promise.all([
      idbGetAll<PlayerRecord>(STORE_PLAYERS),
      idbGetAll<PlayerQuizRecord>(STORE_QUIZZES),
      idbGetAll<{ player_id: string; mime: string; sha256: string; filename: string; size: number; updatedAt: number }>(
        STORE_IMAGES
      ),
    ]);

    customPlayersMap.clear();
    players.forEach((p) => {
      if (p && p.player_id) customPlayersMap.set(normalizePlayerId(p.player_id), p);
    });

    customQuizzesMap.clear();
    quizzes.forEach((q) => {
      if (q && q.quiz_id) customQuizzesMap.set(q.quiz_id, q);
    });

    imageMetaMap.clear();
    images.forEach((img) => {
      if (img && img.player_id) {
        imageMetaMap.set(normalizePlayerId(img.player_id), {
          player_id: normalizePlayerId(img.player_id),
          mime: img.mime,
          sha256: img.sha256,
          filename: img.filename,
          size: img.size,
          updatedAt: img.updatedAt,
        });
      }
    });

    initialized = true;
    notifyChange();
  })();

  return initPromise;
}

export function isDemoOnly(): boolean {
  return builtInStarterQuizzes.length === 0 && customQuizzesMap.size === 0;
}

export function getAllPlayers(): PlayerRecord[] {
  if (builtInStarterPlayers.length === 0 && customPlayersMap.size === 0) {
    return DEMO_PLAYERS.map((dp) => ({ ...dp, source: 'starter' as const }));
  }
  const merged = new Map<string, PlayerRecord>();
  builtInStarterPlayers.forEach((sp: StarterPlayer) => {
    merged.set(sp.player_id, { ...sp, source: 'starter' });
  });
  customPlayersMap.forEach((cp, id) => {
    const prev = merged.get(id);
    merged.set(id, { ...(prev || {}), ...cp, source: 'custom' });
  });
  return Array.from(merged.values());
}

export function getPlayerById(id: string): PlayerRecord | null {
  const norm = normalizePlayerId(id);
  const custom = customPlayersMap.get(norm);
  const starter = builtInStarterPlayers.find((p) => p.player_id === norm);
  if (custom && starter) return { ...starter, ...custom, source: 'custom' };
  if (custom) return custom;
  if (starter) return { ...starter, source: 'starter' };
  const demo = DEMO_PLAYERS.find((p) => p.player_id === norm);
  if (demo) return { ...demo, source: 'starter' };
  return null;
}

export function hasRealImage(playerId: string): boolean {
  return imageMetaMap.has(normalizePlayerId(playerId));
}

export function getAllQuizzes(modeFilter: 'all' | 'clues' | 'visual' = 'all'): PlayerQuizRecord[] {
  const merged = new Map<string, PlayerQuizRecord>();
  if (builtInStarterQuizzes.length === 0 && customQuizzesMap.size === 0) {
    DEMO_PLAYER_QUIZZES.forEach((dq) => {
      merged.set(dq.quiz_id, { ...dq, source: 'starter' });
    });
  } else {
    builtInStarterQuizzes.forEach((sq: StarterPlayerQuiz) => {
      merged.set(sq.quiz_id, { ...sq, source: 'starter' });
    });
    customQuizzesMap.forEach((cq, id) => {
      merged.set(id, cq);
    });
  }

  const all = Array.from(merged.values());
  if (modeFilter === 'clues') return all.filter((q) => q.mode === 'clues');
  if (modeFilter === 'visual') return all.filter((q) => q.mode !== 'clues');
  return all;
}

/* Build & pre-decode Player Card SVG visuals BEFORE Stage 4 reveal */
export async function preloadPlayerVisual(
  playerId: string,
  options?: { insight?: string }
): Promise<PreloadedVisual> {
  await initLibrary();
  const normId = normalizePlayerId(playerId);
  const player: PlayerRecord = getPlayerById(normId) || {
    player_id: normId,
    name: normId,
    club: 'Football',
    nationality: 'International',
    source: 'starter',
  };
  const fallbackUrl = renderFallbackCardDataUrl(player, { mystery: false, insight: options?.insight });
  const mysteryUrl = renderFallbackCardDataUrl(player, { mystery: true });

  return {
    player_id: normId,
    url: fallbackUrl,
    mysteryUrl,
    fallbackUrl,
    isRealPhoto: false,
    isObjectUrl: false,
    player,
  };
}

export function revokeVisual(_handle: PreloadedVisual | null | undefined): void {
  /* SVG data URLs do not allocate Blob Object URLs */
}

/* Parse & validate players array from players.json */
function parsePlayersManifest(data: unknown): {
  records: PlayerRecord[];
  duplicates: string[];
  errors: string[];
} {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).players)
      ? ((data as Record<string, unknown>).players as unknown[])
      : null;

  if (!arr) {
    return { records: [], duplicates: [], errors: ['Expected { "players": [...] } or a JSON array.'] };
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const errors: string[] = [];
  const records: PlayerRecord[] = [];
  const nowTs = Date.now();

  arr.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Player #${idx + 1}: not an object`);
      return;
    }
    const r = raw as Record<string, unknown>;
    const pid = normalizePlayerId(String(r.player_id || r.id || ''));
    const name = String(r.name || '').trim();
    if (!pid) {
      errors.push(`Player #${idx + 1}: missing player_id`);
      return;
    }
    if (!name) {
      errors.push(`${pid}: missing name`);
      return;
    }
    if (seen.has(pid)) {
      duplicates.push(pid);
      return;
    }
    seen.add(pid);
    records.push({
      player_id: pid,
      name,
      image: r.image ? String(r.image) : undefined,
      club: String(r.club || 'Club Unknown'),
      nationality: String(r.nationality || r.country || 'International'),
      position: r.position ? String(r.position) : undefined,
      number: r.number ? String(r.number) : undefined,
      era: r.era ? String(r.era) : undefined,
      source: 'custom',
      updatedAt: nowTs,
    });
  });

  return { records, duplicates, errors };
}

/* Parse & validate quizzes array from quizzes.json */
function parseQuizzesManifest(data: unknown): {
  records: PlayerQuizRecord[];
  errors: string[];
} {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).quizzes)
      ? ((data as Record<string, unknown>).quizzes as unknown[])
      : Array.isArray((data as Record<string, unknown>)?.questions)
        ? ((data as Record<string, unknown>).questions as unknown[])
        : null;

  if (!arr) {
    return { records: [], errors: ['Expected { "quizzes": [...] } or a JSON array.'] };
  }

  const errors: string[] = [];
  const records: PlayerQuizRecord[] = [];
  const validModes: PlayerQuizMode[] = ['clues', 'blur_reveal', 'zoom_crop', 'silhouette'];

  arr.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Quiz #${idx + 1}: not an object`);
      return;
    }
    const r = raw as Record<string, unknown>;
    const qid = String(r.quiz_id || r.id || `CQ_${Date.now()}_${idx + 1}`).trim();
    const answerId = normalizePlayerId(String(r.answer_player_id || r.player_id || ''));
    const cluesRaw = Array.isArray(r.clues) ? r.clues : [];
    const clues = cluesRaw.map((c) => String(c || '').trim()).filter(Boolean);

    if (!answerId) {
      errors.push(`Quiz ${qid}: missing answer_player_id`);
      return;
    }
    if (!clues.length) {
      errors.push(`Quiz ${qid}: needs at least 1 clue in "clues"`);
      return;
    }

    const rawMode = String(r.mode || 'clues').toLowerCase() as PlayerQuizMode;
    const mode: PlayerQuizMode = validModes.includes(rawMode) ? rawMode : 'clues';
    const player = getPlayerById(answerId);
    const revealText = String(r.reveal_text || player?.name || answerId).trim();

    records.push({
      quiz_id: qid,
      category: String(r.category || 'Football'),
      mode,
      question: String(r.question || 'Guess the player!').trim(),
      clues: clues.slice(0, 5),
      answer_player_id: answerId,
      reveal_text: revealText,
      insight: String(r.insight || r.note || '').trim(),
      difficulty: String(r.difficulty || 'Medium'),
      source: 'custom',
    });
  });

  return { records, errors };
}

export async function importPlayersJson(text: string): Promise<{ added: number; updated: number; duplicates: string[]; errors: string[] }> {
  await initLibrary();
  const parsed = JSON.parse(text);
  const { records, duplicates, errors } = parsePlayersManifest(parsed);
  if (!records.length) return { added: 0, updated: 0, duplicates, errors };

  let added = 0;
  let updated = 0;
  records.forEach((rec) => {
    if (customPlayersMap.has(rec.player_id)) updated++;
    else added++;
    customPlayersMap.set(rec.player_id, rec);
  });

  lastImportDuplicates = duplicates;
  await requestPersistentStorage();
  await idbPutBatch(STORE_PLAYERS, records);
  notifyChange();
  return { added, updated, duplicates, errors };
}

export async function importQuizzesJson(text: string): Promise<{ imported: number; errors: string[] }> {
  await initLibrary();
  const parsed = JSON.parse(text);
  const { records, errors } = parseQuizzesManifest(parsed);
  if (!records.length) return { imported: 0, errors };

  const seenFingerprints = new Set<string>();
  customQuizzesMap.forEach((existing) => {
    const fp = (existing.answer_player_id + '|' + existing.clues.join(' ').toLowerCase().replace(/[^a-z0-9]/g, ''));
    seenFingerprints.add(fp);
  });

  const uniqueRecords: PlayerQuizRecord[] = [];
  records.forEach((q) => {
    const fp = (q.answer_player_id + '|' + q.clues.join(' ').toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (seenFingerprints.has(fp)) {
      errors.push(`Skipped duplicate clue set for ${q.answer_player_id} (${q.quiz_id})`);
      return;
    }
    seenFingerprints.add(fp);
    uniqueRecords.push(q);
    customQuizzesMap.set(q.quiz_id, q);
  });

  if (!uniqueRecords.length) return { imported: 0, errors };
  await requestPersistentStorage();
  await idbPutBatch(STORE_QUIZZES, uniqueRecords);
  notifyChange();
  return { imported: uniqueRecords.length, errors };
}

export async function importPlayerZip(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ZipImportSummary> {
  await initLibrary();
  onProgress?.('Reading ZIP archive…');
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);

  const persisted = await requestPersistentStorage();
  let playersAdded = 0;
  let playersUpdated = 0;
  let quizzesImported = 0;
  const duplicatePlayerIds: string[] = [];
  const invalidFiles: string[] = [];

  const pathToPlayerId = new Map<string, string>();
  const playerRecordsToPut: PlayerRecord[] = [];
  const quizRecordsToPut: PlayerQuizRecord[] = [];

  onProgress?.('Parsing manifests…');
  for (const [entryPath, bytes] of Object.entries(entries)) {
    const clean = entryPath.replace(/\\/g, '/');
    const base = clean.split('/').pop() || '';
    if (!base || clean.includes('__MACOSX/') || base.startsWith('.')) continue;

    if (/\.json$/i.test(base)) {
      try {
        const json = JSON.parse(strFromU8(bytes));
        if (/quiz/i.test(base) || (json && !Array.isArray(json) && Array.isArray(json.quizzes))) {
          const parsedQ = parseQuizzesManifest(json);
          parsedQ.records.forEach((q) => {
            customQuizzesMap.set(q.quiz_id, q);
            quizRecordsToPut.push(q);
          });
          quizzesImported += parsedQ.records.length;
        } else {
          const parsedP = parsePlayersManifest(json);
          duplicatePlayerIds.push(...parsedP.duplicates);
          parsedP.records.forEach((p) => {
            if (customPlayersMap.has(p.player_id)) playersUpdated++;
            else playersAdded++;
            customPlayersMap.set(p.player_id, p);
            playerRecordsToPut.push(p);
            if (p.image) {
              const normPath = p.image.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
              pathToPlayerId.set(normPath, p.player_id);
              const imgBase = normPath.split('/').pop();
              if (imgBase) pathToPlayerId.set(imgBase, p.player_id);
            }
          });
        }
      } catch {
        invalidFiles.push(`${clean} (malformed JSON)`);
      }
    }
  }

  // Extract & validate images
  const imageRecordsToPut: Array<ImageMetaRecord & { blob: Blob }> = [];
  const imageEntries = Object.entries(entries).filter(([entryPath, bytes]) => {
    const clean = entryPath.replace(/\\/g, '/');
    const base = clean.split('/').pop() || '';
    if (!base || bytes.length === 0 || clean.includes('__MACOSX/') || base.startsWith('.')) return false;
    return /\.(webp|jpe?g|png)$/i.test(base);
  });

  for (let i = 0; i < imageEntries.length; i++) {
    const [entryPath, bytes] = imageEntries[i];
    const clean = entryPath.replace(/\\/g, '/').replace(/^\.\//, '');
    const base = clean.split('/').pop() || clean;
    if (i % 15 === 0) {
      onProgress?.(`Validating & hashing images (${i + 1}/${imageEntries.length})…`);
    }

    const mime = detectImageMime(bytes);
    if (!mime) {
      invalidFiles.push(`${clean} (invalid image signature)`);
      continue;
    }

    const stem = base.replace(/\.[^.]+$/, '');
    const mappedId =
      pathToPlayerId.get(clean.toLowerCase()) ||
      pathToPlayerId.get(base.toLowerCase()) ||
      normalizePlayerId(stem);

    if (!mappedId) {
      invalidFiles.push(`${clean} (could not resolve player_id)`);
      continue;
    }

    const sha256 = await computeSha256(bytes);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: mime });
    const meta: ImageMetaRecord = {
      player_id: mappedId,
      mime,
      sha256,
      filename: base,
      size: bytes.byteLength,
      updatedAt: Date.now(),
    };
    imageMetaMap.set(mappedId, meta);
    imageRecordsToPut.push({ ...meta, blob });
  }

  onProgress?.(`Saving ${imageRecordsToPut.length} images to device storage…`);
  await idbPutBatch(STORE_PLAYERS, playerRecordsToPut);
  await idbPutBatch(STORE_QUIZZES, quizRecordsToPut);
  await idbPutBatch(STORE_IMAGES, imageRecordsToPut, 15);

  lastImportDuplicates = duplicatePlayerIds;
  lastImportInvalidFiles = invalidFiles;

  const knownIds = new Set(getAllPlayers().map((p) => p.player_id));
  const unmatchedImages = imageRecordsToPut
    .map((r) => r.player_id)
    .filter((pid) => !knownIds.has(pid));

  notifyChange();
  return {
    playersAdded,
    playersUpdated,
    imagesStored: imageRecordsToPut.length,
    quizzesImported,
    duplicatePlayerIds,
    invalidFiles,
    unmatchedImages,
    persisted,
  };
}

export async function replacePlayerImage(playerId: string, file: File): Promise<{ ok: boolean; error?: string }> {
  await initLibrary();
  const normId = normalizePlayerId(playerId);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageMime(bytes);
  if (!mime) {
    return { ok: false, error: 'Unsupported or corrupted image file. Use WebP, JPEG, or PNG.' };
  }

  await requestPersistentStorage();
  const sha256 = await computeSha256(bytes);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime });
  const meta: ImageMetaRecord = {
    player_id: normId,
    mime,
    sha256,
    filename: file.name,
    size: bytes.byteLength,
    updatedAt: Date.now(),
  };

  imageMetaMap.set(normId, meta);
  await idbPutBatch(STORE_IMAGES, [{ ...meta, blob }], 1);
  notifyChange();
  return { ok: true };
}

export async function getPlayerThumbnailUrl(playerId: string): Promise<string | null> {
  await initLibrary();
  const normId = normalizePlayerId(playerId);
  const rec = await idbGetOne<{ blob: Blob }>(STORE_IMAGES, normId);
  if (!rec || !rec.blob) return null;
  return URL.createObjectURL(rec.blob);
}

export async function exportLibraryZip(): Promise<{ blob: Blob; filename: string; imageCount: number }> {
  await initLibrary();
  const players = getAllPlayers();
  const customQuizzes = Array.from(customQuizzesMap.values());
  const images = await idbGetAll<ImageMetaRecord & { blob: Blob }>(STORE_IMAGES);

  const files: Record<string, Uint8Array> = {};
  const manifestPlayers = players.map((p) => {
    const img = imageMetaMap.get(p.player_id);
    const ext = img?.mime === 'image/png' ? 'png' : img?.mime === 'image/jpeg' ? 'jpg' : 'webp';
    return {
      player_id: p.player_id,
      name: p.name,
      club: p.club,
      nationality: p.nationality,
      position: p.position,
      number: p.number,
      era: p.era,
      image: img ? `images/${p.player_id}.${ext}` : undefined,
    };
  });

  files['players.json'] = strToU8(JSON.stringify({ players: manifestPlayers }, null, 2));
  if (customQuizzes.length) {
    files['quizzes.json'] = strToU8(JSON.stringify({ quizzes: customQuizzes }, null, 2));
  }

  for (const img of images) {
    if (!img || !img.blob) continue;
    const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/jpeg' ? 'jpg' : 'webp';
    const arr = new Uint8Array(await img.blob.arrayBuffer());
    files[`images/${img.player_id}.${ext}`] = arr;
  }

  const zipped = zipSync(files, { level: 0 });
  const zipCopy = new Uint8Array(zipped.byteLength);
  zipCopy.set(zipped);
  const outBlob = new Blob([zipCopy.buffer], { type: 'application/zip' });
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    blob: outBlob,
    filename: `lnr-player-library-backup-${stamp}.zip`,
    imageCount: images.length,
  };
}

export async function clearCustomLibrary(): Promise<void> {
  await initLibrary();
  await Promise.all([
    idbClearStore(STORE_PLAYERS),
    idbClearStore(STORE_IMAGES),
    idbClearStore(STORE_QUIZZES),
  ]);
  customPlayersMap.clear();
  customQuizzesMap.clear();
  imageMetaMap.clear();
  lastImportDuplicates = [];
  lastImportInvalidFiles = [];
  notifyChange();
}

export async function runAudit(): Promise<LibraryAuditReport> {
  await initLibrary();
  const players = getAllPlayers();
  const quizzes = getAllQuizzes('all');
  const playerIds = new Set(players.map((p) => p.player_id));

  const missingImages = players
    .filter((p) => !imageMetaMap.has(p.player_id))
    .map((p) => ({
      player_id: p.player_id,
      name: p.name,
      club: p.club,
      source: p.source,
    }));

  const unmatchedImages: string[] = [];
  const byHash = new Map<string, string[]>();

  imageMetaMap.forEach((meta, pid) => {
    if (!playerIds.has(pid)) unmatchedImages.push(pid);
    if (meta.sha256) {
      const list = byHash.get(meta.sha256) || [];
      list.push(pid);
      byHash.set(meta.sha256, list);
    }
  });

  const duplicateImageHashes: Array<{ sha256: string; playerIds: string[] }> = [];
  byHash.forEach((pids, sha256) => {
    if (pids.length > 1) duplicateImageHashes.push({ sha256, playerIds: pids });
  });

  const est = await getStorageEstimate();

  return {
    totalPlayers: players.length,
    starterPlayers: builtInStarterPlayers.length,
    customPlayers: customPlayersMap.size,
    totalQuizzes: quizzes.length,
    customQuizzes: customQuizzesMap.size,
    imagesCount: imageMetaMap.size,
    missingImages,
    unmatchedImages,
    duplicatePlayerIds: [...lastImportDuplicates],
    invalidFiles: [...lastImportInvalidFiles],
    duplicateImageHashes,
    storageUsageBytes: est.usage,
    storageQuotaBytes: est.quota,
    persisted: est.persisted,
  };
}

export function onLibraryChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

// Publish on window for engine.js
(window as unknown as Record<string, unknown>).LNR_PLAYERS = {
  initLibrary,
  isDemoOnly,
  setStarterData,
  setAdminStarterData,
  clearAdminStarterData,
  getAllPlayers,
  getPlayerById,
  getPlayerColors,
  hasRealImage,
  getAllQuizzes,
  preloadPlayerVisual,
  revokeVisual,
  renderFallbackCardDataUrl,
  importPlayerZip,
  importPlayersJson,
  importQuizzesJson,
  replacePlayerImage,
  getPlayerThumbnailUrl,
  exportLibraryZip,
  clearCustomLibrary,
  runAudit,
  onLibraryChange,
};
