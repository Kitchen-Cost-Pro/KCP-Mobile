const defaultApi = 'https://kcp-api-v2.adminkitchencostpro.workers.dev';
const apiBase = String(process.env.KCP_API_URL || defaultApi).replace(/\/+$/, '');

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function main() {
  console.log(`Checking ${apiBase}`);

  const healthResponse = await fetch(`${apiBase}/health`, {
    headers: { Accept: 'application/json' }
  });
  const health = await readJson(healthResponse);
  if (!healthResponse.ok || health.service !== 'kcp-api-v2') {
    throw new Error(`Health check failed (HTTP ${healthResponse.status}).`);
  }
  console.log(`  [ok] kcp-api-v2 health${health.workerRelease ? ` — ${health.workerRelease}` : ''}`);

  const loginResponse = await fetch(`${apiBase}/api/mobile/v1/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '', password: '' })
  });
  const login = await readJson(loginResponse);
  if (loginResponse.status === 404) {
    throw new Error('The /api/mobile/v1/session/login route is missing from this deployment.');
  }
  if (loginResponse.status !== 400 || !String(login.error || login.message || '').includes('Enter your email and password')) {
    throw new Error(`Mobile login returned an unexpected response (HTTP ${loginResponse.status}).`);
  }
  console.log('  [ok] /api/mobile/v1/session/login is deployed');

  const lowStockResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/low-stock?locationId=verification`, {
    headers: { Accept: 'application/json' }
  });
  if (lowStockResponse.status === 404) {
    throw new Error('The Phase 13 /api/mobile/v1/workspaces/:workspaceId/low-stock route is missing from this deployment.');
  }
  if (![401, 403].includes(lowStockResponse.status)) {
    throw new Error(`Phase 13 low-stock route returned an unexpected unauthenticated response (HTTP ${lowStockResponse.status}).`);
  }
  console.log('  [ok] Phase 13 low-stock route is deployed and protected');
  const approvalsResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/approvals`, { headers: { Accept: 'application/json' } });
  if (approvalsResponse.status === 404) throw new Error('The Phase 15 approvals route is missing from this deployment.');
  if (![401, 403].includes(approvalsResponse.status)) throw new Error(`Phase 15 approvals route returned an unexpected unauthenticated response (HTTP ${approvalsResponse.status}).`);
  console.log('  [ok] Phase 15 approvals route is deployed and protected');
  const notificationsResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/notifications`, { headers: { Accept: 'application/json' } });
  if (notificationsResponse.status === 404) throw new Error('The Phase 16 notifications route is missing from this deployment.');
  if (![401, 403].includes(notificationsResponse.status)) throw new Error(`Phase 16 notifications route returned an unexpected unauthenticated response (HTTP ${notificationsResponse.status}).`);
  console.log('  [ok] Phase 16 notification preferences route is deployed and protected');
  const actionsResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/actions?locationId=verification`, { headers: { Accept: 'application/json' } });
  if (actionsResponse.status === 404) throw new Error('The KCP Flow Actions route is missing from this deployment.');
  if (![401, 403].includes(actionsResponse.status)) throw new Error(`KCP Flow Actions returned an unexpected unauthenticated response (HTTP ${actionsResponse.status}).`);
  console.log('  [ok] KCP Flow Actions route is deployed and protected');
  const roleSetsResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/role-sets/current`, { headers: { Accept: 'application/json' } });
  if (roleSetsResponse.status === 404) throw new Error('The Phase 18 current Role Set route is missing from this deployment.');
  if (![401, 403].includes(roleSetsResponse.status)) throw new Error(`Phase 18 Role Sets returned an unexpected unauthenticated response (HTTP ${roleSetsResponse.status}).`);
  console.log('  [ok] Phase 18 current Role Set route is deployed and protected');
  const sourceResponse = await fetch(`${apiBase}/api/mobile/v1/workspaces/verification/action-source-events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (sourceResponse.status === 404) throw new Error('The Phase 20 operational Action source route is missing from this deployment.');
  if (![401, 403].includes(sourceResponse.status)) throw new Error(`Phase 20 Action source route returned an unexpected unauthenticated response (HTTP ${sourceResponse.status}).`);
  console.log('  [ok] Phase 20 operational Action source route is deployed and protected');
  console.log('Mobile API verification passed. No credentials were sent and no data was changed.');
}

main().catch((error) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
