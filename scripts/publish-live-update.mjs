#!/usr/bin/env node
// Packages the built web app (dist/) as a KCP Lite live-update bundle, writes the channel manifest and
// deploys both as an assets-only Cloudflare Worker. Static asset requests are free and unlimited on
// every Workers plan and no Worker script runs, so serving updates has no metered usage.
//
//   npm run build
//   npm run ota:publish -- --channel staging --version 0.22.1 --rollout 10
//   npm run ota:publish -- --channel production --version 0.22.1 --deploy
//   npm run ota:publish -- --channel production --reset --deploy   (kill switch)
//
// Without --deploy, the site is written to ota-out/site and the deploy command is printed.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = parseArgs(process.argv.slice(2));
const channel = String(args.channel || 'production');
const channels = [...new Set([channel, ...String(args.channels || 'production,staging').split(',').map((name) => name.trim()).filter(Boolean)])];
const baseUrl = String(args['base-url'] || process.env.KCP_OTA_BASE_URL || '').replace(/\/+$/, '');
const workerName = String(args.worker || process.env.KCP_OTA_WORKER || 'kcp-lite-updates');
const domain = args.domain ? String(args.domain) : '';
const outDir = path.join(root, 'ota-out');
const siteDir = path.join(outDir, 'site');

for (const name of channels) if (!/^[a-z0-9-]+$/i.test(name)) fail(`Invalid channel "${name}".`);
if (!/^https:\/\//i.test(baseUrl)) fail('Set --base-url or KCP_OTA_BASE_URL to the HTTPS address of the update Worker (same value as VITE_KCP_OTA_BASE_URL).');
if (!/^[a-z0-9-]+$/.test(workerName)) fail(`Invalid Worker name "${workerName}".`);

// A deploy replaces every asset, so first carry over what is live now: each channel's manifest
// and the bundles they point at, so devices mid-download or on another channel are not broken.
await rm(siteDir, { recursive: true, force: true });
await mkdir(path.join(siteDir, 'bundles'), { recursive: true });
const keepBundles = new Set();
for (const name of channels) {
  const live = await fetchJson(`${baseUrl}/${name}/manifest.json`);
  if (!live) continue;
  if (name !== channel) await writeManifest(name, live);
  if (typeof live.url === 'string' && live.url.startsWith(`${baseUrl}/bundles/`)) {
    const key = live.url.slice(baseUrl.length + 1);
    if (/^bundles\/[\w.+-]+\.zip$/.test(key) && await carryOverBundle(key, live.sha256)) keepBundles.add(key);
  }
}

let manifest;
if (args.reset) {
  manifest = { resetToBuiltin: true, releasedAt: new Date().toISOString(), notes: String(args.notes || 'Kill switch: return to store bundle') };
} else {
  const distDir = path.join(root, 'dist');
  if (!existsSync(path.join(distDir, 'index.html'))) fail('dist/index.html is missing. Run `npm run build` first.');
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = String(args.version || packageJson.version);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) fail(`Invalid version "${version}".`);
  const minNativeBuild = Number(args['min-native-build'] ?? await currentNativeBuild());
  if (!Number.isInteger(minNativeBuild) || minNativeBuild < 0) fail('Invalid --min-native-build.');
  const rollout = Number(args.rollout ?? 100);
  if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) fail('--rollout must be between 0 and 100.');

  const files = (await listFiles(distDir)).filter((file) => !file.endsWith('.map'));
  const zip = createZip(await Promise.all(files.map(async (file) => ({ name: file, data: await readFile(path.join(distDir, file)) }))));
  if (zip.length > 25 * 1024 * 1024) fail('Bundle is larger than the 25 MiB Workers static asset limit.');
  const sha256 = createHash('sha256').update(zip).digest('hex');
  const bundleKey = `bundles/${version}-${sha256.slice(0, 12)}.zip`;
  await writeFile(path.join(siteDir, bundleKey), zip);
  keepBundles.add(bundleKey);
  manifest = { version, url: `${baseUrl}/${bundleKey}`, sha256, minNativeBuild, rollout, releasedAt: new Date().toISOString() };
  if (args['max-native-build'] !== undefined) manifest.maxNativeBuild = Number(args['max-native-build']);
  if (args.notes) manifest.notes = String(args.notes);
  console.log(`Bundle ${version}: ${files.length} files, ${(zip.length / 1024).toFixed(0)} KB, sha256 ${sha256}`);
}
await writeManifest(channel, manifest);
console.log(`Manifest for "${channel}":\n${JSON.stringify(manifest, null, 2)}`);

const manifestHeaders = channels.map((name) => `/${name}/manifest.json\n  Cache-Control: no-store\n  Content-Type: application/json`);
await writeFile(path.join(siteDir, '_headers'), `${manifestHeaders.join('\n')}\n/bundles/*\n  Cache-Control: public, max-age=31536000, immutable\n  Content-Type: application/zip\n`);
const wranglerConfig = {
  name: workerName,
  compatibility_date: '2026-10-01',
  assets: { directory: './site', not_found_handling: 'none' },
  workers_dev: !domain,
  ...(domain ? { routes: [{ pattern: domain, custom_domain: true }] } : {})
};
await writeFile(path.join(outDir, 'wrangler.jsonc'), `${JSON.stringify(wranglerConfig, null, 2)}\n`);
console.log(`Site written to ota-out/site (${keepBundles.size} bundle(s) kept).`);

const deployArgs = ['wrangler', 'deploy', '--config', path.join(outDir, 'wrangler.jsonc')];
if (args.deploy) {
  execFileSync('npx', deployArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  console.log(`Published to channel "${channel}".`);
} else {
  console.log(`\nNot deployed. To publish, run:\n  npx ${deployArgs.join(' ')}`);
}

async function writeManifest(name, value) {
  await mkdir(path.join(siteDir, name), { recursive: true });
  await writeFile(path.join(siteDir, name, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function carryOverBundle(key, expectedSha256) {
  try {
    const response = await fetch(`${baseUrl}/${key}`);
    if (!response.ok) return false;
    const data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== expectedSha256) return false;
    await writeFile(path.join(siteDir, key), data);
    return true;
  } catch {
    return false;
  }
}

async function currentNativeBuild() {
  const gradle = await readFile(path.join(root, 'android/app/build.gradle'), 'utf8');
  const android = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
  const pbxproj = await readFile(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const ios = Number(/CURRENT_PROJECT_VERSION = (\d+);/.exec(pbxproj)?.[1]);
  if (!Number.isInteger(android)) fail('Could not read versionCode from android/app/build.gradle.');
  if (Number.isInteger(ios) && ios !== android) console.warn(`Warning: Android versionCode ${android} and iOS build ${ios} differ; using the higher value.`);
  return Math.max(android, Number.isInteger(ios) ? ios : 0);
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

// Minimal deflate ZIP writer (no external dependency); timestamps are fixed so identical builds hash identically.
function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    locals.push(header, nameBuffer, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += header.length + nameBuffer.length + compressed.length;
  }
  const centralSize = centrals.reduce((size, buffer) => size + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const match = /^--([a-z-]+)$/.exec(argv[index]);
    if (!match) fail(`Unexpected argument "${argv[index]}".`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) parsed[match[1]] = true;
    else { parsed[match[1]] = next; index += 1; }
  }
  return parsed;
}

function fail(message) {
  console.error(`publish-live-update: ${message}`);
  process.exit(1);
}
