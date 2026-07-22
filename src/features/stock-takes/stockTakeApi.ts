import { apiRequest, workspaceRequest } from '../../core/api/client';
import type { ApprovalPending } from '../approvals/approvalSubmission';
import type {
  StockCountDraft,
  StockCountHistoryItem,
  StockCountItem,
  StockCountLine,
  StockCountLocation,
  StockCountReconciliation,
  StockCountTemplate
} from '../../types/kcp';

type TemplateListResponse = {
  ok: boolean;
  templates: StockCountTemplate[];
};

export type StockCountPackage = {
  template: Pick<StockCountTemplate, 'id' | 'name' | 'version' | 'scope'>;
  location: StockCountLocation | null;
  linkedLocations: StockCountLocation[];
  items: StockCountItem[];
  itemCount: number;
  dataVersion: string;
};

function mobileCountsPath(workspaceId: string, suffix = '') {
  const workspace = encodeURIComponent(String(workspaceId || '').trim());
  return `api/mobile/v1/workspaces/${workspace}/counts${suffix}`;
}

export async function listStockCountTemplates(workspaceId: string) {
  const response = await apiRequest<TemplateListResponse>(mobileCountsPath(workspaceId, '/bootstrap'));
  return Array.isArray(response.templates) ? response.templates : [];
}

export async function loadStockCountPackage(workspaceId: string, templateId: string, locationId: string) {
  return apiRequest<StockCountPackage>(mobileCountsPath(workspaceId, '/bootstrap'), {
    query: { templateId, locationId }
  });
}

export async function listStockCountDrafts(workspaceId: string) {
  const response = await workspaceRequest<{ drafts?: StockCountDraft[] }>(workspaceId, 'stock-take-drafts');
  return (Array.isArray(response.drafts) ? response.drafts : [])
    .filter((draft) => draft.status !== 'committed');
}

export async function listStockCountHistory(workspaceId: string, limit = 12) {
  const response = await workspaceRequest<{ stockTakes?: StockCountHistoryItem[] }>(workspaceId, 'stock-takes', {
    query: { limit }
  });
  return Array.isArray(response.stockTakes) ? response.stockTakes : [];
}

type DraftPayload = {
  templateId: string;
  templateVersion?: string;
  locationId: string;
  lines: StockCountLine[];
  expectedRevision?: number;
};

type SaveResponse = {
  ok: boolean;
  sessionId: string;
  revision: number;
  status: StockCountDraft['status'];
  savedAt: string;
};

export function createStockCount(workspaceId: string, payload: DraftPayload) {
  return apiRequest<SaveResponse>(mobileCountsPath(workspaceId), { method: 'POST', payload });
}

export function saveStockCount(workspaceId: string, sessionId: string, payload: DraftPayload) {
  return apiRequest<SaveResponse>(mobileCountsPath(workspaceId, `/${encodeURIComponent(sessionId)}`), {
    method: 'PATCH',
    payload
  });
}

export async function getStockCount(workspaceId: string, sessionId: string) {
  const response = await apiRequest<{ session: StockCountDraft; revision: number; updatedAt: string }>(
    mobileCountsPath(workspaceId, `/${encodeURIComponent(sessionId)}`)
  );
  return {
    ...response.session,
    id: response.session.id || sessionId,
    revision: Number(response.revision || response.session.revision || 0),
    savedAt: response.updatedAt || response.session.savedAt
  };
}

export async function reconcileStockCount(workspaceId: string, sessionId: string) {
  return apiRequest<StockCountReconciliation>(
    mobileCountsPath(workspaceId, `/${encodeURIComponent(sessionId)}/reconcile`),
    { method: 'POST', payload: {} }
  );
}

export type StockCountCommitResult = {
  ok: boolean;
  sessionId: string;
  duplicate: boolean;
  transactionId: string;
  status: 'committed';
  committedAt: string;
  countedItemCount: number;
  netVarianceValue: number;
  currency: string;
};

export function commitStockCount(
  workspaceId: string,
  sessionId: string,
  reconciliationVersion: string
) {
  return apiRequest<StockCountCommitResult | ApprovalPending>(
    mobileCountsPath(workspaceId, `/${encodeURIComponent(sessionId)}/commit`),
    {
      method: 'POST',
      payload: {
        reconciliationVersion,
        idempotencyKey: sessionId,
        confirm: true
      }
    }
  );
}
