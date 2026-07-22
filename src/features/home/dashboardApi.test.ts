import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { loadMobileDashboard } from './dashboardApi';

describe('mobile dashboard API', () => {
  beforeEach(() => mocks.apiRequest.mockReset().mockResolvedValue({ ok: true }));

  it('requests a selected authorised location', async () => {
    await loadMobileDashboard('ws/one', 'loc-1');
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws%2Fone/dashboard', expect.objectContaining({
      query: { period: 'today', scope: 'selected', locationId: 'loc-1' }
    }));
  });

  it('uses the server-authorised permitted scope when no location is selected', async () => {
    await loadMobileDashboard('ws-1');
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws-1/dashboard', expect.objectContaining({
      query: { period: 'today', scope: 'permitted' }
    }));
  });
});
