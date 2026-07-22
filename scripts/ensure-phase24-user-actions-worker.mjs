import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Worker directory is required.');
const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const moduleFile=path.join(workerDir,'src/legacy/kcp-user-actions.ts');
const tasksFile=path.join(workerDir,'src/legacy/operational-tasks.ts');
const routesFile=path.join(workerDir,'src/legacy/index.ts');
const dispatcherFile=path.join(workerDir,'src/index.ts');

await writeFile(moduleFile,await readFile(path.join(scriptDir,'../worker-patches/phase24-kcp-user-actions.ts.txt'),'utf8'));
let tasks=await readFile(tasksFile,'utf8');
if(!tasks.includes("from './kcp-user-actions'")){
  tasks=tasks.replace("import { assertRoleSetCapability", "import { configuredRoutineAssignments } from './kcp-user-actions';\nimport { assertRoleSetCapability");
  tasks=tasks.replace('for (const assignment of assignments.results || []) {','const configuredAssignments=await configuredRoutineAssignments(env,workspaceId,text(template.id),occurrence);\n    for (const assignment of [...(assignments.results || []),...configuredAssignments]) {');
  await writeFile(tasksFile,tasks);
}
let routes=await readFile(routesFile,'utf8');
if(!routes.includes('getUserActionUsers')){
  routes=`import { getUserActionUsers, getUserActionProfile, putUserActionProfile, getActionGroups, putActionGroup, putResponsibility, getResponsibilityPreview, postBulkUserActions } from './kcp-user-actions';\n${routes}`;
  const anchor='  if (request.method === "GET" && resource === "dashboard-source") {';
  const block=`  { const profile=routePattern(resource,/^user-actions\\/users\\/([^/]+)$/); const preview=routePattern(resource,/^user-actions\\/users\\/([^/]+)\\/preview$/); const responsibility=routePattern(resource,/^user-actions\\/users\\/([^/]+)\\/responsibilities(?:\\/([^/]+))?$/); const group=routePattern(resource,/^user-actions\\/groups(?:\\/([^/]+))?$/); if(profile&&request.method==='GET')return getUserActionProfile(request,env,auth,workspaceId,decodeURIComponent(profile[1])); if(profile&&request.method==='PUT')return putUserActionProfile(request,env,auth,workspaceId,decodeURIComponent(profile[1])); if(preview&&request.method==='GET')return getResponsibilityPreview(request,env,auth,workspaceId,decodeURIComponent(preview[1])); if(responsibility&&request.method==='PUT')return putResponsibility(request,env,auth,workspaceId,decodeURIComponent(responsibility[1]),decodeURIComponent(responsibility[2]||'')); if(group&&request.method==='PUT')return putActionGroup(request,env,auth,workspaceId,decodeURIComponent(group[1]||'')); }
  if (request.method === 'GET' && resource === 'user-actions/users') return getUserActionUsers(request,env,auth,workspaceId);
  if (request.method === 'GET' && resource === 'user-actions/groups') return getActionGroups(request,env,auth,workspaceId);
  if (request.method === 'POST' && resource === 'user-actions/bulk') return postBulkUserActions(request,env,auth,workspaceId);

`;
  if(!routes.includes(anchor))throw new Error('No Phase 24 route insertion point.');
  await writeFile(routesFile,routes.replace(anchor,block+anchor));
}
let dispatcher=await readFile(dispatcherFile,'utf8');
if(!dispatcher.includes('|user-actions(?:\\/.*)?'))dispatcher=dispatcher.replace('|actions(?:\\/.*)?','|actions(?:\\/.*)?|user-actions(?:\\/.*)?');
await writeFile(dispatcherFile,dispatcher);
if(!(await readFile(routesFile,'utf8')).includes('getUserActionUsers'))throw new Error('Phase 24 worker verification failed.');
console.log('Phase 24 KCP User Actions worker patch is ready.');
