import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));
import { loadLowStock } from './lowStockApi';

describe('Phase 13 low-stock API', () => {
  beforeEach(() => mocks.apiRequest.mockReset().mockResolvedValue({ ok: true, items: [] }));

  it('uses the versioned location-scoped mobile route', async () => {
    await loadLowStock('ws/one', 'loc-1');
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws%2Fone/low-stock', expect.objectContaining({ query: { locationId: 'loc-1' } }));
  });

  it('refuses an unscoped request', async () => {
    await expect(loadLowStock('ws-1', '')).rejects.toThrow('Choose a location');
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });
});
