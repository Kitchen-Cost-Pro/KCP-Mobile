import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const moduleFile = path.join(workerDir, 'src/legacy/mobile-purchase-orders.ts');
const moduleTemplate = path.join(scriptDir, '../worker-patches/phase9-mobile-purchase-orders.ts.txt');
const testFile = path.join(workerDir, 'tests/mobile-purchase-orders.test.ts');
const testTemplate = path.join(scriptDir, '../worker-patches/phase9-mobile-purchase-orders.test.ts.txt');
const routeFile = path.join(workerDir, 'src/legacy/index.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');

let moduleSource = '';
try { moduleSource = await readFile(moduleFile, 'utf8'); } catch { /* created below */ }
if (!moduleSource.includes('MOBILE_PURCHASE_ORDER_ADAPTER_VERSION = 10') || !moduleSource.includes('deleteMobilePurchaseOrderDraft') || !moduleSource.includes('mobileRequestFingerprint')) {
  await writeFile(moduleFile, await readFile(moduleTemplate, 'utf8'));
}
moduleSource = await readFile(moduleFile, 'utf8');
moduleSource = moduleSource.replace(
  'SELECT id, name, email, phone, raw_json FROM suppliers WHERE workspace_id = ?1 AND id = ?2 AND active = 1 LIMIT 1',
  'SELECT id, name, email, phone, raw_json, updated_at FROM suppliers WHERE workspace_id = ?1 AND id = ?2 AND active = 1 LIMIT 1'
);
await writeFile(moduleFile, moduleSource);

let testSource = '';
try { testSource = await readFile(testFile, 'utf8'); } catch { /* created below */ }
if (!testSource.includes('derives receiving progress without supplier-item restrictions')) await writeFile(testFile, await readFile(testTemplate, 'utf8'));

let routes = await readFile(routeFile, 'utf8');
if (!routes.includes('from "./mobile-purchase-orders"')) {
  const anchor = '} from "./mobile-receiving";';
  const position = routes.indexOf(anchor);
  if (position < 0) throw new Error(`Could not find the mobile receiving import in ${routeFile}.`);
  const end = position + anchor.length;
  const imports = `\nimport {\n  getMobilePurchaseOrderBootstrap,\n  getMobilePurchaseOrderCatalog,\n  getMobilePurchaseOrder,\n  postMobilePurchaseOrderPreview,\n  postMobilePurchaseOrderDraft,\n  postMobilePurchaseOrderSubmit,\n  deleteMobilePurchaseOrderDraft,\n} from "./mobile-purchase-orders";`;
  routes = `${routes.slice(0, end)}${imports}${routes.slice(end)}`;
}
if (!routes.includes('deleteMobilePurchaseOrderDraft,')) {
  const anchor = '  postMobilePurchaseOrderSubmit,\n} from "./mobile-purchase-orders";';
  if (!routes.includes(anchor)) throw new Error(`Could not extend the mobile purchase-order import in ${routeFile}.`);
  routes = routes.replace(anchor, '  postMobilePurchaseOrderSubmit,\n  deleteMobilePurchaseOrderDraft,\n} from "./mobile-purchase-orders";');
}
if (!routes.includes('resource === "mobile/purchase-orders/bootstrap"')) {
  const anchor = '  if (request.method === "GET" && resource === "dashboard-source") {';
  const block = `  // Mobile Purchase Ordering — validates fresh KCP supplier, location, catalogue and cost data.\n  if (request.method === "GET" && resource === "mobile/purchase-orders/bootstrap") {\n    return getMobilePurchaseOrderBootstrap(request, env, auth, workspaceId);\n  }\n  if (request.method === "GET" && resource === "mobile/purchase-orders/catalog") {\n    return getMobilePurchaseOrderCatalog(request, env, auth, workspaceId);\n  }\n  {\n    const purchaseOrder = routePattern(resource, /^mobile\\/purchase-orders\\/([^/]+)$/);\n    if (purchaseOrder && request.method === "GET") return getMobilePurchaseOrder(request, env, auth, workspaceId, decodeURIComponent(purchaseOrder[1]));\n  }\n  if (request.method === "POST" && resource === "mobile/purchase-orders/preview") {\n    return postMobilePurchaseOrderPreview(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/purchase-orders/drafts") {\n    return postMobilePurchaseOrderDraft(request, env, auth, workspaceId);\n  }\n  if (request.method === "POST" && resource === "mobile/purchase-orders/submit") {\n    return postMobilePurchaseOrderSubmit(request, env, auth, workspaceId);\n  }\n\n`;
  if (!routes.includes(anchor)) throw new Error(`Could not find the purchase-order insertion point in ${routeFile}.`);
  routes = routes.replace(anchor, `${block}${anchor}`);
}
if (!routes.includes('return deleteMobilePurchaseOrderDraft(')) {
  const anchor = '    if (purchaseOrder && request.method === "GET") return getMobilePurchaseOrder(request, env, auth, workspaceId, decodeURIComponent(purchaseOrder[1]));';
  if (!routes.includes(anchor)) throw new Error(`Could not extend the mobile purchase-order detail route in ${routeFile}.`);
  routes = routes.replace(anchor, `${anchor}\n    if (purchaseOrder && request.method === "DELETE") return deleteMobilePurchaseOrderDraft(request, env, auth, workspaceId, decodeURIComponent(purchaseOrder[1]));`);
}
await writeFile(routeFile, routes);

const packageFile = path.join(workerDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
if (typeof packageJson.scripts?.['test:mobile'] === 'string' && !packageJson.scripts['test:mobile'].includes('tests/mobile-purchase-orders.test.ts')) {
  packageJson.scripts['test:mobile'] += ' tests/mobile-purchase-orders.test.ts';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let dispatcher = await readFile(dispatcherFile, 'utf8');
if (!dispatcher.includes('purchaseOrders: true')) {
  const flagAnchor = '        receiving: true, // Phase 14';
  if (!dispatcher.includes(flagAnchor)) throw new Error(`Could not find the receiving feature flag in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(flagAnchor, `${flagAnchor}\n        purchaseOrders: true, // Phase 15`);
}
if (!dispatcher.includes('purchase-orders(?:\\/.*)?')) {
  const oldPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?|receiving(?:\\/.*)?)';
  const nextPattern = '(?:barcodes\\/.+|wastage|transfers(?:\\/.*)?|manufacturing(?:\\/.*)?|receiving(?:\\/.*)?|purchase-orders(?:\\/.*)?)';
  if (!dispatcher.includes(oldPattern)) throw new Error(`Could not find the mobile operations dispatcher in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(oldPattern, nextPattern);
  dispatcher = dispatcher.replace('receiving (Phase 14).', 'receiving (Phase 14), purchase ordering (Phase 15).');
  dispatcher = dispatcher.replace('barcode/wastage/transfer/manufacturing/receiving services', 'barcode/wastage/transfer/manufacturing/receiving/purchase-order services');
}
await writeFile(dispatcherFile, dispatcher);

const [finalModule, finalRoutes, finalDispatcher] = await Promise.all([readFile(moduleFile, 'utf8'), readFile(routeFile, 'utf8'), readFile(dispatcherFile, 'utf8')]);
if (!finalModule.includes('deleteMobilePurchaseOrderDraft') || !finalRoutes.includes('deleteMobilePurchaseOrderDraft(') || !finalDispatcher.includes('purchase-orders(?:\\/.*)?') || !finalDispatcher.includes('purchaseOrders: true')) {
  throw new Error('Phase 10 Worker extension verification failed.');
}
console.log('Phase 10 mobile Purchase Ordering Worker extension is ready.');
