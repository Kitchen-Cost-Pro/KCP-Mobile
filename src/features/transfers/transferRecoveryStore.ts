import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { TransferDraftLine } from './transferApi';

export type TransferRecovery = {
  workspaceId: string;
  userId: string;
  clientActionId: string;
  fromLocationId: string;
  toLocationId: string;
  lines: TransferDraftLine[];
  note: string;
  occurredAt: string;
  updatedAt: string;
};

const PREFIX = 'transfer-recovery-v1-';
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

function valid(value: unknown): value is TransferRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<TransferRecovery>;
  return Boolean(source.workspaceId && source.userId && source.clientActionId && Array.isArray(source.lines));
}

export const transferRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<TransferRecovery | null> {
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

  async set(recovery: TransferRecovery): Promise<void> {
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
      // The server response remains authoritative if local cleanup is interrupted.
    }
  }
};
