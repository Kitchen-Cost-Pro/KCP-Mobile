import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { WastageItem, WastageLocation, WastageUom } from './wastageApi';

export type WastageRecovery = {
  workspaceId: string;
  userId: string;
  clientActionId: string;
  location: WastageLocation;
  item: WastageItem;
  barcode: string;
  availableUoms: WastageUom[];
  selectedUomName: string;
  quantity: string;
  reason: string;
  customReason: string;
  note: string;
  occurredAt: string;
  updatedAt: string;
};

const PREFIX = 'wastage-recovery-v1-';
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

function valid(value: unknown): value is WastageRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<WastageRecovery>;
  return Boolean(
    source.workspaceId && source.userId && source.clientActionId && source.location?.id && source.item?.id &&
    Array.isArray(source.availableUoms)
  );
}

export const wastageRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<WastageRecovery | null> {
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

  async set(recovery: WastageRecovery): Promise<void> {
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
      // A successful server commit remains authoritative even if local cleanup fails.
    }
  }
};
