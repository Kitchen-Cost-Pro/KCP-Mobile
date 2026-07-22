import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = path.resolve(process.argv[2] || '');
if (!workerDir) throw new Error('Worker directory is required.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const routesFile = path.join(workerDir, 'src/legacy/index.ts');
const dispatcherFile = path.join(workerDir, 'src/index.ts');
const moduleFile = path.join(workerDir, 'src/legacy/notifications.ts');
const testFile = path.join(workerDir, 'tests/notifications.test.ts');

await writeFile(moduleFile, await readFile(path.join(scriptDir, '../worker-patches/phase16-notifications.ts.txt'), 'utf8'));
await writeFile(testFile, await readFile(path.join(scriptDir, '../worker-patches/phase16-notifications.test.ts.txt'), 'utf8'));

let routes = await readFile(routesFile, 'utf8');
if (!routes.includes('from "./notifications"')) {
  const point = routes.indexOf('import {');
  if (point < 0) throw new Error(`No import insertion point in ${routesFile}.`);
  routes = `${routes.slice(0, point)}import { getMobileNotifications, putMobileNotificationPreferences, postMobileNotificationDevice, deleteMobileNotificationDevice, postNotificationDispatch } from "./notifications";\n${routes.slice(point)}`;
}
if (!routes.includes('resource === "mobile/notifications"')) {
  const anchor = '  if (request.method === "GET" && resource === "dashboard-source") {';
  if (!routes.includes(anchor)) throw new Error(`No notification route insertion point in ${routesFile}.`);
  const block = `  // Phase 16 — notification preferences, token lifecycle and push dispatch.\n  if (request.method === "GET" && resource === "mobile/notifications") return getMobileNotifications(request, env, auth, workspaceId);\n  if (request.method === "PUT" && resource === "mobile/notifications/preferences") return putMobileNotificationPreferences(request, env, auth, workspaceId);\n  if (request.method === "POST" && resource === "mobile/notifications/devices") return postMobileNotificationDevice(request, env, auth, workspaceId);\n  {\n    const notificationDevice = routePattern(resource, /^mobile\\/notifications\\/devices\\/([^/]+)$/);\n    if (notificationDevice && request.method === "DELETE") return deleteMobileNotificationDevice(request, env, auth, workspaceId, decodeURIComponent(notificationDevice[1]));\n  }\n  if (request.method === "POST" && resource === "notification-dispatch") return postNotificationDispatch(request, env, auth, workspaceId);\n\n`;
  routes = routes.replace(anchor, block + anchor);
}
await writeFile(routesFile, routes);

const packageFile = path.join(workerDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
if (typeof packageJson.scripts?.['test:mobile'] === 'string' && !packageJson.scripts['test:mobile'].includes('tests/notifications.test.ts')) {
  packageJson.scripts['test:mobile'] += ' tests/notifications.test.ts';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let dispatcher = await readFile(dispatcherFile, 'utf8');
dispatcher = dispatcher.replace(/notifications:\s*false/g, 'notifications: true');
if (!dispatcher.includes('notifications(?:\\/.*)?')) {
  const marker = '|approvals(?:\\/.*)?';
  if (!dispatcher.includes(marker)) throw new Error(`No Phase 15 dispatcher anchor in ${dispatcherFile}.`);
  dispatcher = dispatcher.replace(marker, `${marker}|notifications(?:\\/.*)?|notification-dispatch`);
}
await writeFile(dispatcherFile, dispatcher);

const finalRoutes = await readFile(routesFile, 'utf8');
if (!finalRoutes.includes('postNotificationDispatch(') || !finalRoutes.includes('deleteMobileNotificationDevice(')) {
  throw new Error('Phase 16 Worker extension verification failed.');
}
console.log('Phase 16 notifications, preferences and token management are ready.');
