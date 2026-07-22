import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { ReceivingDraft, ReceivingOrder } from './receivingApi';

export type ReceivingRecovery = {
  workspaceId: string;
  userId: string;
  draft: ReceivingDraft;
  order: ReceivingOrder | null;
  updatedAt: string;
};

const PREFIX = 'receiving-recovery-v1-';
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

function valid(value: unknown): value is ReceivingRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<ReceivingRecovery>;
  return Boolean(source.workspaceId && source.userId && source.draft?.clientReceiptId);
}

export const receivingRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<ReceivingRecovery | null> {
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
    } catch { return null; }
  },

  async set(recovery: ReceivingRecovery): Promise<void> {
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
      } else window.sessionStorage.removeItem(key(workspaceId, userId));
    } catch {
      // The committed KCP GRV remains authoritative if local cleanup is interrupted.
    }
  }
};
