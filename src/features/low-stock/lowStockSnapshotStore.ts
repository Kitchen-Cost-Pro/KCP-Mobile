import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { isSnapshotFresh } from '../../core/offline/snapshotCache';
import type { LowStockResponse } from './lowStockApi';

export type LowStockSnapshot = {
  workspaceId: string;
  userId: string;
  locationId: string;
  response: LowStockResponse;
  savedAt: string;
};

const PREFIX = 'low-stock-snapshot-v1-';
let initialized: Promise<void> | null = null;

async function initialize() {
  initialized ||= (async () => {
    await SecureStorage.setKeyPrefix('kcp-mobile_');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  })();
  return initialized;
}

function key(workspaceId: string, userId: string, locationId: string) {
  return `${PREFIX}${workspaceId.trim()}-${userId.trim()}-${locationId.trim()}`;
}

function valid(value: unknown): value is LowStockSnapshot {
  const item = value as Partial<LowStockSnapshot> | null;
  return Boolean(item && typeof item === 'object' && item.workspaceId && item.userId && item.locationId && item.response?.location?.id && Array.isArray(item.response?.items));
}

export const lowStockSnapshotStore = {
  async get(workspaceId: string, userId: string, locationId: string): Promise<LowStockSnapshot | null> {
    try {
      let value: unknown;
      if (Capacitor.isNativePlatform()) {
        await initialize();
        value = await SecureStorage.get(key(workspaceId, userId, locationId));
      } else {
        const raw = window.sessionStorage.getItem(key(workspaceId, userId, locationId));
        value = raw ? JSON.parse(raw) : null;
      }
      return valid(value) && isSnapshotFresh(value.savedAt) && value.workspaceId === workspaceId && value.userId === userId && value.locationId === locationId ? value : null;
    } catch {
      return null;
    }
  },

  async set(snapshot: LowStockSnapshot): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await initialize();
      await SecureStorage.set(key(snapshot.workspaceId, snapshot.userId, snapshot.locationId), snapshot, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
      return;
    }
    window.sessionStorage.setItem(key(snapshot.workspaceId, snapshot.userId, snapshot.locationId), JSON.stringify(snapshot));
  }
};
