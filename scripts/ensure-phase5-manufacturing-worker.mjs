import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const moduleFile = path.join(workerDir, 'src/legacy/mobile-manufacturing.ts');
const moduleTemplate = path.join(scriptDir, '../worker-patches/phase5-mobile-manufacturing.ts.txt');
const testFile = path.join(workerDir, 'tests/mobile-manufacturing.test.ts');
const testTemplate = path.join(scriptDir, '../worker-patches/phase5-mobile-manufacturing.test.ts.txt');
const routeFile = path.join(workerDir, 'src/legacy/index.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');

let moduleSource = '';
try { moduleSource = await readFile(moduleFile, 'utf8'); } catch { /* created below */ }
if (!moduleSource.includes('postMobileManufacturingRun') || !moduleSource.includes('validatedRunEntries')) {
  await writeFile(moduleFile, await readFile(moduleTemplate, 'utf8'));
}
moduleSource = await readFile(moduleFile, 'utf8');
moduleSource = moduleSource
  .replace('function aggregateComponentPreviews(products: Row[]) {', 'function aggregateComponentPreviews(products: Row[]): Row[] {')
  .replace('return [...aggregate.values()].map((component) => ({', 'return [...aggregate.values()].map((component): Row => ({')
  .replace('  const products = [];\n  for (const entry of entries) products.push(', '  const products: Row[] = [];\n  for (const entry of entries) products.push(');
await writeFile(moduleFile, moduleSource);

let testSource = '';
try { testSource = await readFile(testFile, 'utf8'); } catch { /* created below */ }
if (!testSource.includes('derives expected yield') || !testSource.includes('aggregates shared components') || !testSource.includes('validatedRunEntries')) await writeFile(testFile, await readFile(testTemplate, 'utf8'));

let routes = await readFile(routeFile, 'utf8');
if (!routes.includes('from "./mobile-manufacturing"')) {
  const anchor = '} from "./mobile-transfers";';
  const position = routes.indexOf(anchor);
  if (position < 0) throw new Error(`Could not find the mobile transfer import in ${routeFile}.`);
  const end = position + anchor.length;
  const imports = `\nimport {\n  getMobileManufacturingBootstrap,\n  getMobileManufacturingItems,\n  getMobileManufacturingBarcode,\n  postMobileManufacturingPreview,\n  postMobileManufacturingBatch,\n} from "./mobile-manufacturing";`;
  routes = `${routes.slice(0, end)}${imports}${routes.slice(end)}`;
}
if (!routes.includes('getMobileManufacturingCatalog,')) {
  routes = routes.replace('  getMobileManufacturingBootstrap,\n', '  getMobileManufacturingBootstrap,\n  getMobileManufacturingCatalog,\n');
  routes = routes.replace('  postMobileManufacturingBatch,\n} from "./mobile-manufacturing";', '  postMobileManufacturingBatch,\n  postMobileManufacturingRunPreview,\n  postMobileManufacturingRun,\n} from "./mobile-manufacturing";');
}
if (!routes.includes('resource === "mobile/manufacturing/bootstrap"')) {
  const anchor = '  if (request.method === "GET" && resource === "dashboard-source") {';
  if (!routes.includes(anchor)) throw new Error(`Could not find the mobile manufacturing route insertion point in ${routeFile}.`);
  const block = `  // Mobile manufacturing — server preview plus the existing atomic manufacturing ledger engine.\n  if (request.method === "GET" && resource === "mobile/manufacturing/bootstrap") {\n    return getMobileManufacturingBootstrap(request, env, auth, workspaceId);\n  }\n  if (request.method === "GET" && resource === "mobile/manufacturing/items") {\n    return getMobileManufacturingItems(request, env, auth, workspaceId);\n  }\n  {\n    const mfgBarcode = routePattern(resource, /^mobile\\/manufacturing\\/barcodes\\/(.+)$/);\n    if (mfgBarcode && request.method === "GET") return getMobileManufacturingBarcode(request, env, auth, workspaceId, mfgBarcode[1]);\n  }\n  if (request.method === "POST" && resource === "mobile/manufacturing/preview") {\n    return postMobileManufacturingPreview(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/manufacturing/batches") {\n    return postMobileManufacturingBatch(request, env, auth, workspaceId);\n  }\n\n`;
  routes = routes.replace(anchor, `${block}${anchor}`);
}
if (!routes.includes('resource === "mobile/manufacturing/catalog"')) {
  const anchor = '  if (request.method === "GET" && resource === "mobile/manufacturing/items") {';
  const block = `  if (request.method === "GET" && resource === "mobile/manufacturing/catalog") {\n    return getMobileManufacturingCatalog(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/manufacturing/runs/preview") {\n    return postMobileManufacturingRunPreview(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/manufacturing/runs/commit") {\n    return postMobileManufacturingRun(request, env, auth, workspaceId);\n  }\n`;
  if (!routes.includes(anchor)) throw new Error(`Could not find the Phase 7 manufacturing insertion point in ${routeFile}.`);
  routes = routes.replace(anchor, `${block}${anchor}`);
}
await writeFile(routeFile, routes);

const packageFile = path.join(workerDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
if (typeof packageJson.scripts?.['test:mobile'] === 'string' && !packageJson.scripts['test:mobile'].includes('tests/mobile-manufacturing.test.ts')) {
  packageJson.scripts['test:mobile'] += ' tests/mobile-manufacturing.test.ts';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let dispatcher = await readFile(dispatcherFile, 'utf8');
if (dispatcher.includes('manufacturing: false')) {
  dispatcher = dispatcher.replace(
    /\s*\/\/ Not yet built for mobile\.\n\s*manufacturing: false,/,
    '\n        manufacturing: true, // Phase 13'
  );
}
if (!dispatcher.includes('manufacturing(?:\\/.*)?')) {
  const oldPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?)';
  const nextPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?)';
  if (!dispatcher.includes(oldPattern)) throw new Error(`Could not find the mobile operations dispatcher in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(oldPattern, nextPattern);
  dispatcher = dispatcher.replace('barcode lookup (Phase 10), wastage (Phase 11), transfers (Phase 12)', 'barcode lookup (Phase 10), wastage (Phase 11), transfers (Phase 12), manufacturing (Phase 13)');
  dispatcher = dispatcher.replace('barcode/wastage/transfer services', 'barcode/wastage/transfer/manufacturing services');
}
await writeFile(dispatcherFile, dispatcher);

const [finalModule, finalRoutes, finalDispatcher] = await Promise.all([readFile(moduleFile, 'utf8'), readFile(routeFile, 'utf8'), readFile(dispatcherFile, 'utf8')]);
if (!finalModule.includes('postMobileManufacturingRun') || !finalModule.includes('validatedRunEntries') || !finalRoutes.includes('postMobileManufacturingRunPreview(') || !finalDispatcher.includes('manufacturing(?:\\/.*)?') || !finalDispatcher.includes('manufacturing: true')) {
  throw new Error('Phase 7 Worker extension verification failed.');
}
console.log('Phase 7 mobile manufacturing Worker extension is ready.');
