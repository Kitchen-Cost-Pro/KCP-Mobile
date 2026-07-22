import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { KcpSession } from '../../types/kcp';

const SESSION_KEY = 'cloud-session-v1';
let initialized: Promise<void> | null = null;
let webSession: KcpSession | null = null;

async function initialize() {
  initialized ||= (async () => {
    await SecureStorage.setKeyPrefix('kcp-mobile_');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  })();
  return initialized;
}

function normalizeSession(value: unknown): KcpSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const user = source.user as Record<string, unknown> | undefined;
  const token = String(source.token || '').trim();
  const uid = String(user?.uid || user?.id || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();
  if (!token || !uid || !email) return null;
  return {
    token,
    expiresAt: String(source.expiresAt || ''),
    refreshToken: String(source.refreshToken || ''),
    refreshExpiresAt: String(source.refreshExpiresAt || ''),
    deviceId: String(source.deviceId || ''),
    user: {
      uid,
      id: String(user?.id || uid),
      email,
      displayName: String(user?.displayName || user?.name || email.split('@')[0]),
      providerData: Array.isArray(user?.providerData)
        ? user.providerData as Array<{ providerId: string }>
        : [{ providerId: 'cloudflare' }]
    }
  };
}

export const sessionStore = {
  async get(): Promise<KcpSession | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        if (webSession) return webSession;
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        webSession = normalizeSession(raw ? JSON.parse(raw) : null);
        return webSession;
      }
      await initialize();
      return normalizeSession(await SecureStorage.get(SESSION_KEY));
    } catch {
      return null;
    }
  },

  async set(session: KcpSession): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      webSession = session;
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return;
    }
    await initialize();
    await SecureStorage.set(SESSION_KEY, session, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  },

  async clear(): Promise<void> {
    try {
      if (!Capacitor.isNativePlatform()) {
        webSession = null;
        window.sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      await initialize();
      await SecureStorage.remove(SESSION_KEY, false);
    } catch {
      // A failed secure-store cleanup must not prevent the app from signing out in memory.
    }
  }
};
