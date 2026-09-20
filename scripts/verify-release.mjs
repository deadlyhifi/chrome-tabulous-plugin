import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = join(ROOT, 'dist.zip');
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024;

function fail(message) {
  throw new Error(`Release check failed: ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertPng(path, width, height) {
  if (!existsSync(path)) fail(`missing ${path.replace(`${ROOT}/`, '')}`);
  const image = readFileSync(path);
  if (image.toString('ascii', 1, 4) !== 'PNG') fail(`${path} is not a PNG`);
  const actualWidth = image.readUInt32BE(16);
  const actualHeight = image.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    fail(`${path} is ${actualWidth}x${actualHeight}; expected ${width}x${height}`);
  }
}

const packageJson = readJson(join(ROOT, 'package.json'));
const sourceManifest = readJson(join(ROOT, 'manifest.json'));
const builtManifest = readJson(join(ROOT, 'dist', 'manifest.json'));

if (!/^\d+(?:\.\d+){0,3}$/.test(sourceManifest.version)) {
  fail(`manifest version ${sourceManifest.version} is not valid for Chrome`);
}
if (packageJson.version !== sourceManifest.version || builtManifest.version !== sourceManifest.version) {
  fail('package.json, manifest.json, and dist/manifest.json versions do not match');
}
if (sourceManifest.description.length > 132) fail('manifest description exceeds 132 characters');
if (!existsSync(join(ROOT, 'PRIVACY.md'))) fail('PRIVACY.md is missing');
if (!existsSync(join(ROOT, 'docs', 'chrome-web-store-listing.md'))) {
  fail('Chrome Web Store submission sheet is missing');
}
if (!existsSync(ZIP)) fail('dist.zip is missing');
if (statSync(ZIP).size > MAX_ZIP_BYTES) fail('dist.zip exceeds the Chrome Web Store 2 GB limit');

const entries = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
if (!entries.includes('manifest.json')) fail('manifest.json is not at the ZIP root');
if (entries.some((entry) => entry.startsWith('dist/'))) fail('ZIP contains an enclosing dist folder');
if (entries.some((entry) => /^(docs|images|node_modules)\//.test(entry))) {
  fail('ZIP contains repository-only folders');
}
if (entries.some((entry) => entry.endsWith('.map') || entry.endsWith('.ts'))) {
  fail('ZIP contains source maps or TypeScript source');
}
for (const icon of Object.values(sourceManifest.icons ?? {})) {
  if (!entries.includes(icon)) fail(`ZIP is missing manifest icon ${icon}`);
}

for (const name of ['01-overview.png', '02-dark-groups.png', '03-tab-details.png']) {
  assertPng(join(ROOT, 'images', 'store', name), 1280, 800);
}
assertPng(join(ROOT, 'images', 'store', 'store-icon.png'), 128, 128);
assertPng(join(ROOT, 'images', 'store', 'promo-small.png'), 440, 280);
assertPng(join(ROOT, 'images', 'store', 'promo-marquee.png'), 1400, 560);

console.log(`Release ${sourceManifest.version} verified: dist.zip and 6 store images are ready.`);
