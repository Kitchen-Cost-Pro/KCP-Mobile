import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { ManufacturingCatalogItem, ManufacturingRunDraft } from './manufacturingApi';

export type ManufacturingRecovery = {
  workspaceId: string;
  userId: string;
  draft: ManufacturingRunDraft;
  catalog?: ManufacturingCatalogItem[];
  updatedAt: string;
};

const PREFIX = 'manufacturing-recovery-v2-';
let initialized: Promise<void> | null = null;

async function initialize() {
  initialized ||= (async () => {
    await SecureStorage.setKeyPrefix('kcp-mobile_');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  })();
  return initialized;
}

function key(workspaceId: string, userId: string) {
  return `${PREFIX}${String(workspaceId || '').trim()}-${String(userId || '').trim()}`;
}

function valid(value: unknown): value is ManufacturingRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<ManufacturingRecovery>;
  return Boolean(source.workspaceId && source.userId && source.draft?.clientRunId);
}

export const manufacturingRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<ManufacturingRecovery | null> {
    try {
      let value: unknown;
      if (Capacitor.isNativePlatform()) {
        await initialize();
        value = await SecureStorage.get(key(workspaceId, userId));
      } else {
        const raw = window.sessionStorage.getItem(key(workspaceId, userId));
        value = raw ? JSON.parse(raw) : null;
      }
      return valid(value) && value.workspaceId === workspaceId && value.userId === userId ? value : null;
    } catch {
      return null;
    }
  },

  async set(recovery: ManufacturingRecovery): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await initialize();
      await SecureStorage.set(key(recovery.workspaceId, recovery.userId), recovery, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
      return;
    }
    window.sessionStorage.setItem(key(recovery.workspaceId, recovery.userId), JSON.stringify(recovery));
  },

  async clear(workspaceId: string, userId: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await initialize();
        await SecureStorage.remove(key(workspaceId, userId), false);
      } else {
        window.sessionStorage.removeItem(key(workspaceId, userId));
      }
    } catch {
      // A successful KCP batch remains authoritative if local cleanup is interrupted.
    }
  }
};
