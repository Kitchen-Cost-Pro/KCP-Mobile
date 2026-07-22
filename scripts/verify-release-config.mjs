import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => readFile(path.join(root, file), 'utf8');
const required = [
  ['package.json', '"version": "0.20.0"'],
  ['android/app/build.gradle', 'versionName "0.20.0"'],
  ['android/app/src/main/AndroidManifest.xml', 'android:scheme="kcplite"'],
  ['android/app/src/main/AndroidManifest.xml', 'android.permission.POST_NOTIFICATIONS'],
  ['ios/App/App/Info.plist', '<string>kcplite</string>'],
  ['ios/App/App/App.entitlements', '<key>aps-environment</key>'],
  ['src/core/monitoring/monitoring.ts', 'sendDefaultPii: false'],
  ['scripts/deploy-current-worker.sh', 'ensure-phase16-notifications-worker.mjs'],
  ['src/features/flow/actionModel.ts', "'upcoming', 'ready', 'in_progress', 'waiting', 'completed', 'deferred', 'cancelled'"],
  ['worker-patches/phase14-operational-tasks.ts.txt', 'CREATE TABLE IF NOT EXISTS action_idempotency'],
  ['scripts/ensure-phase14-tasks-worker.mjs', 'resource === "mobile/actions"'],
  ['scripts/ensure-phase18-role-sets-worker.mjs', 'resource === "mobile/role-sets/current"'],
  ['worker-patches/phase18-role-sets.ts.txt', 'CREATE TABLE IF NOT EXISTS role_sets']
  ,['scripts/ensure-phase20-action-sources-worker.mjs', 'mobile/action-source-events']
  ,['worker-patches/phase20-action-sources.ts.txt', 'CREATE TABLE IF NOT EXISTS action_source_events']
];
for (const [file, marker] of required) {
  const source = await read(file);
  if (!source.includes(marker)) throw new Error(`${file} is missing release marker: ${marker}`);
}
await access(path.join(root, 'docs/PRODUCTION_RELEASE.md'));
await access(path.join(root, 'docs/PHASE_17_ACCEPTANCE.md'));
await access(path.join(root, 'docs/PHASE_18_ACCEPTANCE.md'));
await access(path.join(root, 'docs/GROUP_2_ACCEPTANCE.md'));
for (const file of ['worker-patches/phase14-operational-tasks.ts.txt', 'worker-patches/phase15-approval-engine.ts.txt', 'worker-patches/phase16-notifications.ts.txt', 'worker-patches/phase18-role-sets.ts.txt', 'worker-patches/phase20-action-sources.ts.txt']) {
  const source = await read(file);
  if (/\.(?:DB|CENTRAL_DB)\.exec\(/.test(source)) throw new Error(`${file} bypasses the Worker's DbLike prepared-statement interface.`);
}
for (const file of ['worker-patches/phase13-mobile-low-stock.test.ts.txt', 'worker-patches/phase14-operational-tasks.test.ts.txt', 'worker-patches/phase15-approval-engine.test.ts.txt', 'worker-patches/phase16-notifications.test.ts.txt', 'worker-patches/phase18-role-sets.test.ts.txt', 'worker-patches/phase20-action-sources.test.ts.txt']) {
  const source = await read(file);
  if (source.includes("from 'vitest'") || source.includes('from "vitest"')) throw new Error(`${file} must use the Worker's node:test runner.`);
  if (!source.includes("from 'node:test'")) throw new Error(`${file} is not configured for the Worker's node:test runner.`);
}
const lowStockInstaller = await read('scripts/ensure-phase13-low-stock-worker.mjs');
if (!lowStockInstaller.includes('await writeFile(testFile, await readFile(testTemplate') || lowStockInstaller.includes('if (!testSource.includes')) {
  throw new Error('The Phase 13 installer must overwrite stale generated tests on every deployment.');
}
const packageJson = JSON.parse(await read('package.json'));
const lockJson = JSON.parse(await read('package-lock.json'));
for (const [name, version] of [['@sentry/capacitor', '4.2.0'], ['@sentry/react', '10.60.0']]) {
  if (packageJson.dependencies?.[name] !== version || lockJson.packages?.['']?.dependencies?.[name] !== version) {
    throw new Error(`${name} must be pinned exactly to ${version} in package.json and package-lock.json.`);
  }
}
console.log('KCP Lite 0.20 release configuration is internally consistent.');
