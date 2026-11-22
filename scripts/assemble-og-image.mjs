#!/usr/bin/env node
/**
 * Rebuilds public/og-image.png (1200x630 social card) from the base64 parts
 * in og-image/source/.
 *
 * Why parts: the finished PNG is ~18 KB of binary, and the GitHub contents API
 * available to the maintainers only accepts text in one call, so the artwork is
 * stored split into fixed-size base64 chunks. Concatenating them reproduces the
 * exact bytes of the original PNG.
 *
 * Runs automatically before every build ("prebuild" in package.json), so
 * `npm run build` (and Vercel) always ship the image at /og-image.png.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'og-image', 'source');

const parts = readdirSync(sourceDir)
  .filter((name) => name.endsWith('.b64'))
  .sort();

if (parts.length === 0) {
  throw new Error('assemble-og-image: no base64 parts found in og-image/source');
}

const base64 = parts
  .map((name) => readFileSync(join(sourceDir, name), 'utf8').replace(/\s+/g, ''))
  .join('');

const png = Buffer.from(base64, 'base64');

if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) {
  throw new Error('assemble-og-image: assembled file is not a PNG');
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 1200 || height !== 630) {
  throw new Error(`assemble-og-image: expected 1200x630, got ${width}x${height}`);
}

writeFileSync(join(root, 'public', 'og-image.png'), png);
console.log(`og-image.png written: ${png.length} bytes, ${width}x${height}, from ${parts.length} parts`);
