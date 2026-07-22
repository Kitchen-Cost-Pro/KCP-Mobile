import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir=path.resolve(process.argv[2]||''); if(!workerDir)throw new Error('Worker directory is required.');
const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const moduleFile=path.join(workerDir,'src/legacy/role-sets.ts');
const testFile=path.join(workerDir,'tests/role-sets.test.ts');
const operationsFile=path.join(workerDir,'src/legacy/operational-tasks.ts');
const routeFile=path.join(workerDir,'src/legacy/index.ts');
const dispatcherFile=path.join(workerDir,'src/index.ts');

await writeFile(moduleFile,await readFile(path.join(scriptDir,'../worker-patches/phase18-role-sets.ts.txt'),'utf8'));
await writeFile(testFile,await readFile(path.join(scriptDir,'../worker-patches/phase18-role-sets.test.ts.txt'),'utf8'));
await writeFile(operationsFile,await readFile(path.join(scriptDir,'../worker-patches/phase14-operational-tasks.ts.txt'),'utf8'));

let routes=await readFile(routeFile,'utf8');
const oldImport='import { getMobileTasks, getMobileTask, putMobileTaskProgress, postMobileTaskComplete, getTaskTemplates, postTaskTemplate, putTaskTemplate, deleteTaskTemplate } from "./operational-tasks";';
const newImport='import { getMobileTasks, getMobileTask, putMobileTaskProgress, postMobileTaskComplete, postMobileActionDefer, postActionReassign, getTaskTemplates, postTaskTemplate, putTaskTemplate, deleteTaskTemplate } from "./operational-tasks";';
if(routes.includes(oldImport))routes=routes.replace(oldImport,newImport);
if(!routes.includes('from "./role-sets"')){const point=routes.indexOf('import {');if(point<0)throw new Error(`No import insertion point in ${routeFile}.`);routes=`${routes.slice(0,point)}import { getCurrentRoleSet, getRoleSets, postRoleSet, putRoleSet, putRoleSetAssignment } from "./role-sets";\n${routes.slice(point)}`;}

if(!routes.includes('resource === "mobile/role-sets/current"')){
  const anchor='  if (request.method === "GET" && resource === "dashboard-source") {';
  const block=`  // Phase 18 Role Sets: prioritisation only; permissions and location access remain authoritative.\n  if (request.method === "GET" && resource === "mobile/role-sets/current") return getCurrentRoleSet(request, env, auth, workspaceId);\n  if (resource === "role-sets" && request.method === "GET") return getRoleSets(request, env, auth, workspaceId);\n  if (resource === "role-sets" && request.method === "POST") return postRoleSet(request, env, auth, workspaceId);\n  {\n    const roleSet = routePattern(resource, /^role-sets\\/([^/]+)$/);\n    const assignment = routePattern(resource, /^role-set-assignments\\/([^/]+)$/);\n    const actionDefer = routePattern(resource, /^mobile\\/actions\\/([^/]+)\\/defer$/);\n    const actionReassign = routePattern(resource, /^mobile\\/actions\\/([^/]+)\\/reassign$/);\n    if (roleSet && request.method === "PUT") return putRoleSet(request, env, auth, workspaceId, decodeURIComponent(roleSet[1]));\n    if (assignment && request.method === "PUT") return putRoleSetAssignment(request, env, auth, workspaceId, decodeURIComponent(assignment[1]));\n    if (actionDefer && request.method === "POST") return postMobileActionDefer(request, env, auth, workspaceId, decodeURIComponent(actionDefer[1]));\n    if (actionReassign && request.method === "POST") return postActionReassign(request, env, auth, workspaceId, decodeURIComponent(actionReassign[1]));\n  }\n\n`;
  if(!routes.includes(anchor))throw new Error(`No Role Set route insertion point in ${routeFile}.`);
  routes=routes.replace(anchor,block+anchor);
}
await writeFile(routeFile,routes);

const packageFile=path.join(workerDir,'package.json');
const packageJson=JSON.parse(await readFile(packageFile,'utf8'));
if(typeof packageJson.scripts?.['test:mobile']==='string'&&!packageJson.scripts['test:mobile'].includes('tests/role-sets.test.ts')){packageJson.scripts['test:mobile']+=' tests/role-sets.test.ts';await writeFile(packageFile,JSON.stringify(packageJson,null,2)+'\n');}

let dispatcher=await readFile(dispatcherFile,'utf8');
if(!dispatcher.includes('role-sets(?:\\/.*)?')){
  const marker='|actions(?:\\/.*)?';
  if(!dispatcher.includes(marker))throw new Error(`No Role Set dispatcher anchor in ${dispatcherFile}.`);
  dispatcher=dispatcher.replace(marker,`${marker}|role-sets(?:\\/.*)?`);
}
if(!dispatcher.includes('role-set-assignments(?:\\/.*)?'))dispatcher=dispatcher.replace('|role-sets(?:\\/.*)?','|role-sets(?:\\/.*)?|role-set-assignments(?:\\/.*)?');
await writeFile(dispatcherFile,dispatcher);

const finalRoutes=await readFile(routeFile,'utf8');
if(!finalRoutes.includes('mobile/role-sets/current')||!finalRoutes.includes('postMobileActionDefer')||!finalRoutes.includes('putRoleSetAssignment'))throw new Error('Phase 18 Role Set Worker verification failed.');
console.log('Phase 18 Role Set Worker extension is ready.');
