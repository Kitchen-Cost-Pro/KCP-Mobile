import type { AppRoute } from '../../types/kcp';

export type DeepLinkIntent = {
  workspaceId: string;
  route: Exclude<AppRoute, 'home'|'insights'|'more'>;
  recordId: string;
};

const routeMap: Record<string, DeepLinkIntent['route']> = {
  action: 'tasks', actions: 'tasks', task: 'tasks', tasks: 'tasks', approval: 'approvals', approvals: 'approvals',
  transfer: 'transfers', transfers: 'transfers', po: 'purchase-orders',
  'purchase-order': 'purchase-orders', 'purchase-orders': 'purchase-orders',
  'low-stock': 'low-stock', receiving: 'receiving', grv: 'receiving',
  'stock-take': 'stock-takes', 'stock-takes': 'stock-takes', 'stock-count': 'stock-takes', 'stock-counts': 'stock-takes',
  manufacturing: 'manufacturing', wastage: 'wastage', barcode: 'scan', barcodes: 'scan', scan: 'scan'
};
let pending: DeepLinkIntent | null = null;

export function parseDeepLink(value: string): DeepLinkIntent | null {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (url.protocol === 'kcplite:' && url.hostname === 'workspace') parts.unshift('workspace');
    const workspaceIndex = parts.findIndex((part) => ['workspace', 'workspaces'].includes(part));
    if (workspaceIndex < 0 || parts.length < workspaceIndex + 4) return null;
    const workspaceId = parts[workspaceIndex + 1]; const route = routeMap[parts[workspaceIndex + 2].toLowerCase()]; const recordId = parts[workspaceIndex + 3];
    return workspaceId && route && recordId ? { workspaceId, route, recordId } : null;
  } catch { return null; }
}

export function receiveDeepLink(value: string) {
  const intent = parseDeepLink(value); if (!intent) return null; pending = intent;
  window.dispatchEvent(new CustomEvent<DeepLinkIntent>('kcp:deep-link', { detail: intent })); return intent;
}
export function deferDeepLink(intent: DeepLinkIntent) { pending = intent; }
export function takePendingDeepLink() { const value = pending; pending = null; return value; }
export function deepLinkFor(intent: DeepLinkIntent) { return `kcplite://workspace/${encodeURIComponent(intent.workspaceId)}/${intent.route}/${encodeURIComponent(intent.recordId)}`; }
