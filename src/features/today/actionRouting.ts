import type { AppRoute } from '../../types/kcp';
import type { KcpAction } from '../flow/actionModel';

const ROUTES: Record<string, AppRoute> = {
  approval: 'approvals', approval_request: 'approvals',
  stock_count: 'stock-takes', scheduled_stock_take: 'stock-takes', recount: 'stock-takes', stock_take_recount: 'stock-takes',
  transfer: 'transfers', incoming_transfer: 'transfers', transfer_acceptance: 'transfers',
  expected_delivery: 'receiving', receiving: 'receiving', goods_receiving: 'receiving', receiving_discrepancy: 'receiving',
  purchase_order: 'purchase-orders', low_stock: 'low-stock', stockout_risk: 'low-stock',
  manufacturing: 'manufacturing', manufacturing_requirement: 'manufacturing', ingredient_shortage: 'manufacturing', yield_exception: 'manufacturing', manufacturing_wastage: 'manufacturing',
  wastage: 'wastage', wastage_exception: 'wastage',
  barcode_exception: 'scan', catalogue_exception: 'scan', unknown_barcode: 'scan',
  interrupted_draft: 'tasks', routine: 'tasks', routine_checklist: 'tasks'
};

export function routeForAction(action: KcpAction): AppRoute {
  const fromLink = routeFromDeepLink(action.deepLink);
  return fromLink || ROUTES[key(action.actionType)] || ROUTES[key(action.sourceRecord.type)] || 'tasks';
}

function routeFromDeepLink(value: string): AppRoute | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const segment = url.pathname.split('/').filter(Boolean).at(-2) || '';
    const aliases: Record<string, AppRoute> = { actions: 'tasks', action: 'tasks', approvals: 'approvals', approval: 'approvals', transfers: 'transfers', transfer: 'transfers', receiving: 'receiving', 'stock-takes': 'stock-takes', 'stock-counts': 'stock-takes', manufacturing: 'manufacturing', wastage: 'wastage', scan: 'scan', barcodes: 'scan', 'purchase-orders': 'purchase-orders', 'low-stock': 'low-stock' };
    return aliases[key(segment)] || null;
  } catch { return null; }
}

function key(value: unknown) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
