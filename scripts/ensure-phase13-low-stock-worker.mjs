import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const moduleFile = path.join(workerDir, 'src/legacy/mobile-low-stock.ts');
const moduleTemplate = path.join(scriptDir, '../worker-patches/phase13-mobile-low-stock.ts.txt');
const testFile = path.join(workerDir, 'tests/mobile-low-stock.test.ts');
const testTemplate = path.join(scriptDir, '../worker-patches/phase13-mobile-low-stock.test.ts.txt');
const routeFile = path.join(workerDir, 'src/legacy/index.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');

let moduleSource = '';
try { moduleSource = await readFile(moduleFile, 'utf8'); } catch { /* created below */ }
if (!moduleSource.includes('getMobileLowStock') || !moduleSource.includes("'nav-dashboard'") || !moduleSource.includes("'nav-ingredients'") || !moduleSource.includes("'nav-purchase-orders'")) {
  await writeFile(moduleFile, await readFile(moduleTemplate, 'utf8'));
}
// Always refresh the generated regression test. Earlier Phase 13 archives used
// Vitest, while the KCP Worker deliberately runs its suite through node:test.
await writeFile(testFile, await readFile(testTemplate, 'utf8'));

let routes = await readFile(routeFile, 'utf8');
if (!routes.includes('from "./mobile-low-stock"')) {
  const anchor = 'import {';
  const position = routes.indexOf(anchor);
  if (position < 0) throw new Error(`Could not find an import insertion point in ${routeFile}.`);
  routes = `${routes.slice(0, position)}import { getMobileLowStock } from "./mobile-low-stock";\n${routes.slice(position)}`;
}
if (!routes.includes('resource === "mobile/low-stock"')) {
  const anchor = '  if (request.method === "GET" && resource === "dashboard-source") {';
  const block = `  // Phase 13 — permissioned, location-scoped stock intelligence.\n  if (request.method === "GET" && resource === "mobile/low-stock") {\n    return getMobileLowStock(request, env, auth, workspaceId);\n  }\n\n`;
  if (!routes.includes(anchor)) throw new Error(`Could not find the Phase 13 route insertion point in ${routeFile}.`);
  routes = routes.replace(anchor, `${block}${anchor}`);
}
await writeFile(routeFile, routes);

const packageFile = path.join(workerDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
if (typeof packageJson.scripts?.['test:mobile'] === 'string' && !packageJson.scripts['test:mobile'].includes('tests/mobile-low-stock.test.ts')) {
  packageJson.scripts['test:mobile'] += ' tests/mobile-low-stock.test.ts';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let dispatcher = await readFile(dispatcherFile, 'utf8');
if (!dispatcher.includes('low-stock(?:\\/.*)?')) {
  const currentPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?|receiving(?:\\/.*)?|purchase-orders(?:\\/.*)?)';
  const nextPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?|receiving(?:\\/.*)?|purchase-orders(?:\\/.*)?|low-stock(?:\\/.*)?)';
  if (!dispatcher.includes(currentPattern)) throw new Error(`Could not find the mobile operations dispatcher in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(currentPattern, nextPattern);
}
await writeFile(dispatcherFile, dispatcher);

const [finalModule, finalTest, finalRoutes, finalDispatcher] = await Promise.all([readFile(moduleFile, 'utf8'), readFile(testFile, 'utf8'), readFile(routeFile, 'utf8'), readFile(dispatcherFile, 'utf8')]);
if (!finalModule.includes('getMobileLowStock') || !finalTest.includes("from 'node:test'") || finalTest.includes("from 'vitest'") || !finalRoutes.includes('getMobileLowStock(') || !finalDispatcher.includes('low-stock(?:\\/.*)?')) throw new Error('Phase 13 Worker extension verification failed.');
console.log('Phase 13 mobile low-stock intelligence route is ready.');
