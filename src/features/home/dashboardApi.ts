import { apiRequest } from '../../core/api/client';

export type DashboardMetric = {
  available: boolean;
  value: number | null;
  currency?: string;
  label: string;
};

export type DashboardAttention = {
  id: string;
  type: 'LOW_STOCK' | 'TRANSFER_AWAITING_ACCEPTANCE' | 'COUNT_DRAFT' | 'DATA_QUALITY_WARNING' | string;
  title: string;
  detail: string;
  count: number | null;
  severity: 'high' | 'medium' | 'low';
  locationId: string | null;
  locationName: string;
};

export type DashboardActivity = {
  id: string;
  eventType: string;
  title: string;
  detail: string;
  locationName: string;
  occurredAt: string;
  displayTime: string;
  transactionId: string;
};

export type MobileDashboard = {
  ok: boolean;
  generatedAt: string;
  timezone: string;
  period: { key: 'today'; label: string; from: string; to: string; tradingDayLabel: string };
  scope: { workspaceId: string; workspaceName: string; mode: 'selected' | 'permitted'; locationId: string | null; locationName: string };
  metrics: {
    grossSales: DashboardMetric;
    refunds: DashboardMetric;
    netSales: DashboardMetric;
    theoreticalFoodCost: DashboardMetric;
    foodCostPercent: DashboardMetric;
    wastageValue: DashboardMetric;
    lowStockCount: DashboardMetric;
    pendingTransfers: DashboardMetric;
    activeCountDrafts: DashboardMetric;
  };
  attention: DashboardAttention[];
  recentActivity: DashboardActivity[];
};

export function loadMobileDashboard(workspaceId: string, locationId = '', signal?: AbortSignal) {
  const id = String(workspaceId || '').trim();
  if (!id) return Promise.reject(new Error('Workspace is required.'));
  return apiRequest<MobileDashboard>(`api/mobile/v1/workspaces/${encodeURIComponent(id)}/dashboard`, {
    query: locationId
      ? { period: 'today', scope: 'selected', locationId }
      : { period: 'today', scope: 'permitted' },
    signal
  });
}
