import { apiRequest } from '../../core/api/client';
import type { ApprovalPending } from '../approvals/approvalSubmission';

export type TransferLocation = {
  id: string;
  name: string;
  kind: string;
  isDefault: boolean;
};

export type TransferUom = {
  id: string;
  name: string;
  quantityInBase: number;
  isBase: boolean;
  barcode?: string | null;
};

export type TransferItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  baseUom: string;
  uoms: TransferUom[];
  barcodes: string[];
  onHand: number;
};

export type TransferSummaryItem = {
  stockItemId: string;
  name: string;
  quantity: number;
  unit: string;
  receivedQty: number;
};

export type TransferSummary = {
  id: string;
  transactionReference: string;
  type: string;
  direction: string;
  status: string;
  fromLocationName: string;
  toLocationName: string;
  fromSiteName: string;
  toSiteName: string;
  note: string;
  createdByName: string;
  requestedAt: string;
  acceptedAt: string;
  lineCount: number;
  shippedQty: number;
  receivedQty: number;
  items: TransferSummaryItem[];
};

export type TransferBootstrap = {
  ok: boolean;
  workspaceId: string;
  locations: TransferLocation[];
  canCreateInternal: boolean;
};

export type TransferBuckets = {
  ok: boolean;
  awaitingMyAcceptance: TransferSummary[];
  recentlySent: TransferSummary[];
  recentlyReceived: TransferSummary[];
  needsAttention: TransferSummary[];
  counts: {
    awaitingMyAcceptance: number;
    recentlySent: number;
    recentlyReceived: number;
  };
};

export type TransferDraftLine = {
  item: TransferItem;
  quantity: string;
  selectedUomName: string;
};

export type CreateTransferPayload = {
  idempotencyKey: string;
  fromLocationId: string;
  toLocationId: string;
  note: string;
  occurredAt: string;
  lines: Array<{ stockItemId: string; quantity: number; uom: string }>;
};

export type TransferResult = {
  ok: boolean;
  duplicate: boolean;
  transferId: string;
  transactionReference: string;
  status: string;
  fromLocationId: string;
  toLocationId: string;
  lineCount: number;
  lines: Array<{
    stockItemId: string;
    name: string;
    originalQuantity: number;
    originalUom: string;
    baseUom: string;
    baseQuantity: number;
  }>;
  postedAt: string;
};

function mobilePath(workspaceId: string, suffix: string) {
  return `api/mobile/v1/workspaces/${encodeURIComponent(String(workspaceId || '').trim())}/${suffix}`;
}

export function loadTransferBootstrap(workspaceId: string) {
  return apiRequest<TransferBootstrap>(mobilePath(workspaceId, 'transfers/bootstrap'));
}

export function loadTransferBuckets(workspaceId: string) {
  return apiRequest<TransferBuckets>(mobilePath(workspaceId, 'transfers'));
}

export function searchTransferItems(workspaceId: string, search: string, sourceLocationId: string) {
  return apiRequest<{ ok: boolean; items: TransferItem[] }>(mobilePath(workspaceId, 'transfers/items'), {
    query: { search, sourceLocationId }
  }).then((result) => Array.isArray(result.items) ? result.items : []);
}

export function createInternalTransfer(workspaceId: string, payload: CreateTransferPayload) {
  return apiRequest<TransferResult | ApprovalPending>(mobilePath(workspaceId, 'transfers'), { method: 'POST', payload });
}

export function acceptIncomingTransfer(workspaceId: string, transferId: string, lines: Array<{ stockItemId: string; receivedQty: number }>) {
  return apiRequest<{ ok: boolean; transferId: string; status: string; acceptedAt: string }>(
    mobilePath(workspaceId, `transfers/${encodeURIComponent(transferId)}/accept`),
    { method: 'POST', payload: { confirm: true, lines } }
  );
}

export function rejectIncomingTransfer(workspaceId: string, transferId: string, reason: string) {
  return apiRequest<{ ok: boolean; transferId: string; status: string; rejectedAt: string }>(
    mobilePath(workspaceId, `transfers/${encodeURIComponent(transferId)}/reject`),
    { method: 'POST', payload: { confirm: true, reason } }
  );
}
