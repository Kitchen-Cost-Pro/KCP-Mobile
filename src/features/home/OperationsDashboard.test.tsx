import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessSnapshot, MobileFeatureFlags } from '../../types/kcp';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./dashboardApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./dashboardApi')>()), loadMobileDashboard: mocks.load }));

import { OperationsDashboard } from './OperationsDashboard';

const flags: MobileFeatureFlags = { stockCount: true, scan: true, wastage: true, transfers: true, manufacturing: true, receiving: true, purchaseOrders: true, tasks: false, approvals: false };
const dashboard = {
  ok: true,
  generatedAt: '2026-07-20T08:00:00Z',
  timezone: 'Africa/Johannesburg',
  period: { key: 'today', label: 'Today', from: '2026-07-20', to: '2026-07-20', tradingDayLabel: 'Today' },
  scope: { workspaceId: 'ws-1', workspaceName: 'Test Kitchen', mode: 'selected', locationId: 'loc-1', locationName: 'Main Store' },
  metrics: {
    grossSales: metric(true, 1234.5, 'Gross Sales', 'ZAR'), refunds: metric(true, 0, 'Refunds', 'ZAR'), netSales: metric(true, 1234.5, 'Net Sales', 'ZAR'),
    theoreticalFoodCost: metric(true, 350, 'Theoretical Food Cost', 'ZAR'), foodCostPercent: metric(true, 28.4, 'Food Cost'), wastageValue: metric(true, 22, 'Wastage', 'ZAR'),
    lowStockCount: metric(true, 3, 'Low Stock'), pendingTransfers: metric(true, 1, 'Pending Transfers'), activeCountDrafts: metric(true, 2, 'Count Drafts')
  },
  attention: [
    { id: 'low', type: 'LOW_STOCK', title: 'Low stock items', detail: 'Below par: Flour', count: 3, severity: 'high', locationId: 'loc-1', locationName: 'Main Store' },
    { id: 'count', type: 'COUNT_DRAFT', title: 'Resumable stock counts', detail: '2 counts in progress', count: 2, severity: 'low', locationId: 'loc-1', locationName: 'Main Store' }
  ],
  recentActivity: [{ id: 'move-1', eventType: 'WASTAGE', title: 'Wastage recorded', detail: '', locationName: 'Main Store', occurredAt: '2026-07-20T07:30:00Z', displayTime: '20 Jul 2026, 09:30', transactionId: 'move-1' }]
};

describe('OperationsDashboard', () => {
  beforeEach(() => { mocks.load.mockReset().mockResolvedValue(dashboard); });

  it('renders authorised live metrics, attention and recent activity', async () => {
    const onNavigate = vi.fn();
    const onLocation = vi.fn();
    render(<OperationsDashboard workspaceId="ws-1" connected location={{ id: 'loc-1', locationId: 'loc-1', name: 'Main Store', displayName: 'Main Store' }} access={access(['nav-dashboard', 'nav-ingredients', 'nav-stock-count'])} featureFlags={flags} onNavigate={onNavigate} onLocation={onLocation} />);
    expect(await screen.findAllByText('R 1 234,50')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Date range: Today' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Main Store/i }));
    expect(onLocation).toHaveBeenCalledOnce();
    expect(screen.getByText('28,4%')).toBeInTheDocument();
    expect(screen.getByText('Low stock items')).toBeInTheDocument();
    expect(screen.getByText('Wastage recorded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Low stock items/i }));
    expect(onNavigate).toHaveBeenCalledWith('low-stock');
    expect(mocks.load).toHaveBeenCalledWith('ws-1', 'loc-1', expect.any(AbortSignal));
  });

  it('keeps attention read-only when the user lacks the target permission', async () => {
    render(<OperationsDashboard workspaceId="ws-1" connected location={null} access={access(['nav-dashboard'])} featureFlags={flags} onNavigate={vi.fn()} />);
    await screen.findByText('Low stock items');
    expect(screen.queryByRole('button', { name: /Low stock items/i })).not.toBeInTheDocument();
  });

  it('does not request live data while offline', async () => {
    render(<OperationsDashboard workspaceId="ws-1" connected={false} location={null} access={access(['nav-dashboard'])} featureFlags={flags} onNavigate={vi.fn()} />);
    expect(await screen.findByText('Connect for today’s dashboard')).toBeInTheDocument();
    await waitFor(() => expect(mocks.load).not.toHaveBeenCalled());
  });

  it('omits unavailable financial metrics instead of displaying false zeroes', async () => {
    mocks.load.mockResolvedValue({ ...dashboard, metrics: { ...dashboard.metrics, grossSales: metric(false, null, 'Gross Sales', 'ZAR'), netSales: metric(false, null, 'Net Sales', 'ZAR'), theoreticalFoodCost: metric(false, null, 'Theoretical Food Cost', 'ZAR'), foodCostPercent: metric(false, null, 'Food Cost') } });
    render(<OperationsDashboard workspaceId="ws-1" connected location={null} access={access(['nav-dashboard'])} featureFlags={flags} onNavigate={vi.fn()} />);
    await screen.findByText('Low Stock');
    expect(screen.queryByText('Gross Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Net Sales')).not.toBeInTheDocument();
  });

  it('does not render financial tiles for a financially restricted Role Set', async () => {
    render(<OperationsDashboard workspaceId="ws-1" connected location={null} access={access(['nav-dashboard'])} featureFlags={flags} financialVisibility="none" onNavigate={vi.fn()} />);
    await screen.findByText('Low Stock');
    expect(screen.queryByText('Gross Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Wastage')).not.toBeInTheDocument();
    expect(screen.getByText('Pending Transfers')).toBeInTheDocument();
  });
});

function metric(available: boolean, value: number | null, label: string, currency?: string) { return { available, value, label, ...(currency ? { currency } : {}) }; }
function access(permissions: string[]): AccessSnapshot { return { currentRole: 'custom', currentIsSuperUser: false, currentIsKcpSuperUser: false, permissions, allowedSections: [], currentUserLocations: ['all'], accessibleLocations: [], roleDefinition: { name: 'custom', label: 'Custom', permissions, locations: ['all'] } }; }
