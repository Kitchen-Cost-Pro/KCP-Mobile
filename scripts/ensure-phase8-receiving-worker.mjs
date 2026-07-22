import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const moduleFile = path.join(workerDir, 'src/legacy/mobile-receiving.ts');
const moduleTemplate = path.join(scriptDir, '../worker-patches/phase8-mobile-receiving.ts.txt');
const testFile = path.join(workerDir, 'tests/mobile-receiving.test.ts');
const testTemplate = path.join(scriptDir, '../worker-patches/phase8-mobile-receiving.test.ts.txt');
const routeFile = path.join(workerDir, 'src/legacy/index.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');

let moduleSource = '';
try { moduleSource = await readFile(moduleFile, 'utf8'); } catch { /* created below */ }
if (!moduleSource.includes('postMobileReceivingCommit') || !moduleSource.includes('mobilePayloadFingerprint')) {
  await writeFile(moduleFile, await readFile(moduleTemplate, 'utf8'));
}
moduleSource = await readFile(moduleFile, 'utf8');
moduleSource = moduleSource
  .replace('const byId = new Map(order.lines.map((line: Row) => [text(line.id), line]));', 'const byId = new Map<string, Row>(order.lines.map((line: Row) => [text(line.id), line]));')
  .replace('const selected = entries.map((entry) => {', 'const selected: Row[] = entries.map((entry): Row => {')
  .replace(
    '  return round3(Math.max(num(line.remainingQty, ordered - received), 0));',
    "  const explicit = line.remainingQty;\n  const remaining = explicit === undefined || explicit === null || text(explicit) === '' ? ordered - received : num(explicit, ordered - received);\n  return round3(Math.max(remaining, 0));"
  );
await writeFile(moduleFile, moduleSource);

let testSource = '';
try { testSource = await readFile(testFile, 'utf8'); } catch { /* created below */ }
if (!testSource.includes('normalizes positive receipt lines')) await writeFile(testFile, await readFile(testTemplate, 'utf8'));

let routes = await readFile(routeFile, 'utf8');
if (!routes.includes('from "./mobile-receiving"')) {
  const anchor = '} from "./mobile-manufacturing";';
  const position = routes.indexOf(anchor);
  if (position < 0) throw new Error(`Could not find the mobile Manufacturing import in ${routeFile}.`);
  const end = position + anchor.length;
  const imports = `\nimport {\n  getMobileReceivingBootstrap,\n  getMobileReceivingOrder,\n  getMobileReceivingBarcode,\n  postMobileReceivingPreview,\n  postMobileReceivingCommit,\n} from "./mobile-receiving";`;
  routes = `${routes.slice(0, end)}${imports}${routes.slice(end)}`;
}
if (!routes.includes('resource === "mobile/receiving/bootstrap"')) {
  const anchor = '  if (request.method === "GET" && resource === "dashboard-source") {';
  const block = `  // Mobile PO-linked Goods Receiving — delegates final writes to KCP's atomic GRV engine.\n  if (request.method === "GET" && resource === "mobile/receiving/bootstrap") {\n    return getMobileReceivingBootstrap(request, env, auth, workspaceId);\n  }\n  {\n    const receivingBarcode = routePattern(resource, /^mobile\\/receiving\\/orders\\/([^/]+)\\/barcodes\\/(.+)$/);\n    if (receivingBarcode && request.method === "GET") return getMobileReceivingBarcode(request, env, auth, workspaceId, decodeURIComponent(receivingBarcode[1]), receivingBarcode[2]);\n    const receivingOrder = routePattern(resource, /^mobile\\/receiving\\/orders\\/([^/]+)$/);\n    if (receivingOrder && request.method === "GET") return getMobileReceivingOrder(request, env, auth, workspaceId, decodeURIComponent(receivingOrder[1]));\n  }\n  if (request.method === "POST" && resource === "mobile/receiving/preview") {\n    return postMobileReceivingPreview(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/receiving/commit") {\n    return postMobileReceivingCommit(request, env, auth, workspaceId);\n  }\n\n`;
  if (!routes.includes(anchor)) throw new Error(`Could not find the mobile receiving insertion point in ${routeFile}.`);
  routes = routes.replace(anchor, `${block}${anchor}`);
}
await writeFile(routeFile, routes);

const packageFile = path.join(workerDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
if (typeof packageJson.scripts?.['test:mobile'] === 'string' && !packageJson.scripts['test:mobile'].includes('tests/mobile-receiving.test.ts')) {
  packageJson.scripts['test:mobile'] += ' tests/mobile-receiving.test.ts';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let dispatcher = await readFile(dispatcherFile, 'utf8');
dispatcher = dispatcher.replace('        receiving: false,', '        receiving: true, // Phase 14');
if (!dispatcher.includes('receiving(?:\\/.*)?')) {
  const oldPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?)';
  const nextPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?|receiving(?:\\/.*)?)';
  if (!dispatcher.includes(oldPattern)) throw new Error(`Could not find the mobile operations dispatcher in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(oldPattern, nextPattern);
  dispatcher = dispatcher.replace('manufacturing (Phase 13).', 'manufacturing (Phase 13), receiving (Phase 14).');
  dispatcher = dispatcher.replace('barcode/wastage/transfer/manufacturing services', 'barcode/wastage/transfer/manufacturing/receiving services');
}
await writeFile(dispatcherFile, dispatcher);

const [finalModule, finalRoutes, finalDispatcher] = await Promise.all([readFile(moduleFile, 'utf8'), readFile(routeFile, 'utf8'), readFile(dispatcherFile, 'utf8')]);
if (!finalModule.includes('postMobileReceivingCommit') || !finalRoutes.includes('getMobileReceivingBootstrap(') || !finalDispatcher.includes('receiving(?:\\/.*)?') || !finalDispatcher.includes('receiving: true')) {
  throw new Error('Phase 8 Worker extension verification failed.');
}
console.log('Phase 8 mobile Goods Receiving Worker extension is ready.');
