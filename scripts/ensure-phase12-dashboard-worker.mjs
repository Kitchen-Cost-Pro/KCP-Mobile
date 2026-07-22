import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workerDir = path.resolve(process.argv[2] || '../KCP-Live/cloudflare-v2');
const moduleFile = path.join(workerDir, 'src/legacy/mobile-dashboard.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');
const routesFile = path.join(workerDir, 'src/legacy/index.ts');

let source;
try { source = await readFile(moduleFile, 'utf8'); }
catch { throw new Error(`The current KCP Worker is missing ${moduleFile}. Use the current KCP-Live Worker source before deploying Phase 12.`); }

if (!source.includes('assertWorkspacePermission')) {
  const anchor = "import { assertWorkspaceAccess, getUserAllowedLocationIds, assertLocationAccess } from './auth';";
  if (!source.includes(anchor)) throw new Error(`Could not extend the dashboard auth import in ${moduleFile}.`);
  source = source.replace(anchor, "import { assertWorkspaceAccess, assertWorkspacePermission, getUserAllowedLocationIds, assertLocationAccess } from './auth';");
}

if (!source.includes("assertWorkspacePermission(env, auth, workspaceId, 'nav-dashboard')")) {
  const anchor = '  await assertWorkspaceAccess(env, auth, workspaceId);';
  const position = source.indexOf(anchor, source.indexOf('export async function getMobileDashboard'));
  if (position < 0) throw new Error(`Could not locate the mobile dashboard access check in ${moduleFile}.`);
  const end = position + anchor.length;
  source = `${source.slice(0, end)}\n  await assertWorkspacePermission(env, auth, workspaceId, 'nav-dashboard');${source.slice(end)}`;
}
await writeFile(moduleFile, source);

const [dispatcher, routes] = await Promise.all([readFile(dispatcherFile, 'utf8'), readFile(routesFile, 'utf8')]);
if (!dispatcher.includes("forwardToWorkspaceDO(request, env, wsId, 'mobile/dashboard', auth)")) throw new Error('The versioned mobile dashboard dispatcher is missing.');
if (!routes.includes('resource === "mobile/dashboard"') || !routes.includes('getMobileDashboard(')) throw new Error('The workspace dashboard route is missing.');
if (!source.includes("assertWorkspacePermission(env, auth, workspaceId, 'nav-dashboard')")) throw new Error('Phase 12 dashboard permission verification failed.');
console.log('Phase 12 mobile Operations Dashboard route is permission-hardened and ready.');
