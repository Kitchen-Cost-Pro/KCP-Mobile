import { apiRequest } from '../../core/api/client';
import type { ApprovalPending } from '../approvals/approvalSubmission';

export type PurchaseOrderSupplier = { id: string; name: string; email: string; phone: string; category: string };
export type PurchaseOrderLocation = { id: string; name: string; kind: string; isDefault?: boolean };
export type PurchaseOrderCatalogItem = {
  id: string; name: string; sku: string | null; category: string; baseUom: string; purchaseUom: string;
  packSize: number; unitCost: number; uoms: Array<{ name: string; quantityInBase: number }>;
};
export type PurchaseOrderLine = PurchaseOrderCatalogItem & {
  quantity: number; orderedQuantity?: number; receivedQuantity?: number; remainingQuantity?: number;
  lineStatus?: 'awaiting' | 'partial' | 'completed'; note: string; lineTotalEx: number;
};
export type PurchaseOrderTimelineEvent = { type: string; actorUid: string; actorName?: string; occurredAt: string };
export type PurchaseOrderSummary = {
  id: string; clientOrderId: string; poNumber: string; supplierId: string; supplierName: string;
  supplierEmail: string; supplierPhone: string;
  location: PurchaseOrderLocation; status: string; statusBucket: 'drafts' | 'sent' | 'partial' | 'completed';
  orderedAt: string; expectedAt: string; note: string; totalEx: number; totalVat: number; totalInc: number;
  lineCount: number; receivedLineCount: number; remainingLineCount: number; receivingProgress: number;
  items: Array<{ id: string; stockItemId: string; name: string; sku: string | null; category: string; quantity: number; orderedQuantity: number; receivedQuantity: number; remainingQuantity: number; lineStatus: 'awaiting' | 'partial' | 'completed'; purchaseUom: string; baseUom: string; packSize: number; unitCost: number; lineTotalEx: number; note: string }>;
  createdBy: string; editable: boolean; createdAt: string; submittedAt: string; partiallyReceivedAt: string; receivedAt: string; updatedAt: string;
  timeline?: PurchaseOrderTimelineEvent[];
};
export type PurchaseOrderBootstrap = { ok: boolean; workspaceId: string; suppliers: PurchaseOrderSupplier[]; locations: PurchaseOrderLocation[]; orders: PurchaseOrderSummary[]; syncedAt?: string };
export type PurchaseOrderEntry = { quantity: string; note: string; entered: boolean };
export type PurchaseOrderDraft = { clientOrderId: string; supplierId: string; locationId: string; expectedAt: string; note: string; entries: Record<string, PurchaseOrderEntry> };
export type PurchaseOrderPreview = {
  ok: boolean; clientOrderId: string; supplier: PurchaseOrderSupplier; location: PurchaseOrderLocation; expectedAt: string; note: string;
  lines: PurchaseOrderLine[]; totalEx: number; totalVat: number; totalInc: number; warnings: string[]; blockingErrors: string[];
  previewToken: string; payloadFingerprint: string; previewedAt: string;
};
export type PurchaseOrderSaveResult = { ok: boolean; duplicate: boolean; order: PurchaseOrderSummary };
export type PurchaseOrderPreload = {
  requestId: string;
  locationId: string;
  locationName: string;
  items: Array<{ stockItemId: string; name: string; suggestedOrderQuantity: number }>;
};

function path(workspaceId: string, suffix: string) { return `api/mobile/v1/workspaces/${encodeURIComponent(workspaceId.trim())}/purchase-orders/${suffix}`; }
export function loadPurchaseOrderBootstrap(workspaceId: string) { return apiRequest<PurchaseOrderBootstrap>(path(workspaceId, 'bootstrap')); }
export function loadPurchaseOrderCatalog(workspaceId: string, supplierId: string, locationId: string) {
  return apiRequest<{ ok: boolean; items: PurchaseOrderCatalogItem[] }>(`${path(workspaceId, 'catalog')}?supplierId=${encodeURIComponent(supplierId)}&locationId=${encodeURIComponent(locationId)}`).then((value) => value.items);
}
export function loadPurchaseOrder(workspaceId: string, orderId: string) { return apiRequest<{ ok: boolean; order: PurchaseOrderSummary }>(path(workspaceId, encodeURIComponent(orderId))).then((value) => value.order); }
export function deletePurchaseOrderDraft(workspaceId: string, orderId: string) { return apiRequest<{ ok: boolean; id: string }>(path(workspaceId, encodeURIComponent(orderId)), { method: 'DELETE' }); }
export type PurchaseOrderPayload = { clientOrderId: string; supplierId: string; locationId: string; expectedAt: string; note: string; entries: Array<{ stockItemId: string; quantity: number; note: string }> };
export function previewPurchaseOrder(workspaceId: string, payload: PurchaseOrderPayload) { return apiRequest<PurchaseOrderPreview>(path(workspaceId, 'preview'), { method: 'POST', payload }); }
export function savePurchaseOrderDraft(workspaceId: string, payload: PurchaseOrderPayload) { return apiRequest<PurchaseOrderSaveResult>(path(workspaceId, 'drafts'), { method: 'POST', payload }); }
export function submitPurchaseOrder(workspaceId: string, payload: PurchaseOrderPayload & { previewToken: string; confirm: true }) { return apiRequest<PurchaseOrderSaveResult | ApprovalPending>(path(workspaceId, 'submit'), { method: 'POST', payload }); }
