import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { PurchaseOrderCatalogItem, PurchaseOrderDraft } from './purchaseOrderApi';

export type PurchaseOrderRecovery = { workspaceId: string; userId: string; draft: PurchaseOrderDraft; catalog: PurchaseOrderCatalogItem[]; updatedAt: string };
const PREFIX = 'purchase-order-recovery-v1-';
let initialized: Promise<void> | null = null;
async function initialize() { initialized ||= (async () => { await SecureStorage.setKeyPrefix('kcp-mobile_'); await SecureStorage.setSynchronize(false); await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly); })(); return initialized; }
function key(workspaceId: string, userId: string) { return `${PREFIX}${workspaceId.trim()}-${userId.trim()}`; }
function valid(value: unknown): value is PurchaseOrderRecovery { const item = value as Partial<PurchaseOrderRecovery> | null; return Boolean(item && typeof item === 'object' && item.workspaceId && item.userId && item.draft?.clientOrderId && Array.isArray(item.catalog)); }

export const purchaseOrderRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<PurchaseOrderRecovery | null> { try { let value: unknown; if (Capacitor.isNativePlatform()) { await initialize(); value = await SecureStorage.get(key(workspaceId, userId)); } else { const raw = window.sessionStorage.getItem(key(workspaceId, userId)); value = raw ? JSON.parse(raw) : null; } return valid(value) && value.workspaceId === workspaceId && value.userId === userId ? value : null; } catch { return null; } },
  async set(value: PurchaseOrderRecovery) { if (Capacitor.isNativePlatform()) { await initialize(); await SecureStorage.set(key(value.workspaceId, value.userId), value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly); } else window.sessionStorage.setItem(key(value.workspaceId, value.userId), JSON.stringify(value)); },
  async clear(workspaceId: string, userId: string) { try { if (Capacitor.isNativePlatform()) { await initialize(); await SecureStorage.remove(key(workspaceId, userId), false); } else window.sessionStorage.removeItem(key(workspaceId, userId)); } catch { /* KCP remains authoritative. */ } }
};
