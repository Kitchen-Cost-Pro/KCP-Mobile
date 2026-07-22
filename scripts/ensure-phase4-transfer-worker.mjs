import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const transferFile = path.join(workerDir, 'src/legacy/mobile-transfers.ts');
const routeFile = path.join(workerDir, 'src/legacy/index.ts');
const handlerFile = path.join(scriptDir, '../worker-patches/phase4-transfer-items-handler.ts.txt');
const marker = 'getMobileTransferItems';

async function patchTransferFile() {
  let source = await readFile(transferFile, 'utf8');
  if (!source.includes(`export async function ${marker}`)) {
    const anchor = '// ============================================================================\n// GET .../transfers/bootstrap';
    if (!source.includes(anchor)) throw new Error(`Could not find the transfer handler insertion point in ${transferFile}.`);
    const handler = (await readFile(handlerFile, 'utf8')).trim();
    source = source.replace(anchor, `${handler}\n\n${anchor}`);
    await writeFile(transferFile, source);
  }
}

async function patchRouteFile() {
  let source = await readFile(routeFile, 'utf8');
  if (!source.includes(`  ${marker},`)) {
    const importAnchor = '  getMobileTransferBootstrap,\n  getMobileTransfers,';
    if (!source.includes(importAnchor)) throw new Error(`Could not find the transfer import in ${routeFile}.`);
    source = source.replace(importAnchor, `  getMobileTransferBootstrap,\n  ${marker},\n  getMobileTransfers,`);
  }
  if (!source.includes('resource === "mobile/transfers/items"')) {
    const routeAnchor = '  if (request.method === "GET" && resource === "mobile/transfers") {';
    if (!source.includes(routeAnchor)) throw new Error(`Could not find the transfer route insertion point in ${routeFile}.`);
    source = source.replace(routeAnchor, `  if (request.method === "GET" && resource === "mobile/transfers/items") {\n    return ${marker}(request, env, auth, workspaceId);\n  }\n${routeAnchor}`);
  }
  await writeFile(routeFile, source);
}

await patchTransferFile();
await patchRouteFile();

const [transferSource, routeSource] = await Promise.all([readFile(transferFile, 'utf8'), readFile(routeFile, 'utf8')]);
if (!transferSource.includes(`export async function ${marker}`) || !routeSource.includes(`return ${marker}(`)) {
  throw new Error('Phase 4 Worker extension verification failed.');
}
console.log('Phase 4 transfer item-search Worker extension is ready.');
