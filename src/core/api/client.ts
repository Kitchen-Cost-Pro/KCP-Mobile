import { sessionStore } from '../session/sessionStore';

const productionBaseUrl = String(
  import.meta.env.VITE_KCP_API_BASE_URL ||
  'https://kcp-api-v2.adminkitchencostpro.workers.dev'
).trim();

// LAN previews (for example http://192.168.x.x:5173 on a phone) go through Vite's
// same-origin proxy. Localhost uses the Worker directly: this removes the extra
// proxy hop and means a Vite process that was started before a route change cannot
// produce a misleading local 404 for a live KCP endpoint.
const devProxyBaseUrl = '/kcp-api';
function shouldUseDevelopmentProxy() {
  if (!import.meta.env.DEV) return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return !['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
}
const rawBaseUrl = shouldUseDevelopmentProxy() ? devProxyBaseUrl : productionBaseUrl;

export const KCP_API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(message: string, status = 0, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type MobileRefreshResponse = {
  ok: boolean;
  accessToken: string;
  accessExpiresAt?: string;
  refreshToken: string;
  refreshExpiresAt?: string;
  deviceId?: string;
};

let refreshPromise: Promise<NonNullable<Awaited<ReturnType<typeof sessionStore.get>>>> | null = null;

function apiUrl(path: string) {
  const apiRoot = new URL(`${KCP_API_BASE_URL}/`, window.location.origin);
  return new URL(String(path || '').replace(/^\/+/, ''), apiRoot);
}

function accessTokenNeedsRefresh(expiresAt = '') {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry <= Date.now() + 60_000;
}

export async function refreshSessionForForeground() {
  const session=await sessionStore.get();if(!session?.refreshToken)return session;
  const expiry=Date.parse(session.expiresAt||'');
  if(Number.isFinite(expiry)&&expiry>Date.now()+5*60_000)return session;
  return refreshMobileSession(session);
}

async function refreshMobileSession(session: NonNullable<Awaited<ReturnType<typeof sessionStore.get>>>) {
  if (!session.refreshToken) throw new ApiError('Session expired. Please sign in again.', 401);
  if (refreshPromise) return refreshPromise;

  // A second request can reach a 401 just after another request rotated the
  // one-time refresh token. Reuse the newer stored session instead of replaying
  // the old token and causing the Worker to revoke the complete token family.
  const latest = await sessionStore.get();
  if (latest?.refreshToken && latest.refreshToken !== session.refreshToken) return latest;
  if (refreshPromise) return refreshPromise;
  const source = latest?.refreshToken ? latest : session;

  refreshPromise = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(apiUrl('api/mobile/v1/session/refresh'), {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: source.refreshToken }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({})) as Partial<MobileRefreshResponse> & Record<string, unknown>;
      if (!response.ok || result.ok === false || !result.accessToken || !result.refreshToken) {
        await sessionStore.clear();
        throw new ApiError(
          String(result.error || 'Session expired. Please sign in again.'),
          response.status || 401,
          result
        );
      }
      const refreshed = {
        ...source,
        token: String(result.accessToken),
        expiresAt: String(result.accessExpiresAt || ''),
        refreshToken: String(result.refreshToken),
        refreshExpiresAt: String(result.refreshExpiresAt || ''),
        deviceId: String(result.deviceId || source.deviceId || '')
      };
      await sessionStore.set(refreshed);
      return refreshed;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Session refresh timed out. Check your connection and try again.', 0);
      }
      throw new ApiError('Could not refresh your KCP session. Check your connection and try again.', 0);
    } finally {
      window.clearTimeout(timeout);
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  token?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const url = apiUrl(cleanPath);

  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  let storedSession = options.token === undefined ? await sessionStore.get() : null;
  if (storedSession?.refreshToken && accessTokenNeedsRefresh(storedSession.expiresAt)) {
    storedSession = await refreshMobileSession(storedSession);
  }
  let token = options.token === undefined ? storedSession?.token || '' : options.token;
  const controller = new AbortController();
  const timeoutMs = Math.min(120_000, Math.max(1_000, options.timeoutMs || 30_000));
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const send = (bearerToken: string) => {
      return fetch(url, {
        method,
        cache: method === 'GET' ? 'no-store' : 'default',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
        },
        body: method === 'GET' ? undefined : JSON.stringify(options.payload || {}),
        signal: controller.signal
      });
    };

    let response = await send(token);
    let result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 401 && options.token === undefined && storedSession?.refreshToken) {
      storedSession = await refreshMobileSession(storedSession);
      token = storedSession.token;
      response = await send(token);
      result = await response.json().catch(() => ({})) as Record<string, unknown>;
    }
    if (!response.ok || result.ok === false) {
      if (response.status === 401 && options.token === undefined && token) await sessionStore.clear();
      throw new ApiError(
        String(result.message || result.error || `KCP request failed (${response.status}).`),
        response.status,
        result
      );
    }
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection and try again.', 0);
    }
    if (error instanceof TypeError) {
      throw new ApiError('Could not connect to KCP. Check your internet connection and API configuration.', 0);
    }
    throw new ApiError(error instanceof Error ? error.message : 'Could not connect to KCP.', 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function workspaceRequest<T>(workspaceId: string, resource: string, options: ApiRequestOptions = {}) {
  const id = String(workspaceId || '').trim();
  if (!id) return Promise.reject(new ApiError('Workspace is required.'));
  return apiRequest<T>(`api/workspaces/${encodeURIComponent(id)}/${resource}`, options);
}
