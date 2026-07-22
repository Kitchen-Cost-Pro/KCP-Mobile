import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';
import { sessionStore } from '../session/sessionStore';

describe('apiRequest', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await sessionStore.clear();
  });

  it('sends JSON to the existing KCP route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, value: 7 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const result = await apiRequest<{ value: number }>('api/example', {
      method: 'POST',
      token: 'session-1',
      payload: { name: 'KCP' }
    });

    expect(result.value).toBe(7);
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://kcp-api-v2.adminkitchencostpro.workers.dev/api/example');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer session-1' });
    expect(request?.body).toBe(JSON.stringify({ name: 'KCP' }));
  });

  it('exposes the KCP server message and status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'No access to this workspace.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));

    await expect(apiRequest('api/example', { token: 'session-1' }))
      .rejects.toMatchObject({ status: 403, message: 'No access to this workspace.' });
  });

  it('calls the Worker directly from localhost development without dropping query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, actions: [] }), { status: 200 }));

    await expect(apiRequest('api/mobile/v1/workspaces/ws-1/actions', {
      query: { locationId: 'loc_main' },
      token: 'session-1'
    })).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://kcp-api-v2.adminkitchencostpro.workers.dev/api/mobile/v1/workspaces/ws-1/actions?locationId=loc_main');
  });

  it('rotates an expired mobile access token before sending the request', async () => {
    await sessionStore.set({
      token: 'access-old',
      expiresAt: '2020-01-01T00:00:00Z',
      refreshToken: 'refresh-old',
      refreshExpiresAt: '2099-01-01T00:00:00Z',
      deviceId: 'device-1',
      user: { uid: 'user-1', id: 'user-1', email: 'chef@example.com', displayName: 'Chef' }
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accessToken: 'access-new',
        accessExpiresAt: '2099-01-01T00:15:00Z',
        refreshToken: 'refresh-new',
        refreshExpiresAt: '2099-02-01T00:00:00Z',
        deviceId: 'device-1'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: 9 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));

    const result = await apiRequest<{ value: number }>('api/auth/me');

    expect(result.value).toBe(9);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/mobile/v1/session/refresh');
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer access-new' });
    await expect(sessionStore.get()).resolves.toMatchObject({ token: 'access-new', refreshToken: 'refresh-new' });
  });

  it('coalesces concurrent refreshes so a rotating token is presented only once', async () => {
    await sessionStore.set({
      token: 'access-old',
      expiresAt: '2020-01-01T00:00:00Z',
      refreshToken: 'refresh-old',
      refreshExpiresAt: '2099-01-01T00:00:00Z',
      deviceId: 'device-1',
      user: { uid: 'user-1', id: 'user-1', email: 'chef@example.com', displayName: 'Chef' }
    });
    let releaseRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => { releaseRefresh = resolve; });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => pendingRefresh)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));

    const first = apiRequest<{ value: number }>('api/first');
    const second = apiRequest<{ value: number }>('api/second');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    releaseRefresh(new Response(JSON.stringify({
      ok: true,
      accessToken: 'access-new',
      accessExpiresAt: '2099-01-01T00:15:00Z',
      refreshToken: 'refresh-new',
      refreshExpiresAt: '2099-02-01T00:00:00Z',
      deviceId: 'device-1'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    const refreshCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/session/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });
});
