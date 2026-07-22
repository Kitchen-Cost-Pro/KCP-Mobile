import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir=path.resolve(process.argv[2]||''); if(!process.argv[2])throw new Error('Worker directory is required.');
const scriptDir=path.dirname(fileURLToPath(import.meta.url)); const moduleFile=path.join(workerDir,'src/legacy/operations-control.ts'); const routesFile=path.join(workerDir,'src/legacy/index.ts'); const dispatcherFile=path.join(workerDir,'src/index.ts');
await writeFile(moduleFile,await readFile(path.join(scriptDir,'../worker-patches/phase23-operations-control.ts.txt'),'utf8'));
let routes=await readFile(routesFile,'utf8'); if(!routes.includes("from './operations-control'")){routes=`import { getOperationsControl, postOperationsIntervention } from './operations-control';\n${routes}`;const anchor='  if (request.method === "GET" && resource === "dashboard-source") {';const block=`  { const managerAction=routePattern(resource,/^mobile\\/actions\\/manager\\/actions\\/([^/]+)\\/(reassign|escalate|defer|priority|resolve_blocker)$/); if(managerAction&&request.method==='POST')return postOperationsIntervention(request,env,auth,workspaceId,decodeURIComponent(managerAction[1]),managerAction[2]); }\n  if (request.method === 'GET' && resource === 'mobile/actions/manager/control') return getOperationsControl(request,env,auth,workspaceId);\n\n`;if(!routes.includes(anchor))throw new Error('No Operations Control insertion point.');routes=routes.replace(anchor,block+anchor);await writeFile(routesFile,routes);}
let dispatcher=await readFile(dispatcherFile,'utf8');if(!dispatcher.includes('actions\\/manager'))dispatcher=dispatcher.replace('|actions(?:\\/.*)?','|actions(?:\\/.*)?');await writeFile(dispatcherFile,dispatcher);
if(!(await readFile(routesFile,'utf8')).includes('getOperationsControl'))throw new Error('Phase 23 worker verification failed.');console.log('Phase 23 Operations Control worker patch is ready.');
