import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  setSession: vi.fn()
}));

vi.mock('../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../session/sessionStore', () => ({
  sessionStore: {
    get: vi.fn(),
    set: mocks.setSession,
    clear: vi.fn()
  }
}));

import { login, requestPasswordReset } from './authApi';

describe('mobile authentication API', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.setSession.mockReset();
  });

  it('uses the versioned mobile login and device registration flow', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({
        ok: true,
        accessToken: 'access-1',
        accessExpiresAt: '2026-07-20T10:00:00Z',
        user: { uid: 'user-1', email: 'chef@example.com' }
      })
      .mockResolvedValueOnce({
        ok: true,
        device: { id: 'device-1', deviceName: 'KCP Lite browser preview', platform: 'web' },
        refreshToken: 'refresh-1',
        refreshExpiresAt: '2026-08-20T10:00:00Z'
      });

    await login('chef@example.com', 'secret-password');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/session/login', {
      method: 'POST',
      token: '',
      payload: { email: 'chef@example.com', password: 'secret-password' }
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/devices/register', expect.objectContaining({
      method: 'POST',
      token: 'access-1',
      payload: expect.objectContaining({
        device: expect.objectContaining({ deviceName: 'KCP Lite browser preview', platform: 'web', appVersion: '0.20.0' })
      })
    }));
    expect(mocks.setSession).toHaveBeenCalledOnce();
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({
      token: 'access-1',
      refreshToken: 'refresh-1',
      deviceId: 'device-1'
    }));
  });

  it('hands password recovery to the existing secure KCP web flow', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const result = await requestPasswordReset('chef@example.com');

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('https://kcp-live.pages.dev/') }),
      '_blank',
      'noopener,noreferrer'
    );
    expect(result.ok).toBe(true);
  });
});
