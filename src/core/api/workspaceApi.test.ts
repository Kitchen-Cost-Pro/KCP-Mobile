import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), workspaceRequest: vi.fn() }));

vi.mock('./client', () => ({
  apiRequest: mocks.apiRequest,
  workspaceRequest: mocks.workspaceRequest
}));

import { loadWorkspaceBootstrap } from './workspaceApi';

describe('loadWorkspaceBootstrap', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.workspaceRequest.mockReset();
  });

  it('uses mobile bootstrap permissions, feature flags and server-filtered locations', async () => {
    mocks.apiRequest.mockResolvedValue({
      ok: true,
      apiVersion: 'v1',
      minSupportedAppVersion: '0.1.0',
      workspaces: [{
        id: 'ws-1',
        role: 'stocktaker',
        permissions: ['nav-dashboard', 'nav-stock-count'],
        allowedLocationIds: ['loc-1']
      }],
      featureFlags: {
        stockCount: true,
        scan: true,
        wastage: false,
        transfers: false,
        manufacturing: false,
        receiving: false,
        purchaseOrders: false,
        tasks: false,
        approvals: false
      },
      locations: [{ id: 'loc-1', name: 'Main Kitchen', active: true }]
    });
    mocks.workspaceRequest
      .mockResolvedValueOnce({ currentRole: 'member', team: [], customRoles: [] })
      .mockResolvedValueOnce({ settings: { theme: 'kcp-classic', restaurantLogoDataUrl: 'data:image/png;base64,a2Nw' } })
      .mockResolvedValueOnce({ preferences: {} })
      .mockResolvedValueOnce({ locations: [{ id: 'loc-2', name: 'Hidden Location', active: true }] });

    const result = await loadWorkspaceBootstrap('ws-1', {
      uid: 'user-1',
      id: 'user-1',
      email: 'stock@example.com',
      displayName: 'Stock User'
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/bootstrap', { query: { workspaceId: 'ws-1' } });
    expect(result.access.currentRole).toBe('stocktaker');
    expect(result.access.roleDefinition.name).toBe('stocktaker');
    expect(result.access.permissions).toEqual(['nav-dashboard', 'nav-stock-count']);
    expect(result.access.accessibleLocations.map((location) => location.id)).toEqual(['loc-1']);
    expect(result.featureFlags.stockCount).toBe(true);
    expect(result.featureFlags.manufacturing).toBe(false);
    expect(result.theme.logoDataUrl).toBe('data:image/png;base64,a2Nw');
  });
});
